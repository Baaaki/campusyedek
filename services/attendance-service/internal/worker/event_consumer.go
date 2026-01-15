package worker

import (
	"context"
	"encoding/json"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/db"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/dto"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/repository"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type EventConsumer struct {
	consumer  *rabbitmq.Consumer
	cacheRepo *repository.CacheRepository
	eventRepo *repository.EventRepository
}

func NewEventConsumer(
	consumer *rabbitmq.Consumer,
	cacheRepo *repository.CacheRepository,
	eventRepo *repository.EventRepository,
) *EventConsumer {
	return &EventConsumer{
		consumer:  consumer,
		cacheRepo: cacheRepo,
		eventRepo: eventRepo,
	}
}

func (w *EventConsumer) Start(ctx context.Context) error {
	logger.Info("Event consumer started")

	// Start consuming from the queue
	if err := w.consumer.Consume("attendance.events", w.handleMessage); err != nil {
		logger.Error("failed to start consuming", zap.Error(err))
		return err
	}

	go func() {
		<-ctx.Done()
		logger.Info("Event consumer stopped")
	}()

	return nil
}

func (w *EventConsumer) handleMessage(body []byte) error {
	var event dto.BaseEvent
	if err := json.Unmarshal(body, &event); err != nil {
		logger.Error("failed to unmarshal event", zap.Error(err))
		return err
	}

	ctx := context.Background()

	// Check if already processed (idempotency)
	eventID, err := uuid.Parse(event.EventID.String())
	if err != nil {
		logger.Error("invalid event ID", zap.Error(err))
		return err
	}

	processed, err := w.eventRepo.IsEventProcessed(ctx, eventID)
	if err != nil {
		logger.Error("failed to check if event processed", zap.Error(err))
		return err
	}

	if processed {
		logger.Debug("event already processed, skipping", zap.String("event_id", eventID.String()))
		return nil
	}

	logger.Info("processing event",
		zap.String("type", event.EventType),
		zap.String("event_id", eventID.String()),
	)

	// Route to appropriate handler based on event type
	switch event.EventType {
	case "student.created":
		return w.handleStudentCreated(ctx, body, eventID)
	case "student.updated":
		return w.handleStudentUpdated(ctx, body, eventID)
	case "student.deactivated":
		return w.handleStudentDeactivated(ctx, body, eventID)
	case "course_semester.created":
		return w.handleCourseSemesterCreated(ctx, body, eventID)
	case "course_semester.updated":
		return w.handleCourseSemesterUpdated(ctx, body, eventID)
	case "course_semester.deleted":
		return w.handleCourseSemesterDeleted(ctx, body, eventID)
	case "enrollment_program.approved":
		return w.handleEnrollmentProgramApproved(ctx, body, eventID)
	default:
		logger.Warn("unknown event type", zap.String("type", event.EventType))
		// Mark as processed anyway to avoid reprocessing
		return w.eventRepo.MarkEventProcessed(ctx, eventID, event.EventType)
	}
}

func (w *EventConsumer) handleStudentCreated(ctx context.Context, body []byte, eventID uuid.UUID) error {
	var eventData dto.StudentCreatedEventData
	if err := json.Unmarshal(body, &eventData); err != nil {
		return err
	}

	// Upsert student to cache
	err := w.cacheRepo.UpsertStudentCache(ctx, db.UpsertStudentCacheParams{
		ID:            utils.UUIDToPgUUID(eventData.StudentID),
		StudentNumber: eventData.StudentNumber,
		FirstName:     utils.StringToPgText(eventData.FirstName),
		LastName:      utils.StringToPgText(eventData.LastName),
		Email:         utils.StringToPgText(eventData.Email),
		Department:    utils.StringToPgText(eventData.Department),
		IsActive:      utils.BoolToPgBool(true),
	})
	if err != nil {
		logger.Error("failed to upsert student cache", zap.Error(err))
		return err
	}

	logger.Info("student cache created",
		zap.String("student_id", eventData.StudentID.String()),
		zap.String("student_number", eventData.StudentNumber),
	)

	return w.eventRepo.MarkEventProcessed(ctx, eventID, "student.created")
}

func (w *EventConsumer) handleStudentUpdated(ctx context.Context, body []byte, eventID uuid.UUID) error {
	var eventData dto.StudentUpdatedEventData
	if err := json.Unmarshal(body, &eventData); err != nil {
		return err
	}

	// Upsert student to cache
	err := w.cacheRepo.UpsertStudentCache(ctx, db.UpsertStudentCacheParams{
		ID:            utils.UUIDToPgUUID(eventData.StudentID),
		StudentNumber: eventData.StudentNumber,
		FirstName:     utils.StringToPgText(eventData.FirstName),
		LastName:      utils.StringToPgText(eventData.LastName),
		Email:         utils.StringToPgText(eventData.Email),
		Department:    utils.StringToPgText(eventData.Department),
		IsActive:      utils.BoolToPgBool(true),
	})
	if err != nil {
		logger.Error("failed to upsert student cache", zap.Error(err))
		return err
	}

	logger.Info("student cache updated",
		zap.String("student_id", eventData.StudentID.String()),
		zap.String("student_number", eventData.StudentNumber),
	)

	return w.eventRepo.MarkEventProcessed(ctx, eventID, "student.updated")
}

