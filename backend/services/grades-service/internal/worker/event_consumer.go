package worker

import (
	"context"
	"encoding/json"

	"github.com/baaaki/mydreamcampus/grades-service/internal/db"
	"github.com/baaaki/mydreamcampus/grades-service/internal/dto"
	"github.com/baaaki/mydreamcampus/grades-service/internal/repository"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/rabbitmq"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"go.uber.org/zap"
)

type EventConsumer struct {
	consumer  *rabbitmq.Consumer
	cacheRepo *repository.CacheRepository
	regRepo   *repository.RegistrationRepository
}

func NewEventConsumer(
	consumer *rabbitmq.Consumer,
	cacheRepo *repository.CacheRepository,
	regRepo *repository.RegistrationRepository,
) *EventConsumer {
	return &EventConsumer{
		consumer:  consumer,
		cacheRepo: cacheRepo,
		regRepo:   regRepo,
	}
}

func (w *EventConsumer) Start(ctx context.Context) error {
	logger.Info("starting event consumer")

	// Setup student events queue
	studentQueue := "grades-service-student"
	if err := w.consumer.DeclareQueue(studentQueue); err != nil {
		return err
	}
	studentRoutingKeys := []string{
		"student.created",
		"student.updated",
		"student.deactivated",
	}
	for _, key := range studentRoutingKeys {
		if err := w.consumer.BindQueue(studentQueue, "student.events", key); err != nil {
			return err
		}
	}
	if err := w.consumer.Consume(studentQueue, w.handleStudentEvent); err != nil {
		return err
	}

	// Setup course events queue
	courseQueue := "grades-service-course"
	if err := w.consumer.DeclareQueue(courseQueue); err != nil {
		return err
	}
	courseRoutingKeys := []string{
		"course.semester.created",
		"course.semester.updated",
		"course.semester.deleted",
		"course.instructor.changed",
		"course.prerequisites.updated",
	}
	for _, key := range courseRoutingKeys {
		if err := w.consumer.BindQueue(courseQueue, "course.events", key); err != nil {
			return err
		}
	}
	if err := w.consumer.Consume(courseQueue, w.handleCourseEvent); err != nil {
		return err
	}

	// Setup enrollment events queue
	enrollmentQueue := "grades-service-enrollment"
	if err := w.consumer.DeclareQueue(enrollmentQueue); err != nil {
		return err
	}
	if err := w.consumer.BindQueue(enrollmentQueue, "enrollment.events", "enrollment.program_approved"); err != nil {
		return err
	}
	if err := w.consumer.Consume(enrollmentQueue, w.handleEnrollmentEvent); err != nil {
		return err
	}

	// Setup attendance events queue
	attendanceQueue := "grades-service-attendance"
	if err := w.consumer.DeclareQueue(attendanceQueue); err != nil {
		return err
	}
	if err := w.consumer.BindQueue(attendanceQueue, "attendance.events", "attendance.semester.failed"); err != nil {
		return err
	}
	if err := w.consumer.Consume(attendanceQueue, w.handleAttendanceEvent); err != nil {
		return err
	}

	logger.Info("event consumer started")

	// Block until context is cancelled
	<-ctx.Done()
	logger.Info("event consumer stopped")

	return nil
}

// ============================================
// Student Event Handlers
// ============================================

func (w *EventConsumer) handleStudentEvent(body []byte) error {
	// Parse event type
	var baseEvent struct {
		EventType string `json:"event_type"`
	}
	if err := json.Unmarshal(body, &baseEvent); err != nil {
		logger.Error("failed to unmarshal base event", zap.Error(err))
		return err
	}

	ctx := context.Background()

	switch baseEvent.EventType {
	case "student.created":
		var event dto.StudentCreatedEvent
		if err := json.Unmarshal(body, &event); err != nil {
			logger.Error("failed to unmarshal student.created event", zap.Error(err))
			return err
		}
		return w.handleStudentCreated(ctx, event)

	case "student.updated":
		var event dto.StudentUpdatedEvent
		if err := json.Unmarshal(body, &event); err != nil {
			logger.Error("failed to unmarshal student.updated event", zap.Error(err))
			return err
		}
		return w.handleStudentUpdated(ctx, event)

	case "student.deactivated":
		var event dto.StudentDeactivatedEvent
		if err := json.Unmarshal(body, &event); err != nil {
			logger.Error("failed to unmarshal student.deactivated event", zap.Error(err))
			return err
		}
		return w.handleStudentDeactivated(ctx, event)

	default:
		logger.Warn("unknown student event type", zap.String("event_type", baseEvent.EventType))
		return nil
	}
}

