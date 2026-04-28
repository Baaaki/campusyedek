package worker

import (
	"context"
	"encoding/json"
	"time"

	"github.com/baaaki/mydreamcampus/shared/events"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	"github.com/baaaki/mydreamcampus/shared/utils"
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

// processEvents retrieves and publishes pending events
func (w *OutboxWorker) processEvents(ctx context.Context) {
	pendingEvents, err := w.outboxRepo.GetPendingEvents(ctx, w.batchSize)
	if err != nil {
		logger.Error("failed to get pending events",
			zap.Error(err),
		)
		return
	}

	if len(pendingEvents) == 0 {
		return
	}

	logger.Info("processing outbox events",
		zap.Int("count", len(pendingEvents)),
	)

	successCount := 0
	failCount := 0

	for _, event := range pendingEvents {
		eventID := utils.PgtypeToUUIDString(event.ID)

		// Parse payload to map for publishing
		var payload map[string]any
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			logger.Error("failed to unmarshal event payload",
				zap.Error(err),
				zap.String("event_id", eventID),
			)
			w.outboxRepo.MarkEventFailed(ctx, utils.PgtypeToUUID(event.ID), err.Error())
			failCount++
			continue
		}

		// Determine routing key from event type using shared events constants
		routingKey := w.getRoutingKey(event.EventType)

		// Wrap payload with event metadata (required by auth service)
		eventMessage := map[string]any{
			"event_id":   eventID,
			"event_type": event.EventType,
			"timestamp":  event.CreatedAt.Time,
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
			w.outboxRepo.MarkEventFailed(ctx, utils.PgtypeToUUID(event.ID), err.Error())
			failCount++
			continue
		}

		// Mark event as processed
		err = w.outboxRepo.MarkEventProcessed(ctx, utils.PgtypeToUUID(event.ID))
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
		zap.Int("total", len(pendingEvents)),
	)

	// Process failed events that can be retried
	w.processFailedEvents(ctx)
}

// processFailedEvents retries failed events
func (w *OutboxWorker) processFailedEvents(ctx context.Context) {
	failedEvents, err := w.outboxRepo.GetFailedEvents(ctx, w.batchSize)
	if err != nil {
		logger.Error("failed to get failed events",
			zap.Error(err),
		)
		return
	}

	if len(failedEvents) == 0 {
		return
	}

	logger.Info("retrying failed events",
		zap.Int("count", len(failedEvents)),
	)

	for _, event := range failedEvents {
		eventID := utils.PgtypeToUUIDString(event.ID)

		// Check if max retries exceeded
		if event.RetryCount.Int16 >= event.MaxRetries.Int16 {
			logger.Warn("max retries exceeded for event",
				zap.String("event_id", eventID),
				zap.Int16("retry_count", event.RetryCount.Int16),
			)
			continue
		}

		// Reset to pending for retry
		err := w.outboxRepo.ResetFailedEvent(ctx, utils.PgtypeToUUID(event.ID))
		if err != nil {
			logger.Error("failed to reset failed event",
				zap.Error(err),
				zap.String("event_id", eventID),
			)
			continue
		}

		logger.Info("event reset for retry",
			zap.String("event_id", eventID),
			zap.Int16("retry_count", event.RetryCount.Int16),
		)
	}
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
