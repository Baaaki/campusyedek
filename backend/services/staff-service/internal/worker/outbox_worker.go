package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/baaaki/mydreamcampus/shared/clock"
	"github.com/baaaki/mydreamcampus/shared/events"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	"github.com/baaaki/mydreamcampus/staff-service/internal/repository"
	"go.uber.org/zap"
)

type OutboxWorker struct {
	outboxRepo *repository.OutboxRepository
	publisher  *rabbitmq.Publisher
	interval   time.Duration
	batchSize  int32
}

func NewOutboxWorker(
	outboxRepo *repository.OutboxRepository,
	publisher *rabbitmq.Publisher,
	interval time.Duration,
	batchSize int32,
) *OutboxWorker {
	return &OutboxWorker{
		outboxRepo: outboxRepo,
		publisher:  publisher,
		interval:   interval,
		batchSize:  batchSize,
	}
}

// Start begins the outbox worker polling loop
func (w *OutboxWorker) Start(ctx context.Context) {
	logger.Info("starting outbox worker",
		zap.Duration("interval", w.interval),
		zap.Int32("batch_size", w.batchSize),
	)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	// Process immediately on start
	w.processEvents(ctx)

	for {
		select {
		case <-ctx.Done():
			logger.Info("stopping outbox worker")
			return
		case <-ticker.C:
			w.processEvents(ctx)
		}
	}
}

// processEvents retrieves and publishes unprocessed events
func (w *OutboxWorker) processEvents(ctx context.Context) {
	events, err := w.outboxRepo.GetUnprocessedEvents(ctx, w.batchSize)
	if err != nil {
		logger.Error("failed to get unprocessed events",
			zap.Error(err),
		)
		return
	}

	if len(events) == 0 {
		// Silently return when no events (avoid log spam)
		return
	}

	logger.Info("processing outbox events",
		zap.Int("count", len(events)),
	)

	successCount := 0
	failCount := 0

	for _, event := range events {
		eventID := fmt.Sprintf("%d", event.ID)

		// Parse payload to map for publishing
		var payload map[string]any
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			logger.Error("failed to unmarshal event payload",
				zap.Error(err),
				zap.String("event_id", eventID),
			)
			failCount++
			continue
		}

		// Determine routing key from event type using shared events constants
		routingKey := w.getRoutingKey(event.EventType)

		// Wrap payload with event metadata (required by auth service)
		eventMessage := map[string]any{
			"event_id":   eventID,
			"event_type": event.EventType,
			"timestamp":  clock.Now(),
			"data":       payload,
		}

		// Publish to RabbitMQ
		err := w.publisher.Publish(ctx, "staff.events", routingKey, eventMessage)
		if err != nil {
			logger.Error("failed to publish event",
				zap.Error(err),
				zap.String("event_id", eventID),
				zap.String("event_type", event.EventType),
				zap.String("routing_key", routingKey),
			)
			failCount++
			continue
		}

		// Mark event as processed
		err = w.outboxRepo.MarkEventProcessed(ctx, event.ID)
		if err != nil {
			logger.Error("failed to mark event as processed",
				zap.Error(err),
				zap.String("event_id", eventID),
			)
			failCount++
			continue
		}

		logger.Info("event published successfully",
			zap.String("event_id", eventID),
			zap.String("event_type", event.EventType),
		)
		successCount++
	}

	logger.Info("outbox processing completed",
		zap.Int("success", successCount),
		zap.Int("failed", failCount),
		zap.Int("total", len(events)),
	)
}

// getRoutingKey maps event type to routing key using shared events constants
func (w *OutboxWorker) getRoutingKey(eventType string) string {
	switch eventType {
	case events.EventStaffCreated:
		return events.RoutingKeyStaffCreated
	case events.EventStaffUpdated:
		return events.RoutingKeyStaffUpdated
	case events.EventStaffDeactivated:
		return events.RoutingKeyStaffDeactivated
	default:
		// Fallback to event type as routing key
		return eventType
	}
}
