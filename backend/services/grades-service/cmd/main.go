package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/baaaki/mydreamcampus/grades-service/config"
	"github.com/baaaki/mydreamcampus/grades-service/internal/handler"
	"github.com/baaaki/mydreamcampus/grades-service/internal/repository"
	"github.com/baaaki/mydreamcampus/grades-service/internal/service"
	"github.com/baaaki/mydreamcampus/grades-service/internal/worker"
	"github.com/baaaki/mydreamcampus/shared/database"
	"github.com/baaaki/mydreamcampus/shared/audit"
	sharedHandler "github.com/baaaki/mydreamcampus/shared/handler"
	"github.com/baaaki/mydreamcampus/shared/logger"
	sharedMiddleware "github.com/baaaki/mydreamcampus/shared/middleware"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	sharedRedis "github.com/baaaki/mydreamcampus/shared/redis"
	sharedRepo "github.com/baaaki/mydreamcampus/shared/repository"
	"github.com/baaaki/mydreamcampus/shared/semester"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("failed to load config: %v", err))
	}

	// Initialize logger
	if err := logger.Init(cfg.Server.Environment); err != nil {
		panic(fmt.Sprintf("failed to initialize logger: %v", err))
	}
	defer logger.Sync()

	logger.Info("starting grades-service",
		zap.String("environment", cfg.Server.Environment),
		zap.String("port", cfg.Server.Port),
	)

	// Initialize database
	pool, err := database.NewPostgresPool(cfg.Database.URL)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer pool.Close()

	logger.Info("database connection established")

	// Initialize Redis for rate limiting
	redisClient, err := sharedRedis.NewClient(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	if err != nil {
		logger.Warn("Redis not available, rate limiting disabled", zap.Error(err))
	} else {
		defer redisClient.Close()
		if cfg.RateLimit.Enabled {
			rlConfig := sharedMiddleware.RateLimitConfig{
				Enabled:     true,
				ServiceName: "grades",
				IPLimit:     cfg.RateLimit.IPLimit,
				IPWindow:   time.Duration(cfg.RateLimit.IPWindowSecs) * time.Second,
				UserLimit:  cfg.RateLimit.UserLimit,
				UserWindow: time.Duration(cfg.RateLimit.UserWindowSecs) * time.Second,
			}
			sharedMiddleware.SetRateLimiter(sharedMiddleware.NewRateLimiter(redisClient, rlConfig))
			logger.Info("rate limiter configured")
		}
	}

	// Initialize RabbitMQ
	rabbitConn, err := rabbitmq.NewConnection(cfg.RabbitMQ.URL)
	if err != nil {
		logger.Fatal("failed to connect to RabbitMQ", zap.Error(err))
	}
	defer rabbitConn.Close()

	logger.Info("RabbitMQ connection established")

	// Setup RabbitMQ exchanges
	if err := setupRabbitMQ(rabbitConn); err != nil {
		logger.Fatal("failed to setup RabbitMQ", zap.Error(err))
	}

	// Initialize publisher and consumer
	publisher := rabbitmq.NewPublisher(rabbitConn)
	consumer := rabbitmq.NewConsumer(rabbitConn)

	// Initialize repositories
	cacheRepo := repository.NewCacheRepository(pool)
	registrationRepo := repository.NewRegistrationRepository(pool)
	scoreRepo := repository.NewScoreRepository(pool)
	completedRepo := repository.NewCompletedRepository(pool)
	outboxRepo := repository.NewOutboxRepository(pool)
	periodRepo := sharedRepo.NewPeriodRepository(pool)

	// Initialize semester checker and audit logger (via catalog service HTTP)
	semesterChecker := semester.NewHTTPChecker(cfg.CatalogService.BaseURL)
	auditLogger := audit.NewHTTPLogger(cfg.CatalogService.BaseURL, "grades")

	// Initialize services
	gradeService := service.NewGradeService(pool, cacheRepo, registrationRepo, scoreRepo, completedRepo, outboxRepo, periodRepo, auditLogger)
	studentGradeService := service.NewStudentGradesService(cacheRepo, registrationRepo, scoreRepo, completedRepo)

	// Initialize handlers
	gradeHandler := handler.NewGradeHandler(gradeService, studentGradeService)

	// Initialize workers
	eventConsumer := worker.NewEventConsumer(consumer, cacheRepo, registrationRepo)
	outboxWorker := worker.NewOutboxWorker(outboxRepo, publisher, 5*time.Second, 10)

	// Start workers in background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start event consumer
	go func() {
		if err := eventConsumer.Start(ctx); err != nil {
			logger.Error("event consumer failed", zap.Error(err))
		}
	}()

	// Start outbox worker
	go outboxWorker.Start(ctx)

	// Initialize shared handlers
	timeHandler := sharedHandler.NewTimeHandler()
	periodHandler := sharedHandler.NewPeriodHandler(periodRepo, semesterChecker, auditLogger)

	// Setup Gin router
	router := setupRouter(gradeHandler, timeHandler, periodHandler, cfg)

	// Start HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		logger.Info("server starting", zap.String("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	// Cancel workers context
	cancel()

	// Shutdown HTTP server with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("server forced to shutdown", zap.Error(err))
	}

	logger.Info("server exited")
}

