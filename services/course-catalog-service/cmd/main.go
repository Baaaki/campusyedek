package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/baaaki/mydreamcampus/course-catalog-service/config"
	internaldb "github.com/baaaki/mydreamcampus/course-catalog-service/internal/database"
	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/handler"
	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/repository"
	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/service"
	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/worker"
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

	logger.Info("starting course-catalog-service",
		zap.String("environment", cfg.Server.Environment),
		zap.String("port", cfg.Server.Port),
	)

	// Initialize database with custom enum types
	pool, err := internaldb.NewPoolWithEnums(cfg.Database.URL)
	if err != nil {
		logger.Fatal("failed to connect to database",
			zap.Error(err),
		)
	}
	defer pool.Close()

	logger.Info("database connection established")

	// Initialize RabbitMQ
	rabbitConn, err := rabbitmq.NewConnection(cfg.RabbitMQ.URL)
	if err != nil {
		logger.Fatal("failed to connect to RabbitMQ",
			zap.Error(err),
		)
	}
	defer rabbitConn.Close()

	logger.Info("RabbitMQ connection established")

	// Setup RabbitMQ exchange and queue
	if err := setupRabbitMQ(rabbitConn); err != nil {
		logger.Fatal("failed to setup RabbitMQ",
			zap.Error(err),
		)
	}

	// Initialize publisher
	publisher := rabbitmq.NewPublisher(rabbitConn)

	// Initialize repositories
	catalogRepo := repository.NewCatalogRepository(pool)
	semesterRepo := repository.NewSemesterRepository(pool)
	scheduleRepo := repository.NewScheduleRepository(pool)
	outboxRepo := repository.NewOutboxRepository(pool)

	// Initialize staff client
	staffClient := service.NewHTTPStaffClient(cfg.StaffService.BaseURL)

	// Initialize services
	catalogService := service.NewCatalogService(catalogRepo)
	semesterService := service.NewSemesterService(
		catalogRepo,
		semesterRepo,
		scheduleRepo,
		outboxRepo,
		staffClient,
	)

	// Initialize handlers
	catalogHandler := handler.NewCatalogHandler(catalogService)
	semesterHandler := handler.NewSemesterHandler(semesterService)

	// Initialize outbox worker
	outboxWorker := worker.NewOutboxWorker(
		outboxRepo,
		publisher,
		5*time.Second, // Poll every 5 seconds
		10,            // Process 10 events at a time
	)

	// Start outbox worker in background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go outboxWorker.Start(ctx)

	// Setup Gin router
	router := setupRouter(catalogHandler, semesterHandler, cfg.Server.Environment)

	// Start HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		logger.Info("server starting",
			zap.String("port", cfg.Server.Port),
		)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("failed to start server",
				zap.Error(err),
			)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	// Cancel outbox worker context
	cancel()

	// Shutdown HTTP server with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("server forced to shutdown",
			zap.Error(err),
		)
	}

	logger.Info("server exited")
}

func setupRouter(catalogHandler *handler.CatalogHandler, semesterHandler *handler.SemesterHandler, env string) *gin.Engine {
	if env == "production" {
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
			"service": "course-catalog-service",
		})
	})

	// API routes
	api := router.Group("/api")
	{
		// Catalog routes
		catalog := api.Group("/catalog")
		{
			// Public routes (will be protected with auth middleware later)
			catalog.GET("/courses", catalogHandler.ListCourses)              // Authenticated
			catalog.GET("/courses/:course_code", catalogHandler.GetCourseByCourseCode) // Authenticated
			catalog.POST("/courses", catalogHandler.CreateCourse)            // Admin
			catalog.PUT("/courses/:course_code", catalogHandler.UpdateCourse) // Admin
		}

		// Semester routes
		semesters := api.Group("/semesters")
		{
			// Semester course routes
			semesterCourses := semesters.Group("/:semester_id/courses")
			{
				semesterCourses.GET("", semesterHandler.ListSemesterCourses)       // Authenticated
				semesterCourses.GET("/:course_id", semesterHandler.GetSemesterCourseByID) // Authenticated
				semesterCourses.POST("", semesterHandler.CreateSemesterCourse)     // Admin
				semesterCourses.PUT("/:course_id", semesterHandler.UpdateSemesterCourse) // Admin
				semesterCourses.DELETE("/:course_id", semesterHandler.DeleteSemesterCourse) // Admin
			}
		}
	}

	// Protected routes (with JWT auth - to be added later)
	// protected := api.Group("")
	// protected.Use(sharedMiddleware.JWTAuth())
	// {
	//     protected.POST("/catalog/courses", catalogHandler.CreateCourse)
	//     protected.PUT("/catalog/courses/:course_code", catalogHandler.UpdateCourse)
	//     protected.POST("/semesters/:semester_id/courses", semesterHandler.CreateSemesterCourse)
	//     protected.PUT("/semesters/:semester_id/courses/:course_id", semesterHandler.UpdateSemesterCourse)
	//     protected.DELETE("/semesters/:semester_id/courses/:course_id", semesterHandler.DeleteSemesterCourse)
	// }

	return router
}

func setupRabbitMQ(conn *rabbitmq.Connection) error {
	channel := conn.Channel()

	// Declare course exchange
	if err := channel.ExchangeDeclare(
		"course.events", // name
		"topic",         // type
		true,            // durable
		false,           // auto-deleted
		false,           // internal
		false,           // no-wait
		nil,             // arguments
	); err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	logger.Info("RabbitMQ exchange declared",
		zap.String("exchange", "course.events"),
	)

	return nil
}
