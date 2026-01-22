package worker

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/baaaki/mydreamcampus/enrollment-service/internal/dto"
	"github.com/baaaki/mydreamcampus/enrollment-service/internal/repository"
	"github.com/baaaki/mydreamcampus/enrollment-service/internal/service"
	"github.com/baaaki/mydreamcampus/shared/events"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	"go.uber.org/zap"
)

type EventConsumer struct {
	consumer            *rabbitmq.Consumer
	eventService        *service.EventService
	processedEventsRepo *repository.ProcessedEventsRepository
}

func NewEventConsumer(
	consumer *rabbitmq.Consumer,
	eventService *service.EventService,
	processedEventsRepo *repository.ProcessedEventsRepository,
) *EventConsumer {
	return &EventConsumer{
		consumer:            consumer,
		eventService:        eventService,
		processedEventsRepo: processedEventsRepo,
	}
}

// Start begins consuming events from RabbitMQ
func (c *EventConsumer) Start(ctx context.Context) error {
	logger.Info("starting event consumer")

	// Consume enrollment events (both course and student events)
	// Use a combined queue name for enrollment service
	err := c.consumer.Consume("enrollment.events", func(msg []byte) error {
		return c.handleMessage(ctx, msg)
	})
	if err != nil {
		return fmt.Errorf("failed to start consuming: %w", err)
	}

	logger.Info("event consumer started successfully")
	return nil
}

// handleMessage processes incoming messages
func (c *EventConsumer) handleMessage(ctx context.Context, msgBody []byte) error {
	logger.Info("received event")

	// Parse generic event to get event_id
	var genericEvent dto.BaseEvent
	if err := json.Unmarshal(msgBody, &genericEvent); err != nil {
		logger.Error("failed to unmarshal event",
			zap.Error(err),
		)
		return err // Don't requeue malformed messages
	}

	// Check if event already processed (idempotency)
	processed, err := c.processedEventsRepo.IsEventProcessed(ctx, genericEvent.EventID)
	if err != nil {
		logger.Error("failed to check event processing status",
			zap.Error(err),
			zap.String("event_id", genericEvent.EventID.String()),
		)
		return err // Requeue for retry
	}

	if processed {
		logger.Info("event already processed, skipping",
			zap.String("event_id", genericEvent.EventID.String()),
			zap.String("event_type", genericEvent.EventType),
		)
		return nil
	}

	// Route to appropriate handler based on event type
	switch genericEvent.EventType {
	// Course semester events
	case events.EventCourseSemesterCreated:
		return c.handleCourseSemesterCreated(ctx, msgBody, genericEvent.EventID.String())
	case events.EventCourseSemesterUpdated:
		return c.handleCourseSemesterUpdated(ctx, msgBody, genericEvent.EventID.String())
	case events.EventCourseSemesterDeleted:
		return c.handleCourseSemesterDeleted(ctx, msgBody, genericEvent.EventID.String())

	// Student events
	case events.EventStudentCreated:
		return c.handleStudentCreated(ctx, msgBody, genericEvent.EventID.String())
	case events.EventStudentUpdated:
		return c.handleStudentUpdated(ctx, msgBody, genericEvent.EventID.String())
	case events.EventStudentDeleted:
		return c.handleStudentDeactivated(ctx, msgBody, genericEvent.EventID.String())

	default:
		logger.Warn("unknown event type",
			zap.String("event_type", genericEvent.EventType),
		)
		return nil // Acknowledge unknown events to avoid DLQ
	}
}

// handleCourseSemesterCreated handles course.semester.created events
func (c *EventConsumer) handleCourseSemesterCreated(ctx context.Context, msgBody []byte, eventID string) error {
	var event dto.CourseSemesterCreatedEvent
	if err := json.Unmarshal(msgBody, &event); err != nil {
		logger.Error("failed to unmarshal course.semester.created event",
			zap.Error(err),
		)
		return err
	}

	logger.Info("processing course.semester.created event",
		zap.String("event_id", eventID),
		zap.String("course_id", event.SemesterCourseID.String()),
	)

	err := c.eventService.HandleCourseSemesterCreated(ctx, event)
	if err != nil {
		logger.Error("failed to process course.semester.created event",
			zap.Error(err),
			zap.String("course_id", event.SemesterCourseID.String()),
		)
		return err // Requeue for retry
	}

	logger.Info("course.semester.created event processed successfully",
		zap.String("event_id", eventID),
	)

	return nil
}

