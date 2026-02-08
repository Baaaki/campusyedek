package service

import (
	"context"
	"encoding/json"

	"github.com/baaaki/mydreamcampus/enrollment-service/internal/db"
	"github.com/baaaki/mydreamcampus/enrollment-service/internal/dto"
	"github.com/baaaki/mydreamcampus/enrollment-service/internal/repository"
	sharedErrors "github.com/baaaki/mydreamcampus/shared/errors"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"go.uber.org/zap"
)

type EventService struct {
	studentRepo           *repository.StudentRepository
	courseRepo            *repository.CourseRepository
	enrollmentRepo        *repository.EnrollmentRepository
	processedEventsRepo   *repository.ProcessedEventsRepository
}

func NewEventService(
	studentRepo *repository.StudentRepository,
	courseRepo *repository.CourseRepository,
	enrollmentRepo *repository.EnrollmentRepository,
	processedEventsRepo *repository.ProcessedEventsRepository,
) *EventService {
	return &EventService{
		studentRepo:         studentRepo,
		courseRepo:          courseRepo,
		enrollmentRepo:      enrollmentRepo,
		processedEventsRepo: processedEventsRepo,
	}
}

// HandleStudentCreated handles student.created event
func (s *EventService) HandleStudentCreated(ctx context.Context, event dto.StudentCreatedEvent) error {
	serviceLogger := logger.WithContextAndFields(ctx,
		zap.String("service", "EventService"),
		zap.String("method", "HandleStudentCreated"),
		zap.String("event_id", event.EventID.String()),
		zap.String("student_id", event.StudentID.String()),
	)

	// Check if already processed
	processed, err := s.processedEventsRepo.IsEventProcessed(ctx, event.EventID)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}
	if processed {
		serviceLogger.Info("event already processed, skipping")
		return nil
	}

	// Upsert student
	params := db.UpsertStudentParams{
		ID:            utils.UUIDToPgtype(event.StudentID),
		StudentNumber: event.StudentNumber,
		Email:         event.Email,
		FirstName:     utils.StringToPgText(event.FirstName),
		LastName:      utils.StringToPgText(event.LastName),
		Department:    utils.StringToPgText(event.Department),
		ClassLevel:    utils.Int16ToPgtypeNullable(event.ClassLevel),
		AdvisorID:     utils.UUIDToPgtypeNullable(event.AdvisorID),
		Status:        utils.StringToPgText(event.Status),
		IsActive:      pgtype.Bool{Bool: true, Valid: true},
	}

	_, err = s.studentRepo.UpsertStudent(ctx, params)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	// Mark as processed
	if err := s.processedEventsRepo.CreateProcessedEvent(ctx, event.EventID, event.EventType); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	serviceLogger.Info("student created event processed successfully")
	return nil
}

// HandleStudentUpdated handles student.updated event
func (s *EventService) HandleStudentUpdated(ctx context.Context, event dto.StudentUpdatedEvent) error {
	serviceLogger := logger.WithContextAndFields(ctx,
		zap.String("service", "EventService"),
		zap.String("method", "HandleStudentUpdated"),
		zap.String("event_id", event.EventID.String()),
		zap.String("student_id", event.StudentID.String()),
	)

	// Check if already processed
	processed, err := s.processedEventsRepo.IsEventProcessed(ctx, event.EventID)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}
	if processed {
		serviceLogger.Info("event already processed, skipping")
		return nil
	}

	// Determine advisor ID
	var advisorID uuid.UUID
	if event.AdvisorID != nil {
		advisorID = *event.AdvisorID
	}

	// Upsert student
	params := db.UpsertStudentParams{
		ID:            utils.UUIDToPgtype(event.StudentID),
		StudentNumber: event.StudentNumber,
		Email:         event.Email,
		FirstName:     utils.StringToPgText(event.FirstName),
		LastName:      utils.StringToPgText(event.LastName),
		Department:    utils.StringToPgText(event.Department),
		ClassLevel:    utils.Int16ToPgtypeNullable(event.ClassLevel),
		AdvisorID:     utils.UUIDToPgtypeNullable(advisorID),
		Status:        utils.StringToPgText(event.Status),
		IsActive:      pgtype.Bool{Bool: true, Valid: true},
	}

	_, err = s.studentRepo.UpsertStudent(ctx, params)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	// Mark as processed
	if err := s.processedEventsRepo.CreateProcessedEvent(ctx, event.EventID, event.EventType); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	serviceLogger.Info("student updated event processed successfully")
	return nil
}

// HandleStudentDeactivated handles student.deactivated event
func (s *EventService) HandleStudentDeactivated(ctx context.Context, event dto.StudentDeactivatedEvent) error {
	serviceLogger := logger.WithContextAndFields(ctx,
		zap.String("service", "EventService"),
		zap.String("method", "HandleStudentDeactivated"),
		zap.String("event_id", event.EventID.String()),
		zap.String("student_id", event.StudentID.String()),
	)

	// Check if already processed
	processed, err := s.processedEventsRepo.IsEventProcessed(ctx, event.StudentID)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}
	if processed {
		serviceLogger.Info("event already processed, skipping")
		return nil
	}

	// Deactivate student
	if err := s.studentRepo.DeactivateStudent(ctx, event.StudentID); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	// Mark as processed
	if err := s.processedEventsRepo.CreateProcessedEvent(ctx, event.EventID, event.EventType); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	serviceLogger.Info("student deactivated event processed successfully")
	return nil
}