func setupRouter(gradeHandler *handler.GradeHandler, timeHandler *sharedHandler.TimeHandler, periodHandler *sharedHandler.PeriodHandler, cfg *config.Config) *gin.Engine {
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global middleware
	router.Use(sharedMiddleware.Recovery())
	router.Use(sharedMiddleware.CORS())
	router.Use(sharedMiddleware.RequestLogger())
	router.Use(sharedMiddleware.IPRateLimit())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "grades-service",
		})
	})

	// API routes - All routes are protected via Traefik forward-auth
	// User info is extracted from X-User-* headers set by Traefik
	api := router.Group("/api/grades")
	api.Use(sharedMiddleware.ExtractUserFromHeaders())
	api.Use(sharedMiddleware.UserRateLimit())

	// Teacher routes (require teacher or admin role)
	teacher := api.Group("/course")
	teacher.Use(sharedMiddleware.RequireTeacherOrAdmin())
	{
		teacher.GET("/:course_id/status", gradeHandler.GetCourseStatus)
		teacher.GET("/:course_id/students", gradeHandler.GetCourseStudents)
		teacher.POST("/:course_id/scores", gradeHandler.SubmitScore)
		teacher.POST("/:course_id/scores/bulk", gradeHandler.BulkSubmitScores)
	}

	// Student routes
	student := api.Group("/student")
	{
		student.GET("/my", gradeHandler.GetMyGrades)
	}

	// Transcript route (any authenticated user can access)
	transcript := api.Group("/transcript")
	{
		transcript.GET("/:student_id", gradeHandler.GetTranscript)
	}

	// Admin routes (require admin role)
	admin := api.Group("/admin")
	admin.Use(sharedMiddleware.RequireAdmin())
	{
		admin.POST("/appeal", gradeHandler.ProcessAppeal)
		admin.POST("/scores/unlock", gradeHandler.UnlockScore)
		admin.POST("/scores/lock", gradeHandler.LockScore)

		// Time Machine & Academic Periods (shared handlers)
		timeHandler.RegisterRoutes(admin)
		periodHandler.RegisterRoutes(admin)
	}

	return router
}

func setupRabbitMQ(conn *rabbitmq.Connection) error {
	channel := conn.Channel()

	// Declare grade.events exchange (for publishing)
	if err := channel.ExchangeDeclare(
		"grade.events", // name
		"topic",        // type
		true,           // durable
		false,          // auto-deleted
		false,          // internal
		false,          // no-wait
		nil,            // arguments
	); err != nil {
		return fmt.Errorf("failed to declare grade.events exchange: %w", err)
	}

	logger.Info("RabbitMQ exchange declared", zap.String("exchange", "grade.events"))

	// Note: Consumer will declare queues and bindings automatically
	// when event_consumer.Start() is called

	return nil
}