func (w *EventConsumer) handleStudentCreated(ctx context.Context, event dto.StudentCreatedEvent) error {
	logger.Info("handling student.created event", zap.String("student_id", event.Data.ID.String()))

	_, err := w.cacheRepo.UpsertStudentCache(ctx, db.UpsertStudentCacheParams{
		ID:            event.Data.ID,
		StudentNumber: event.Data.StudentNumber,
		FirstName:     utils.StringToPgText(event.Data.FirstName),
		LastName:      utils.StringToPgText(event.Data.LastName),
		Email:         utils.StringToPgText(event.Data.Email),
		Department:    utils.StringToPgText(event.Data.Department),
		ClassLevel:    utils.Int16ToPgInt2(event.Data.ClassLevel),
		IsActive:      utils.BoolToPgBool(true),
	})

	return err
}

func (w *EventConsumer) handleStudentUpdated(ctx context.Context, event dto.StudentUpdatedEvent) error {
	logger.Info("handling student.updated event", zap.String("student_id", event.Data.ID.String()))

	_, err := w.cacheRepo.UpsertStudentCache(ctx, db.UpsertStudentCacheParams{
		ID:            event.Data.ID,
		StudentNumber: event.Data.StudentNumber,
		FirstName:     utils.StringToPgText(event.Data.FirstName),
		LastName:      utils.StringToPgText(event.Data.LastName),
		Email:         utils.StringToPgText(event.Data.Email),
		Department:    utils.StringToPgText(event.Data.Department),
		ClassLevel:    utils.Int16ToPgInt2(event.Data.ClassLevel),
		IsActive:      utils.BoolToPgBool(true),
	})

	return err
}

func (w *EventConsumer) handleStudentDeactivated(ctx context.Context, event dto.StudentDeactivatedEvent) error {
	logger.Info("handling student.deactivated event", zap.String("student_id", event.Data.ID.String()))

	return w.cacheRepo.DeactivateStudentCache(ctx, event.Data.ID)
}

// ============================================
// Course Event Handlers
// ============================================

func (w *EventConsumer) handleCourseEvent(body []byte) error {
	// Parse event type
	var baseEvent struct {
		EventType string `json:"event_type"`
	}
	if err := json.Unmarshal(body, &baseEvent); err != nil {
		logger.Error("failed to unmarshal base event", zap.Error(err))
		return err
	}

	ctx := context.Background()

	switch baseEvent.EventType {
	case "course.semester.created":
		var event dto.CourseSemesterCreatedEvent
		if err := json.Unmarshal(body, &event); err != nil {
			logger.Error("failed to unmarshal course.semester.created event", zap.Error(err))
			return err
		}
		return w.handleCourseSemesterCreated(ctx, event)

	case "course.semester.updated":
		var event dto.CourseSemesterUpdatedEvent
		if err := json.Unmarshal(body, &event); err != nil {
			logger.Error("failed to unmarshal course.semester.updated event", zap.Error(err))
			return err
		}
		return w.handleCourseSemesterUpdated(ctx, event)

	case "course.semester.deleted":
		var event dto.CourseSemesterDeletedEvent
		if err := json.Unmarshal(body, &event); err != nil {
			logger.Error("failed to unmarshal course.semester.deleted event", zap.Error(err))
			return err
		}
		return w.handleCourseSemesterDeleted(ctx, event)

	case "course.instructor.changed":
		var event dto.CourseInstructorChangedEvent
		if err := json.Unmarshal(body, &event); err != nil {
			logger.Error("failed to unmarshal course.instructor.changed event", zap.Error(err))
			return err
		}
		return w.handleCourseInstructorChanged(ctx, event)

	case "course.prerequisites.updated":
		var event dto.CoursePrerequisitesUpdatedEvent
		if err := json.Unmarshal(body, &event); err != nil {
			logger.Error("failed to unmarshal course.prerequisites.updated event", zap.Error(err))
			return err
		}
		return w.handleCoursePrerequisitesUpdated(ctx, event)

	default:
		logger.Warn("unknown course event type", zap.String("event_type", baseEvent.EventType))
		return nil
	}
}

func (w *EventConsumer) handleCourseSemesterCreated(ctx context.Context, event dto.CourseSemesterCreatedEvent) error {
	logger.Info("handling course.semester.created event", zap.String("course_id", event.SemesterCourseID.String()))

	// Marshal assessment schema to JSONB
	schemaJSON, err := json.Marshal(event.AssessmentSchema)
	if err != nil {
		logger.Error("failed to marshal assessment schema", zap.Error(err))
		return err
	}

	_, err = w.cacheRepo.UpsertCourseCache(ctx, db.UpsertCourseCacheParams{
		ID:                 event.SemesterCourseID,
		CourseCode:         event.CourseCode,
		CourseName:         event.CourseName,
		Credits:            event.Credits,
		Semester:           event.Semester,
		Department:         utils.StringToPgText(event.Department),
		InstructorID:       event.InstructorID,
		InstructorFullname: utils.StringToPgText(event.InstructorFullname),
		AssessmentSchema:   schemaJSON,
	})

	return err
}