// handleCourseSemesterUpdated handles course.semester.updated events
func (c *EventConsumer) handleCourseSemesterUpdated(ctx context.Context, msgBody []byte, eventID string) error {
	var event dto.CourseSemesterUpdatedEvent
	if err := json.Unmarshal(msgBody, &event); err != nil {
		logger.Error("failed to unmarshal course.semester.updated event",
			zap.Error(err),
		)
		return err
	}

	logger.Info("processing course.semester.updated event",
		zap.String("event_id", eventID),
		zap.String("course_id", event.SemesterCourseID.String()),
	)

	err := c.eventService.HandleCourseSemesterUpdated(ctx, event)
	if err != nil {
		logger.Error("failed to process course.semester.updated event",
			zap.Error(err),
			zap.String("course_id", event.SemesterCourseID.String()),
		)
		return err
	}

	logger.Info("course.semester.updated event processed successfully",
		zap.String("event_id", eventID),
	)

	return nil
}

// handleCourseSemesterDeleted handles course.semester.deleted events
func (c *EventConsumer) handleCourseSemesterDeleted(ctx context.Context, msgBody []byte, eventID string) error {
	var event dto.CourseSemesterDeletedEvent
	if err := json.Unmarshal(msgBody, &event); err != nil {
		logger.Error("failed to unmarshal course.semester.deleted event",
			zap.Error(err),
		)
		return err
	}

	logger.Info("processing course.semester.deleted event",
		zap.String("event_id", eventID),
		zap.String("course_id", event.SemesterCourseID.String()),
	)

	err := c.eventService.HandleCourseSemesterDeleted(ctx, event)
	if err != nil {
		logger.Error("failed to process course.semester.deleted event",
			zap.Error(err),
			zap.String("course_id", event.SemesterCourseID.String()),
		)
		return err
	}

	logger.Info("course.semester.deleted event processed successfully",
		zap.String("event_id", eventID),
	)

	return nil
}

// handleStudentCreated handles student.created events
func (c *EventConsumer) handleStudentCreated(ctx context.Context, msgBody []byte, eventID string) error {
	var event dto.StudentCreatedEvent
	if err := json.Unmarshal(msgBody, &event); err != nil {
		logger.Error("failed to unmarshal student.created event",
			zap.Error(err),
		)
		return err
	}

	logger.Info("processing student.created event",
		zap.String("event_id", eventID),
		zap.String("student_id", event.StudentID.String()),
	)

	err := c.eventService.HandleStudentCreated(ctx, event)
	if err != nil {
		logger.Error("failed to process student.created event",
			zap.Error(err),
			zap.String("student_id", event.StudentID.String()),
		)
		return err
	}

	logger.Info("student.created event processed successfully",
		zap.String("event_id", eventID),
	)

	return nil
}

// handleStudentUpdated handles student.updated events
func (c *EventConsumer) handleStudentUpdated(ctx context.Context, msgBody []byte, eventID string) error {
	var event dto.StudentUpdatedEvent
	if err := json.Unmarshal(msgBody, &event); err != nil {
		logger.Error("failed to unmarshal student.updated event",
			zap.Error(err),
		)
		return err
	}

	logger.Info("processing student.updated event",
		zap.String("event_id", eventID),
		zap.String("student_id", event.StudentID.String()),
	)

	err := c.eventService.HandleStudentUpdated(ctx, event)
	if err != nil {
		logger.Error("failed to process student.updated event",
			zap.Error(err),
			zap.String("student_id", event.StudentID.String()),
		)
		return err
	}

	logger.Info("student.updated event processed successfully",
		zap.String("event_id", eventID),
	)

	return nil
}

// handleStudentDeactivated handles student.deleted events
func (c *EventConsumer) handleStudentDeactivated(ctx context.Context, msgBody []byte, eventID string) error {
	var event dto.StudentDeactivatedEvent
	if err := json.Unmarshal(msgBody, &event); err != nil {
		logger.Error("failed to unmarshal student.deleted event",
			zap.Error(err),
		)
		return err
	}

	logger.Info("processing student.deleted event",
		zap.String("event_id", eventID),
		zap.String("student_id", event.StudentID.String()),
	)

	err := c.eventService.HandleStudentDeactivated(ctx, event)
	if err != nil {
		logger.Error("failed to process student.deleted event",
			zap.Error(err),
			zap.String("student_id", event.StudentID.String()),
		)
		return err
	}

	logger.Info("student.deleted event processed successfully",
		zap.String("event_id", eventID),
	)

	return nil
}
