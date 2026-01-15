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
	"github.com/baaaki/mydreamcampus/shared/logger"
	sharedMiddleware "github.com/baaaki/mydreamcampus/shared/middleware"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
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

	// Initialize services
	gradeService := service.NewGradeService(pool, cacheRepo, registrationRepo, scoreRepo, completedRepo, outboxRepo)
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

	// Setup Gin router
	router := setupRouter(gradeHandler, cfg)

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

func setupRouter(gradeHandler *handler.GradeHandler, cfg *config.Config) *gin.Engine {
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global middleware
	router.Use(sharedMiddleware.Recovery())
	router.Use(sharedMiddleware.CORS())
	router.Use(sharedMiddleware.RequestLogger())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "grades-service",
		})
	})

	// API routes
	api := router.Group("/api/v1/grades")

	// Teacher routes (require JWT auth and teacher role)
	teacher := api.Group("/course")
	teacher.Use(sharedMiddleware.JWTAuth())
	teacher.Use(sharedMiddleware.RequireTeacherOrAdmin())
	{
		teacher.GET("/:courseId/status", gradeHandler.GetCourseStatus)
		teacher.GET("/:courseId/students", gradeHandler.GetCourseStudents)
		teacher.POST("/:courseId/scores", gradeHandler.SubmitScore)
		teacher.POST("/:courseId/scores/bulk", gradeHandler.BulkSubmitScores)
	}

	// Student routes (require JWT auth)
	student := api.Group("/student")
	student.Use(sharedMiddleware.JWTAuth())
	{
		student.GET("/my", gradeHandler.GetMyGrades)
	}

	// Transcript route (student or admin)
	transcript := api.Group("/transcript")
	transcript.Use(sharedMiddleware.JWTAuth())
	{
		transcript.GET("/:studentId", gradeHandler.GetTranscript)
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
