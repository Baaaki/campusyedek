package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/baaaki/mydreamcampus/attendance-service/config"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/handler"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/repository"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/service"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/worker"
	"github.com/baaaki/mydreamcampus/shared/database"
	"github.com/baaaki/mydreamcampus/shared/logger"
	sharedMiddleware "github.com/baaaki/mydreamcampus/shared/middleware"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
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

	logger.Info("starting attendance-service",
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

	// Initialize Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	defer redisClient.Close()

	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		logger.Fatal("failed to connect to Redis", zap.Error(err))
	}

	logger.Info("Redis connection established")

	// Initialize RabbitMQ
	rabbitConn, err := rabbitmq.NewConnection(cfg.RabbitMQ.URL)
	if err != nil {
		logger.Fatal("failed to connect to RabbitMQ", zap.Error(err))
	}
	defer rabbitConn.Close()

	logger.Info("RabbitMQ connection established")

	// Setup RabbitMQ
	if err := setupRabbitMQ(rabbitConn); err != nil {
		logger.Fatal("failed to setup RabbitMQ", zap.Error(err))
	}

	// Initialize publisher and consumer
	publisher := rabbitmq.NewPublisher(rabbitConn)
	consumer := rabbitmq.NewConsumer(rabbitConn)

	// Initialize repositories
	cacheRepo := repository.NewCacheRepository(pool)
	sessionRepo := repository.NewSessionRepository(pool)
	attendanceRepo := repository.NewAttendanceRepository(pool)
	outboxRepo := repository.NewOutboxRepository(pool)
	eventRepo := repository.NewEventRepository(pool)

	// Initialize services
	qrService := service.NewQRService()
	redisService := service.NewRedisService(redisClient)
	attendanceService := service.NewAttendanceService(
		cacheRepo,
		sessionRepo,
		attendanceRepo,
		outboxRepo,
		qrService,
		redisService,
	)

	// Initialize handlers
	attendanceHandler := handler.NewAttendanceHandler(attendanceService)

	// Initialize workers
	outboxWorker := worker.NewOutboxWorker(outboxRepo, publisher)
	eventConsumer := worker.NewEventConsumer(consumer, cacheRepo, eventRepo)
	bufferFlusher := worker.NewBufferFlusher(attendanceRepo, redisService)
	sessionExpiryHandler := worker.NewSessionExpiryHandler(sessionRepo, attendanceRepo, cacheRepo, redisService)

	// Start workers
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go outboxWorker.Start(ctx)
	go eventConsumer.Start(ctx)
	go bufferFlusher.Start(ctx)
	go sessionExpiryHandler.Start(ctx)

	// Setup HTTP server
	router := setupRouter(cfg, attendanceHandler)

	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// Start server
	go func() {
		logger.Info("server starting", zap.String("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("failed to start server", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	logger.Info("server exited")
}

func setupRouter(cfg *config.Config, attendanceHandler *handler.AttendanceHandler) *gin.Engine {
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(gin.Recovery())
	router.Use(sharedMiddleware.RequestLogger())
	router.Use(sharedMiddleware.CORS())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "attendance-service"})
	})

	// API routes
	api := router.Group("/api/v1/attendance")

	// Auth middleware for protected routes
	authMiddleware := sharedMiddleware.JWTAuth()

	// Public routes (with auth)
	api.POST("/scan", authMiddleware, sharedMiddleware.RequireRole("student"), attendanceHandler.ScanQR)

	// Instructor routes
	api.POST("/sessions", authMiddleware, sharedMiddleware.RequireRole("teacher"), attendanceHandler.CreateSession)
	api.GET("/sessions/:sessionId/qr", authMiddleware, sharedMiddleware.RequireRole("teacher"), attendanceHandler.GetQRCode)
	api.POST("/sessions/:sessionId/manual", authMiddleware, sharedMiddleware.RequireRole("teacher"), attendanceHandler.CreateManualAttendance)
	api.POST("/sessions/:sessionId/close", authMiddleware, sharedMiddleware.RequireRole("teacher"), attendanceHandler.CloseSession)
	api.POST("/courses/:courseId/finalize", authMiddleware, sharedMiddleware.RequireRole("teacher"), attendanceHandler.FinalizeAttendance)

	// Student routes
	api.GET("/my", authMiddleware, sharedMiddleware.RequireRole("student"), attendanceHandler.GetMyAttendance)

	return router
}

func setupRabbitMQ(conn *rabbitmq.Connection) error {
	ch := conn.Channel()
	// Channel() returns non-nil pointer, no error

	// Declare exchanges
	exchanges := []string{"student.events", "course.events", "enrollment.events", "attendance.events"}
	for _, exchange := range exchanges {
		if err := ch.ExchangeDeclare(exchange, "topic", true, false, false, false, nil); err != nil {
			return err
		}
	}

	return nil
}