// HandleCourseSemesterCreated handles course.semester.created event
func (s *EventService) HandleCourseSemesterCreated(ctx context.Context, event dto.CourseSemesterCreatedEvent) error {
	serviceLogger := logger.WithContextAndFields(ctx,
		zap.String("service", "EventService"),
		zap.String("method", "HandleCourseSemesterCreated"),
		zap.String("event_id", event.EventID.String()),
		zap.String("semester_course_id", event.SemesterCourseID.String()),
	)

	// Check if already processed
	processed, err := s.processedEventsRepo.IsEventProcessed(ctx, event.EventID)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}
	if processed {
		serviceLogger.Info("event already processed, skipping")
		return nil
	}

	// Marshal prerequisites to JSONB
	prerequisitesJSON, err := json.Marshal(event.Prerequisites)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	// Determine instructor ID
	var instructorID uuid.UUID
	if event.InstructorID != nil {
		instructorID = *event.InstructorID
	}

	// Upsert semester course
	courseParams := db.UpsertSemesterCourseParams{
		ID:                  utils.UUIDToPgtype(event.SemesterCourseID),
		CourseCode:          event.CourseCode,
		CourseName:          utils.StringToPgText(event.CourseName),
		Faculty:             utils.StringToPgText(event.Faculty),
		Department:          utils.StringToPgText(event.Department),
		Credits:             event.Credits,
		CourseType:          db.CourseTypeEnum(event.CourseType),
		ClassLevel:          utils.Int16ToPgtypeNullable(event.ClassLevel),
		Semester:            event.Semester,
		InstructorID:        utils.UUIDToPgtypeNullable(instructorID),
		InstructorFullname:  utils.StringToPgText(event.InstructorName),
		ClassroomLocation:   utils.StringToPgText(event.ClassroomLocation),
		MaxCapacity:         event.MaxCapacity,
		CurrentEnrollment:   pgtype.Int2{Int16: 0, Valid: true}, // Initial value
		Prerequisites:       prerequisitesJSON,
	}

	_, err = s.courseRepo.UpsertSemesterCourse(ctx, courseParams)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	// Delete existing sessions
	if err := s.courseRepo.DeleteCourseSessionsByCourseID(ctx, event.SemesterCourseID); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	// Create new sessions
	for _, session := range event.ScheduleSessions {
		for _, slotNumber := range session.SlotNumbers {
			sessionParams := db.UpsertCourseSessionParams{
				ID:         utils.UUIDToPgtype(uuid.New()),
				CourseID:   utils.UUIDToPgtype(event.SemesterCourseID),
				DayOfWeek:  db.DayOfWeekEnum(session.DayOfWeek),
				SlotNumber: int32(slotNumber),
			}

			_, err := s.courseRepo.UpsertCourseSession(ctx, sessionParams)
			if err != nil {
				return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
			}
		}
	}

	// Mark as processed
	if err := s.processedEventsRepo.CreateProcessedEvent(ctx, event.EventID, event.EventType); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	serviceLogger.Info("course semester created event processed successfully")
	return nil
}

// HandleCourseSemesterUpdated handles course.semester.updated event
func (s *EventService) HandleCourseSemesterUpdated(ctx context.Context, event dto.CourseSemesterUpdatedEvent) error {
	// Same logic as HandleCourseSemesterCreated since we use upsert
	return s.HandleCourseSemesterCreated(ctx, dto.CourseSemesterCreatedEvent(event))
}

// HandleCourseSemesterDeleted handles course.semester.deleted event
func (s *EventService) HandleCourseSemesterDeleted(ctx context.Context, event dto.CourseSemesterDeletedEvent) error {
	serviceLogger := logger.WithContextAndFields(ctx,
		zap.String("service", "EventService"),
		zap.String("method", "HandleCourseSemesterDeleted"),
		zap.String("event_id", event.EventID.String()),
		zap.String("semester_course_id", event.SemesterCourseID.String()),
	)

	// Check if already processed
	processed, err := s.processedEventsRepo.IsEventProcessed(ctx, event.EventID)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}
	if processed {
		serviceLogger.Info("event already processed, skipping")
		return nil
	}

	// Delete semester course (cascade will delete sessions)
	if err := s.courseRepo.DeleteSemesterCourse(ctx, event.SemesterCourseID); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	// Mark as processed
	if err := s.processedEventsRepo.CreateProcessedEvent(ctx, event.EventID, event.EventType); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	serviceLogger.Info("course semester deleted event processed successfully")
	return nil
}

// HandleGradeStudentPrerequisitePassed handles grade.student.prerequisite.passed event
func (s *EventService) HandleGradeStudentPrerequisitePassed(ctx context.Context, event dto.GradeStudentPrerequisitePassedEvent) error {
	serviceLogger := logger.WithContextAndFields(ctx,
		zap.String("service", "EventService"),
		zap.String("method", "HandleGradeStudentPrerequisitePassed"),
		zap.String("event_id", event.EventID.String()),
		zap.String("student_id", event.StudentID.String()),
		zap.String("course_code", event.CourseCode),
	)

	// Check if already processed
	processed, err := s.processedEventsRepo.IsEventProcessed(ctx, event.EventID)
	if err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}
	if processed {
		serviceLogger.Info("event already processed, skipping")
		return nil
	}

	// Upsert passed prerequisite
	params := db.UpsertPassedPrerequisiteParams{
		StudentID:  utils.UUIDToPgtype(event.StudentID),
		CourseCode: event.CourseCode,
		Semester:   event.Semester,
		GradePoint: utils.StringToPgText(event.GradePoint),
	}

	if err := s.enrollmentRepo.UpsertPassedPrerequisite(ctx, params); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	// Mark as processed
	if err := s.processedEventsRepo.CreateProcessedEvent(ctx, event.EventID, event.EventType); err != nil {
		return sharedErrors.Wrap(sharedErrors.ErrInternal, err)
	}

	serviceLogger.Info("grade student prerequisite passed event processed successfully")
	return nil
}
