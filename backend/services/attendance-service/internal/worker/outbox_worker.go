package worker

import (
	"context"
	"encoding/json"
	"time"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/repository"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	"go.uber.org/zap"
)

type OutboxWorker struct {
	outboxRepo *repository.OutboxRepository
	publisher  *rabbitmq.Publisher
}

func NewOutboxWorker(outboxRepo *repository.OutboxRepository, publisher *rabbitmq.Publisher) *OutboxWorker {
	return &OutboxWorker{
		outboxRepo: outboxRepo,
		publisher:  publisher,
	}
}

func (w *OutboxWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	logger.Info("Outbox worker started")

	for {
		select {
		case <-ctx.Done():
			logger.Info("Outbox worker stopped")
			return
		case <-ticker.C:
			w.processEvents(ctx)
		}
	}
}

func (w *OutboxWorker) processEvents(ctx context.Context) {
	events, err := w.outboxRepo.GetPendingOutboxEvents(ctx, 100)
	if err != nil {
		logger.Error("failed to get pending outbox events", zap.Error(err))
		return
	}

	for _, event := range events {
		var payload interface{}
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			logger.Error("failed to unmarshal payload", zap.Error(err))
			w.outboxRepo.MarkOutboxEventFailed(ctx, event.ID, err.Error())
			continue
		}

		if err := w.publisher.Publish(ctx, "attendance.events", event.RoutingKey, payload); err != nil {
			logger.Error("failed to publish event", zap.Error(err), zap.String("routing_key", event.RoutingKey))
			w.outboxRepo.MarkOutboxEventFailed(ctx, event.ID, err.Error())
		} else {
			w.outboxRepo.MarkOutboxEventProcessed(ctx, event.ID)
			logger.Debug("event published", zap.String("routing_key", event.RoutingKey))
		}
	}
}