func (w *EventConsumer) handleStudentDeactivated(ctx context.Context, body []byte, eventID uuid.UUID) error {
	var eventData dto.StudentDeactivatedEventData
	if err := json.Unmarshal(body, &eventData); err != nil {
		return err
	}

	// Deactivate student in cache
	if err := w.cacheRepo.DeactivateStudentCache(ctx, eventData.StudentID); err != nil {
		logger.Error("failed to deactivate student cache", zap.Error(err))
		return err
	}

	logger.Info("student cache deactivated", zap.String("student_id", eventData.StudentID.String()))

	return w.eventRepo.MarkEventProcessed(ctx, eventID, "student.deactivated")
}

func (w *EventConsumer) handleCourseSemesterCreated(ctx context.Context, body []byte, eventID uuid.UUID) error {
	var eventData dto.CourseSemesterCreatedEventData
	if err := json.Unmarshal(body, &eventData); err != nil {
		return err
	}

	// Upsert course to cache
	err := w.cacheRepo.UpsertCourseCache(ctx, db.UpsertCourseCacheParams{
		ID:                 utils.UUIDToPgUUID(eventData.CourseID),
		CourseCode:         eventData.CourseCode,
		CourseName:         eventData.CourseName,
		Credits:            eventData.Credits,
		Semester:           eventData.Semester,
		Department:         utils.StringToPgText(eventData.Department),
		InstructorID:       utils.UUIDToPgUUID(eventData.InstructorID),
		InstructorFullname: utils.StringToPgText(eventData.InstructorName),
		TotalWeeks:         utils.Int16ToPgInt2(eventData.TotalWeeks),
	})
	if err != nil {
		logger.Error("failed to upsert course cache", zap.Error(err))
		return err
	}

	logger.Info("course cache created",
		zap.String("course_id", eventData.CourseID.String()),
		zap.String("course_code", eventData.CourseCode),
	)

	return w.eventRepo.MarkEventProcessed(ctx, eventID, "course_semester.created")
}

func (w *EventConsumer) handleCourseSemesterUpdated(ctx context.Context, body []byte, eventID uuid.UUID) error {
	var eventData dto.CourseSemesterUpdatedEventData
	if err := json.Unmarshal(body, &eventData); err != nil {
		return err
	}

	// Upsert course to cache
	err := w.cacheRepo.UpsertCourseCache(ctx, db.UpsertCourseCacheParams{
		ID:                 utils.UUIDToPgUUID(eventData.CourseID),
		CourseCode:         eventData.CourseCode,
		CourseName:         eventData.CourseName,
		Credits:            eventData.Credits,
		Semester:           eventData.Semester,
		Department:         utils.StringToPgText(eventData.Department),
		InstructorID:       utils.UUIDToPgUUID(eventData.InstructorID),
		InstructorFullname: utils.StringToPgText(eventData.InstructorName),
		TotalWeeks:         utils.Int16ToPgInt2(eventData.TotalWeeks),
	})
	if err != nil {
		logger.Error("failed to upsert course cache", zap.Error(err))
		return err
	}

	logger.Info("course cache updated",
		zap.String("course_id", eventData.CourseID.String()),
		zap.String("course_code", eventData.CourseCode),
	)

	return w.eventRepo.MarkEventProcessed(ctx, eventID, "course_semester.updated")
}

func (w *EventConsumer) handleCourseSemesterDeleted(ctx context.Context, body []byte, eventID uuid.UUID) error {
	var eventData dto.CourseSemesterDeletedEventData
	if err := json.Unmarshal(body, &eventData); err != nil {
		return err
	}

	// Delete course from cache
	if err := w.cacheRepo.DeleteCourseCache(ctx, eventData.CourseID); err != nil {
		logger.Error("failed to delete course cache", zap.Error(err))
		return err
	}

	logger.Info("course cache deleted",
		zap.String("course_id", eventData.CourseID.String()),
		zap.String("course_code", eventData.CourseCode),
	)

	return w.eventRepo.MarkEventProcessed(ctx, eventID, "course_semester.deleted")
}

func (w *EventConsumer) handleEnrollmentProgramApproved(ctx context.Context, body []byte, eventID uuid.UUID) error {
	var eventData dto.EnrollmentProgramApprovedEventData
	if err := json.Unmarshal(body, &eventData); err != nil {
		return err
	}

	// Create enrollment cache entries for each course
	for _, course := range eventData.Courses {
		err := w.cacheRepo.CreateEnrollmentCache(
			ctx,
			eventData.StudentID,
			course.CourseID,
			eventData.Semester,
		)
		if err != nil {
			logger.Error("failed to create enrollment cache",
				zap.String("student_id", eventData.StudentID.String()),
				zap.String("course_id", course.CourseID.String()),
				zap.Error(err),
			)
			// Continue with other courses
			continue
		}

		logger.Info("enrollment cache created",
			zap.String("student_id", eventData.StudentID.String()),
			zap.String("course_id", course.CourseID.String()),
			zap.String("semester", eventData.Semester),
		)
	}

	return w.eventRepo.MarkEventProcessed(ctx, eventID, "enrollment_program.approved")
}
