package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/baaaki/mydreamcampus/meal-service/config"
	"github.com/baaaki/mydreamcampus/meal-service/internal/handler"
	"github.com/baaaki/mydreamcampus/meal-service/internal/repository"
	"github.com/baaaki/mydreamcampus/meal-service/internal/service"
	"github.com/baaaki/mydreamcampus/meal-service/internal/worker"
	sharedDB "github.com/baaaki/mydreamcampus/shared/database"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/middleware"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("Failed to load config: %v", err))
	}

	// Initialize logger
	logger.MustInit(cfg.Server.Environment)
	log := logger.Log
	defer logger.Sync()

	log.Info("starting meal service",
		zap.String("environment", cfg.Server.Environment),
		zap.String("port", cfg.Server.Port),
	)

	// Initialize database
	ctx := context.Background()
	dbPool, err := sharedDB.NewPostgresPool(cfg.Database.URL)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer dbPool.Close()

	log.Info("connected to database")

	// Initialize repositories
	cafeteriaRepo := repository.NewCafeteriaRepository(dbPool)
	reservationRepo := repository.NewReservationRepository(dbPool)
	studentCacheRepo := repository.NewStudentCacheRepository(dbPool)
	menuRepo := repository.NewMenuRepository(dbPool)
	outboxRepo := repository.NewOutboxRepository(dbPool)
	processedEventsRepo := repository.NewProcessedEventsRepository(dbPool)

	// Initialize RabbitMQ
	rabbitConn, err := rabbitmq.NewConnection(cfg.RabbitMQ.URL)
	if err != nil {
		log.Fatal("failed to connect to RabbitMQ", zap.Error(err))
	}
	defer rabbitConn.Close()

	log.Info("connected to RabbitMQ")

	// Initialize publisher
	publisher := rabbitmq.NewPublisher(rabbitConn)

	// Initialize services
	paymentClient := service.NewPaymentClient(cfg.Payment.ServiceURL, log)
	cafeteriaService := service.NewCafeteriaService(cafeteriaRepo, log)
	reservationService := service.NewReservationService(
		reservationRepo,
		cafeteriaRepo,
		studentCacheRepo,
		paymentClient,
		cfg,
		log,
	)
	menuService := service.NewMenuService(menuRepo, log)

	// Initialize handler
	mealHandler := handler.NewMealHandler(cafeteriaService, reservationService, menuService, log)

	// Initialize background workers
	reservationWorker := worker.NewReservationWorker(reservationRepo, log)
	outboxWorker := worker.NewOutboxWorker(
		outboxRepo,
		publisher,
		cfg.Outbox.PollIntervalSeconds,
		cfg.Outbox.BatchSize,
		cfg.Outbox.MaxRetries,
		log,
	)

	// Start background workers
	reservationWorker.Start(ctx)
	outboxWorker.Start(ctx)

	// Initialize event consumers
	studentConsumer := worker.NewStudentEventConsumer(studentCacheRepo, processedEventsRepo, log)
	paymentConsumer := worker.NewPaymentEventConsumer(reservationRepo, processedEventsRepo, log)

	// Setup RabbitMQ consumers
	setupConsumers(rabbitConn, studentConsumer, paymentConsumer, log)

	// Setup HTTP server
	router := setupRouter(cfg, mealHandler, log)

	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// Start HTTP server in goroutine
	go func() {
		log.Info("starting HTTP server", zap.String("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("failed to start HTTP server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down server...")

	// Stop workers
	reservationWorker.Stop()
	outboxWorker.Stop()

	// Graceful shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("server forced to shutdown", zap.Error(err))
	}

	log.Info("server exited")
}

func setupRouter(cfg *config.Config, handler *handler.MealHandler, log *zap.Logger) *gin.Engine {
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global middleware
	router.Use(middleware.Recovery())
	router.Use(middleware.RequestLogger())
	router.Use(middleware.CORS())

	// Health check
	router.GET("/health", handler.Health)

	// API routes
	api := router.Group("/api/meals")
	{
		// Public routes (no auth required, not protected by Traefik forward-auth)
		api.GET("/menu/monthly", handler.GetMonthlyMenu)

		// Authenticated routes - protected via Traefik forward-auth
		// User info is extracted from X-User-* headers set by Traefik
		auth := api.Group("")
		auth.Use(middleware.ExtractUserFromHeaders())
		{
			// Cafeterias (all authenticated users can view)
			auth.GET("/cafeterias", handler.GetCafeterias)

			// Admin only routes
			admin := auth.Group("")
			admin.Use(middleware.RequireAdmin())
			{
				admin.POST("/cafeterias", handler.CreateCafeteria)
				admin.PUT("/cafeterias/:cafeteria_id", handler.UpdateCafeteria)
				admin.DELETE("/cafeterias/:cafeteria_id", handler.DeleteCafeteria)
				admin.GET("/cafeterias/:cafeteria_id/qr", handler.GenerateQR)
				admin.POST("/menu/monthly", handler.CreateMonthlyMenu)
			}

			// Student only routes
			student := auth.Group("")
			student.Use(middleware.RequireStudent())
			{
				student.POST("/reservations", handler.CreateReservation)
				student.POST("/reservations/batch", handler.CreateBatchReservation)
				student.GET("/reservations/my", handler.GetMyReservations)
				student.DELETE("/reservations/:reservation_id", handler.CancelReservation)
				student.POST("/reservations/use", handler.UseReservation)
			}
		}
	}

	return router
}

func setupConsumers(
	conn *rabbitmq.Connection,
	studentConsumer *worker.StudentEventConsumer,
	paymentConsumer *worker.PaymentEventConsumer,
	log *zap.Logger,
) {
	// Student events consumer
	studentEventsConsumer := rabbitmq.NewConsumer(conn)

	// Declare queue
	if err := studentEventsConsumer.DeclareQueue("meal.student.events.queue"); err != nil {
		log.Fatal("failed to declare student events queue", zap.Error(err))
	}

	// Bind routing keys
	studentEventsConsumer.BindQueue("meal.student.events.queue", "student.events", "student.created")
	studentEventsConsumer.BindQueue("meal.student.events.queue", "student.events", "student.updated")
	studentEventsConsumer.BindQueue("meal.student.events.queue", "student.events", "student.deactivated")

	// Consume messages
	studentEventsConsumer.Consume("meal.student.events.queue", func(body []byte) error {
		// We need to determine the routing key from the message content
		// For simplicity, we'll try all handlers
		var event struct {
			EventType string `json:"event_type"`
		}
		if err := rabbitmq.UnmarshalEvent(body, &event); err != nil {
			return err
		}

		switch event.EventType {
		case "student.created":
			return studentConsumer.HandleStudentCreated(context.Background(), body)
		case "student.updated":
			return studentConsumer.HandleStudentUpdated(context.Background(), body)
		case "student.deactivated":
			return studentConsumer.HandleStudentDeactivated(context.Background(), body)
		default:
			log.Warn("unknown event type", zap.String("event_type", event.EventType))
			return nil
		}
	})

	// Payment events consumer
	paymentEventsConsumer := rabbitmq.NewConsumer(conn)

	// Declare queue
	if err := paymentEventsConsumer.DeclareQueue("meal.payment.events.queue"); err != nil {
		log.Fatal("failed to declare payment events queue", zap.Error(err))
	}

	// Bind routing keys
	paymentEventsConsumer.BindQueue("meal.payment.events.queue", "payment.events", "payment.completed")
	paymentEventsConsumer.BindQueue("meal.payment.events.queue", "payment.events", "payment.failed")

	// Consume messages
	paymentEventsConsumer.Consume("meal.payment.events.queue", func(body []byte) error {
		var event struct {
			EventType string `json:"event_type"`
		}
		if err := rabbitmq.UnmarshalEvent(body, &event); err != nil {
			return err
		}

		switch event.EventType {
		case "payment.completed":
			return paymentConsumer.HandlePaymentCompleted(context.Background(), body)
		case "payment.failed":
			return paymentConsumer.HandlePaymentFailed(context.Background(), body)
		default:
			log.Warn("unknown event type", zap.String("event_type", event.EventType))
			return nil
		}
	})

	log.Info("RabbitMQ consumers started")
}