func (w *EventConsumer) handleCourseSemesterUpdated(ctx context.Context, event dto.CourseSemesterUpdatedEvent) error {
	logger.Info("handling course.semester.updated event", zap.String("course_id", event.SemesterCourseID.String()))

	// Marshal assessment schema to JSONB
	schemaJSON, err := json.Marshal(event.AssessmentSchema)
	if err != nil {
		logger.Error("failed to marshal assessment schema", zap.Error(err))
		return err
	}

	_, err = w.cacheRepo.UpsertCourseCache(ctx, db.UpsertCourseCacheParams{
		ID:                 event.SemesterCourseID,
		CourseCode:         event.CourseCode,
		CourseName:         event.CourseName,
		Credits:            event.Credits,
		Semester:           event.Semester,
		Department:         utils.StringToPgText(event.Department),
		InstructorID:       event.InstructorID,
		InstructorFullname: utils.StringToPgText(event.InstructorFullname),
		AssessmentSchema:   schemaJSON,
	})

	return err
}

func (w *EventConsumer) handleCourseSemesterDeleted(ctx context.Context, event dto.CourseSemesterDeletedEvent) error {
	logger.Info("handling course.semester.deleted event", zap.String("course_id", event.SemesterCourseID.String()))

	// CASCADE will handle student_course_registrations and student_assessment_scores
	return w.cacheRepo.DeleteCourseCache(ctx, event.SemesterCourseID)
}

func (w *EventConsumer) handleCourseInstructorChanged(ctx context.Context, event dto.CourseInstructorChangedEvent) error {
	logger.Info("handling course.instructor.changed event", zap.String("course_id", event.SemesterCourseID.String()))

	return w.cacheRepo.UpdateCourseInstructor(ctx, db.UpdateCourseInstructorParams{
		ID:                 event.SemesterCourseID,
		InstructorID:       event.InstructorID,
		InstructorFullname: utils.StringToPgText(event.InstructorFullname),
	})
}

func (w *EventConsumer) handleCoursePrerequisitesUpdated(ctx context.Context, event dto.CoursePrerequisitesUpdatedEvent) error {
	logger.Info("handling course.prerequisites.updated event", zap.Int("count", len(event.PrerequisiteCourses)))

	// Build prerequisites for bulk insert
	var prerequisites []db.BulkInsertPrerequisiteCoursesParams
	for _, prereq := range event.PrerequisiteCourses {
		prerequisites = append(prerequisites, db.BulkInsertPrerequisiteCoursesParams{
			CourseCode: prereq.CourseCode,
			CourseID:   prereq.CourseID,
		})
	}

	return w.cacheRepo.SyncPrerequisiteCourses(ctx, prerequisites)
}

// ============================================
// Enrollment Event Handlers
// ============================================

func (w *EventConsumer) handleEnrollmentEvent(body []byte) error {
	var event dto.EnrollmentProgramApprovedEvent
	if err := json.Unmarshal(body, &event); err != nil {
		logger.Error("failed to unmarshal enrollment.program_approved event", zap.Error(err))
		return err
	}

	logger.Info("handling enrollment.program_approved event",
		zap.String("student_id", event.Data.StudentID.String()),
		zap.Int("courses", len(event.Data.CourseIDs)),
	)

	ctx := context.Background()

	// Create registrations for each course
	for _, courseID := range event.Data.CourseIDs {
		_, err := w.regRepo.CreateRegistration(ctx, db.CreateRegistrationParams{
			StudentID:          event.Data.StudentID,
			CourseID:           courseID,
			Semester:           event.Data.Semester,
			IsAttendanceFailed: utils.BoolToPgBool(false),
		})
		if err != nil {
			logger.Error("failed to create registration",
				zap.Error(err),
				zap.String("student_id", event.Data.StudentID.String()),
				zap.String("course_id", courseID.String()),
			)
			// Continue with other courses
			continue
		}
	}

	return nil
}

// ============================================
// Attendance Event Handlers
// ============================================

func (w *EventConsumer) handleAttendanceEvent(body []byte) error {
	var event dto.AttendanceSemesterFailedEvent
	if err := json.Unmarshal(body, &event); err != nil {
		logger.Error("failed to unmarshal attendance.semester.failed event", zap.Error(err))
		return err
	}

	logger.Info("handling attendance.semester.failed event",
		zap.String("student_id", event.Data.StudentID.String()),
		zap.String("course_id", event.Data.CourseID.String()),
	)

	ctx := context.Background()

	return w.regRepo.MarkAttendanceFailed(ctx, db.MarkAttendanceFailedParams{
		StudentID: event.Data.StudentID,
		CourseID:  event.Data.CourseID,
	})
}
