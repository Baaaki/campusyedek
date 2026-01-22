package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/db"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/dto"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/errors"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/repository"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"go.uber.org/zap"
)

type AttendanceService struct {
	cacheRepo      *repository.CacheRepository
	sessionRepo    *repository.SessionRepository
	attendanceRepo *repository.AttendanceRepository
	outboxRepo     *repository.OutboxRepository
	qrService      *QRService
	redisService   *RedisService
}

func NewAttendanceService(
	cacheRepo *repository.CacheRepository,
	sessionRepo *repository.SessionRepository,
	attendanceRepo *repository.AttendanceRepository,
	outboxRepo *repository.OutboxRepository,
	qrService *QRService,
	redisService *RedisService,
) *AttendanceService {
	return &AttendanceService{
		cacheRepo:      cacheRepo,
		sessionRepo:    sessionRepo,
		attendanceRepo: attendanceRepo,
		outboxRepo:     outboxRepo,
		qrService:      qrService,
		redisService:   redisService,
	}
}

// CreateSession creates a new attendance session
func (s *AttendanceService) CreateSession(ctx context.Context, instructorID uuid.UUID, req dto.CreateSessionRequest) (dto.CreateSessionResponse, error) {
	logger.Info("Creating attendance session",
		zap.String("course_id", req.CourseID.String()),
		zap.Int("week", int(req.WeekNumber)),
	)

	// 1. Check instructor owns the course
	course, err := s.cacheRepo.GetCourseCacheByID(ctx, req.CourseID)
	if err != nil {
		logger.Error("course not found", zap.Error(err))
		return dto.CreateSessionResponse{}, errors.ErrCourseNotFound
	}

	if utils.PgUUIDToUUID(course.InstructorID) != instructorID {
		logger.Error("instructor does not own course")
		return dto.CreateSessionResponse{}, errors.ErrForbidden
	}

	// 2. Check session doesn't already exist for this week
	exists, err := s.sessionRepo.CheckSessionExists(ctx, req.CourseID, req.WeekNumber)
	if err != nil {
		return dto.CreateSessionResponse{}, err
	}
	if exists {
		return dto.CreateSessionResponse{}, errors.ErrSessionAlreadyExists
	}

	// 3. Generate QR secret
	qrSecret, err := s.qrService.GenerateSecret()
	if err != nil {
		return dto.CreateSessionResponse{}, err
	}

	// 4. Create session in DB
	now := time.Now()
	expiresAt := now.Add(time.Duration(req.DurationMinutes) * time.Minute)

	session, err := s.sessionRepo.CreateAttendanceSession(ctx, db.CreateAttendanceSessionParams{
		CourseID:           utils.UUIDToPgUUID(req.CourseID),
		InstructorID:       utils.UUIDToPgUUID(instructorID),
		Semester:           course.Semester,
		WeekNumber:         req.WeekNumber,
		SessionDate:        pgtype.Date{Time: now, Valid: true},
		QrSecret:           qrSecret,
		QrRotationInterval: utils.Int16ToPgInt2(15),
		StartedAt:          utils.TimeToPgTimestamp(now),
		ExpiresAt:          utils.TimeToPgTimestamp(expiresAt),
	})
	if err != nil {
		return dto.CreateSessionResponse{}, err
	}

	// 5. Warm Redis cache
	sessionID := utils.PgUUIDToUUID(session.ID).String()
	
	// Get enrolled students
	enrolledStudents, err := s.cacheRepo.GetEnrolledStudentsByCourse(ctx, req.CourseID, course.Semester)
	if err != nil {
		logger.Error("failed to get enrolled students", zap.Error(err))
	} else {
		studentIDs := make([]uuid.UUID, len(enrolledStudents))
		for i, student := range enrolledStudents {
			studentIDs[i] = utils.PgUUIDToUUID(student.ID)
		}
		s.redisService.AddEnrolledStudents(ctx, sessionID, studentIDs)
	}

	// Session cache
	s.redisService.SetSessionCache(ctx, sessionID, map[string]interface{}{
		"course_id":            req.CourseID.String(),
		"instructor_id":        instructorID.String(),
		"semester":             course.Semester,
		"week_number":          fmt.Sprintf("%d", req.WeekNumber),
		"qr_secret":            qrSecret,
		"qr_rotation_interval": "15",
		"expires_at":           fmt.Sprintf("%d", expiresAt.Unix()),
		"enrolled_count":       fmt.Sprintf("%d", len(enrolledStudents)),
	}, time.Until(expiresAt)+5*time.Minute)

	return dto.CreateSessionResponse{
		SessionID:            utils.PgUUIDToUUID(session.ID),
		CourseID:             req.CourseID,
		CourseCode:           course.CourseCode,
		CourseName:           course.CourseName,
		WeekNumber:           req.WeekNumber,
		SessionDate:          now.Format("2006-01-02"),
		QRRotationInterval:   15,
		StartedAt:            now,
		ExpiresAt:            expiresAt,
		EnrolledStudentCount: len(enrolledStudents),
	}, nil
}

// ScanQR processes QR code scan for attendance
func (s *AttendanceService) ScanQR(ctx context.Context, studentID uuid.UUID, req dto.ScanQRRequest) (dto.ScanQRResponse, error) {
	logger.Info("Processing QR scan", zap.String("student_id", studentID.String()))

	// 1. Check student is active
	student, err := s.cacheRepo.GetStudentCacheByID(ctx, studentID)
	if err != nil {
		return dto.ScanQRResponse{}, errors.ErrStudentNotFound
	}
	if !utils.PgBoolToBool(student.IsActive) {
		return dto.ScanQRResponse{}, errors.ErrStudentDeactivated
	}

	// 2. Get session (with fallback)
	sessionID := req.QRPayload.SessionID
	session, err := s.getSessionWithFallback(ctx, sessionID)
	if err != nil {
		return dto.ScanQRResponse{}, errors.ErrSessionNotFound
	}

	// Check if expired
	if time.Now().After(utils.PgTimestampToTime(session.ExpiresAt)) {
		return dto.ScanQRResponse{}, errors.ErrSessionExpired
	}

	// 3. Validate QR signature
	rotationInterval := session.QrRotationInterval.Int16
	if !s.qrService.ValidateQRSignature(req.QRPayload, session.QrSecret, rotationInterval) {
		return dto.ScanQRResponse{}, errors.ErrInvalidQRCode
	}

	// 4. Check timestamp freshness
	if !s.qrService.IsTimestampFresh(req.QRPayload.Timestamp, rotationInterval) {
		return dto.ScanQRResponse{}, errors.ErrQRExpired
	}

	// 5. Check enrollment (with fallback)
	courseID := utils.PgUUIDToUUID(session.CourseID)
	enrolled, err := s.checkEnrollmentWithFallback(ctx, sessionID, studentID, courseID, session.Semester)
	if err != nil || !enrolled {
		return dto.ScanQRResponse{}, errors.ErrNotEnrolled
	}

	// 6. Check not already marked (with fallback)
	alreadyMarked, err := s.checkAlreadyMarkedWithFallback(ctx, sessionID, studentID)
	if err != nil {
		return dto.ScanQRResponse{}, err
	}
	if alreadyMarked {
		return dto.ScanQRResponse{}, errors.ErrAlreadyMarked
	}

	// 7. Write to Redis buffer (or direct DB if Redis down)
	bufferData := fmt.Sprintf("%d|%d|qr_scan", time.Now().Unix(), req.QRPayload.Timestamp)
	if err := s.redisService.AddToBuffer(ctx, sessionID, studentID.String(), bufferData); err != nil {
		// Redis down, write directly to DB
		logger.Warn("Redis down, writing directly to DB", zap.Error(err))
		if err := s.attendanceRepo.CreateAttendanceRecordQR(ctx, db.CreateAttendanceRecordQRParams{
			SessionID:   session.ID,
			StudentID:   utils.UUIDToPgUUID(studentID),
			CourseID:    session.CourseID,
			Semester:    session.Semester,
			WeekNumber:  session.WeekNumber,
			ScannedAt:   utils.TimeToPgTimestamp(time.Now()),
			QrTimestamp: pgtype.Int8{Int64: req.QRPayload.Timestamp, Valid: true},
		}); err != nil {
			return dto.ScanQRResponse{}, err
		}
	}

	// Mark as present in Redis
	s.redisService.MarkStudentPresent(ctx, sessionID, studentID.String())

	// Get course info for response
	course, _ := s.cacheRepo.GetCourseCacheByID(ctx, courseID)

	return dto.ScanQRResponse{
		Message:    "Yoklama başarıyla alındı",
		CourseCode: course.CourseCode,
		CourseName: course.CourseName,
		WeekNumber: session.WeekNumber,
		MarkedAt:   time.Now(),
	}, nil
}

// GetQRCode generates QR code data for instructor
func (s *AttendanceService) GetQRCode(ctx context.Context, sessionID, instructorID uuid.UUID) (dto.GetQRResponse, error) {
	session, err := s.sessionRepo.GetActiveSessionByID(ctx, sessionID)
	if err != nil {
		return dto.GetQRResponse{}, errors.ErrSessionNotFound
	}

	// Check ownership
	if utils.PgUUIDToUUID(session.InstructorID) != instructorID {
		return dto.GetQRResponse{}, errors.ErrForbidden
	}

	// Generate QR payload
	rotationInterval := session.QrRotationInterval.Int16
	payload := s.qrService.GenerateQRPayload(sessionID.String(), session.QrSecret, rotationInterval)

	validUntil := time.Now().Add(time.Duration(rotationInterval) * time.Second)

	return dto.GetQRResponse{
		SessionID:        sessionID,
		QRPayload:        payload,
		ValidUntil:       validUntil,
		RotationInterval: rotationInterval,
	}, nil
}

// CreateManualAttendance creates manual attendance record
func (s *AttendanceService) CreateManualAttendance(ctx context.Context, sessionID, instructorID uuid.UUID, req dto.ManualAttendanceRequest) (dto.ManualAttendanceResponse, error) {
	session, err := s.sessionRepo.GetActiveSessionByID(ctx, sessionID)
	if err != nil {
		return dto.ManualAttendanceResponse{}, errors.ErrSessionNotFound
	}

	// Check ownership
	if utils.PgUUIDToUUID(session.InstructorID) != instructorID {
		return dto.ManualAttendanceResponse{}, errors.ErrForbidden
	}

	// Check enrollment
	enrolled, _ := s.cacheRepo.CheckEnrollment(ctx, req.StudentID, utils.PgUUIDToUUID(session.CourseID), session.Semester)
	if !enrolled {
		return dto.ManualAttendanceResponse{}, errors.ErrNotEnrolled
	}

	// Create record
	record, err := s.attendanceRepo.CreateAttendanceRecordManual(ctx, db.CreateAttendanceRecordManualParams{
		SessionID:        utils.UUIDToPgUUID(sessionID),
		StudentID:        utils.UUIDToPgUUID(req.StudentID),
		CourseID:         session.CourseID,
		Semester:         session.Semester,
		WeekNumber:       session.WeekNumber,
		IsPresent:        req.IsPresent,
		ManuallyMarkedBy: pgtype.UUID{Bytes: instructorID, Valid: true},
		ManualNote:       utils.StringToPgText(req.Note),
	})
	if err != nil {
		return dto.ManualAttendanceResponse{}, err
	}

	// Update Redis marked set
	s.redisService.MarkStudentPresent(ctx, sessionID.String(), req.StudentID.String())

	// Invalidate student summary cache
	s.redisService.InvalidateStudentSummary(ctx, req.StudentID, session.Semester)

	// Get student info
	student, _ := s.cacheRepo.GetStudentCacheByID(ctx, req.StudentID)

	return dto.ManualAttendanceResponse{
		ID:            utils.PgUUIDToUUID(record.ID),
		SessionID:     sessionID,
		StudentID:     req.StudentID,
		StudentNumber: student.StudentNumber,
		StudentName:   fmt.Sprintf("%s %s", utils.PgTextToString(student.FirstName), utils.PgTextToString(student.LastName)),
		IsPresent:     req.IsPresent,
		MarkedVia:     "manual",
		Note:          &req.Note,
		MarkedAt:      &time.Time{},
	}, nil
}

// CloseSession closes session and marks absent students
func (s *AttendanceService) CloseSession(ctx context.Context, sessionID, instructorID uuid.UUID) (dto.CloseSessionResponse, error) {
	session, err := s.sessionRepo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return dto.CloseSessionResponse{}, errors.ErrSessionNotFound
	}

	// Check ownership
	if utils.PgUUIDToUUID(session.InstructorID) != instructorID {
		return dto.CloseSessionResponse{}, errors.ErrForbidden
	}

	// Check if already closed
	if !utils.PgBoolToBool(session.IsActive) {
		return dto.CloseSessionResponse{}, errors.ErrSessionNotActive
	}

	// TODO: Flush Redis buffer to PostgreSQL

	// Get all enrolled students
	courseID := utils.PgUUIDToUUID(session.CourseID)
	enrolledStudents, err := s.cacheRepo.GetEnrolledStudentsByCourse(ctx, courseID, session.Semester)
	if err != nil {
		return dto.CloseSessionResponse{}, err
	}

	// Get marked students
	markedStudents, err := s.attendanceRepo.GetMarkedStudentsBySession(ctx, sessionID)
	if err != nil {
		return dto.CloseSessionResponse{}, err
	}

	// Calculate absent students
	markedMap := make(map[uuid.UUID]bool)
	for _, id := range markedStudents {
		markedMap[id] = true
	}

	var absentStudentIDs []uuid.UUID
	var newlyMarkedAbsent []dto.AbsentStudent

	for _, student := range enrolledStudents {
		studentID := utils.PgUUIDToUUID(student.ID)
		if !markedMap[studentID] {
			absentStudentIDs = append(absentStudentIDs, studentID)
			newlyMarkedAbsent = append(newlyMarkedAbsent, dto.AbsentStudent{
				StudentID:     studentID,
				StudentNumber: student.StudentNumber,
				StudentName:   fmt.Sprintf("%s %s", utils.PgTextToString(student.FirstName), utils.PgTextToString(student.LastName)),
			})
		}
	}

	// Batch insert absent records
	if len(absentStudentIDs) > 0 {
		if err := s.attendanceRepo.BatchCreateAbsentRecords(ctx, sessionID, courseID, session.Semester, session.WeekNumber, instructorID, absentStudentIDs); err != nil {
			return dto.CloseSessionResponse{}, err
		}
	}

	// Deactivate session
	if err := s.sessionRepo.DeactivateSession(ctx, sessionID); err != nil {
		return dto.CloseSessionResponse{}, err
	}

	// Clear Redis keys
	s.redisService.ClearSessionKeys(ctx, sessionID.String())

	// Get attendance counts
	counts, _ := s.attendanceRepo.GetSessionAttendanceCounts(ctx, sessionID)

	return dto.CloseSessionResponse{
		SessionID: sessionID,
		ClosedAt:  time.Now(),
		Summary: dto.SessionSummary{
			TotalEnrolled: len(enrolledStudents),
			PresentCount:  int(counts.PresentCount),
			AbsentCount:   int(counts.AbsentCount),
		},
		NewlyMarkedAbsent: newlyMarkedAbsent,
	}, nil
}

// GetMyAttendance returns student's own attendance records
func (s *AttendanceService) GetMyAttendance(ctx context.Context, studentID uuid.UUID, semester string) (dto.GetMyAttendanceResponse, error) {
	// Check student is active
	student, err := s.cacheRepo.GetStudentCacheByID(ctx, studentID)
	if err != nil {
		return dto.GetMyAttendanceResponse{}, errors.ErrStudentNotFound
	}
	if !utils.PgBoolToBool(student.IsActive) {
		return dto.GetMyAttendanceResponse{}, errors.ErrStudentDeactivated
	}

	// Get enrollments
	enrollments, err := s.cacheRepo.GetStudentEnrollmentsBySemester(ctx, studentID, semester)
	if err != nil {
		return dto.GetMyAttendanceResponse{}, err
	}

	var courses []dto.CourseAttendanceDetail

	for _, enrollment := range enrollments {
		courseID := utils.PgUUIDToUUID(enrollment.CourseID)
		
		// Get attendance records
		records, err := s.attendanceRepo.GetStudentAttendanceByCourse(ctx, studentID, courseID, semester)
		if err != nil {
			continue
		}

		var weeklyRecords []dto.WeeklyAttendanceRecord
		presentCount := 0
		absentCount := 0
		var absentWeeks []int16

		for _, record := range records {
			weeklyRecords = append(weeklyRecords, dto.WeeklyAttendanceRecord{
				Week:      record.WeekNumber,
				Date:      record.SessionDate.Time.Format("2006-01-02"),
				IsPresent: record.IsPresent,
				MarkedVia: record.MarkedVia,
			})

			if record.IsPresent {
				presentCount++
			} else {
				absentCount++
				absentWeeks = append(absentWeeks, record.WeekNumber)
			}
		}

		courses = append(courses, dto.CourseAttendanceDetail{
			CourseID:       courseID,
			CourseCode:     enrollment.CourseCode,
			CourseName:     enrollment.CourseName,
			Instructor:     utils.PgTextToString(enrollment.InstructorFullname),
			TotalWeeks:     enrollment.TotalWeeks.Int16,
			CompletedWeeks: len(records),
			PresentCount:   presentCount,
			AbsentCount:    absentCount,
			AbsentWeeks:    absentWeeks,
			WeeklyRecords:  weeklyRecords,
		})
	}

	return dto.GetMyAttendanceResponse{
		StudentID:     studentID,
		StudentNumber: student.StudentNumber,
		Semester:      semester,
		Courses:       courses,
	}, nil
}

// FinalizeAttendance finalizes attendance for a course and publishes events
func (s *AttendanceService) FinalizeAttendance(ctx context.Context, courseID, instructorID uuid.UUID, semester string) (dto.FinalizeAttendanceResponse, error) {
	logger.Info("Finalizing attendance",
		zap.String("course_id", courseID.String()),
		zap.String("semester", semester),
	)

	// Check ownership
	course, err := s.cacheRepo.GetCourseCacheByID(ctx, courseID)
	if err != nil {
		return dto.FinalizeAttendanceResponse{}, errors.ErrCourseNotFound
	}
	if utils.PgUUIDToUUID(course.InstructorID) != instructorID {
		return dto.FinalizeAttendanceResponse{}, errors.ErrForbidden
	}

	// Get failing students (absent_count >= 4)
	failingStudents, err := s.attendanceRepo.GetFailingStudentsByCourse(ctx, courseID, semester)
	if err != nil {
		return dto.FinalizeAttendanceResponse{}, err
	}

	// Get all students for total count
	allStudents, _ := s.cacheRepo.GetEnrolledStudentsByCourse(ctx, courseID, semester)

	var failed []dto.FailedStudent
	eventsPublished := 0

	// Publish events for failing students
	for _, student := range failingStudents {
		studentID := utils.PgUUIDToUUID(student.StudentID)
		failed = append(failed, dto.FailedStudent{
			StudentID:     studentID,
			StudentNumber: student.StudentNumber,
			StudentName:   fmt.Sprintf("%s %s", utils.PgTextToString(student.FirstName), utils.PgTextToString(student.LastName)),
			PresentCount:  int(student.PresentCount),
			AbsentCount:   int(student.AbsentCount),
		})

		// Publish event
		eventData := dto.AttendanceSemesterFailedEventData{
			StudentID:          studentID,
			StudentNumber:      student.StudentNumber,
			StudentEmail:       utils.PgTextToString(student.Email),
			CourseID:           courseID,
			CourseCode:         course.CourseCode,
			CourseName:         course.CourseName,
			Semester:           semester,
			TotalWeeks:         course.TotalWeeks.Int16,
			PresentCount:       int(student.PresentCount),
			AbsentCount:        int(student.AbsentCount),
			MaxAllowedAbsences: 3,
		}

		if err := s.publishFailedAttendanceEvent(ctx, eventData); err == nil {
			eventsPublished++
		}
	}

	return dto.FinalizeAttendanceResponse{
		CourseID:      courseID,
		CourseCode:    course.CourseCode,
		Semester:      semester,
		TotalStudents: len(allStudents),
		TotalWeeks:    course.TotalWeeks.Int16,
		FinalizationSummary: struct {
			PassingCount       int `json:"passing_count"`
			FailingCount       int `json:"failing_count"`
			MaxAllowedAbsences int `json:"max_allowed_absences"`
		}{
			PassingCount:       len(allStudents) - len(failingStudents),
			FailingCount:       len(failingStudents),
			MaxAllowedAbsences: 3,
		},
		FailedStudents:  failed,
		EventsPublished: eventsPublished,
		FinalizedAt:     time.Now(),
	}, nil
}

// Helper functions

func (s *AttendanceService) getSessionWithFallback(ctx context.Context, sessionID string) (db.AttendanceSession, error) {
	// Try Redis first
	sessionData, err := s.redisService.GetSessionCache(ctx, sessionID)
	if err == nil && len(sessionData) > 0 {
		// Parse from Redis (simplified - in production should construct full session)
		sessionUUID, _ := uuid.Parse(sessionID)
		return s.sessionRepo.GetSessionByID(ctx, sessionUUID)
	}

	// Fallback to DB
	sessionUUID, _ := uuid.Parse(sessionID)
	session, err := s.sessionRepo.GetActiveSessionByID(ctx, sessionUUID)
	if err != nil {
		return db.AttendanceSession{}, err
	}

	// Warm cache
	go s.warmSessionCache(context.Background(), session)

	return session, nil
}

func (s *AttendanceService) checkEnrollmentWithFallback(ctx context.Context, sessionID string, studentID, courseID uuid.UUID, semester string) (bool, error) {
	// Try Redis first
	enrolled, err := s.redisService.IsStudentEnrolled(ctx, sessionID, studentID.String())
	if err == nil {
		return enrolled, nil
	}

	// Fallback to DB
	return s.cacheRepo.CheckEnrollment(ctx, studentID, courseID, semester)
}

func (s *AttendanceService) checkAlreadyMarkedWithFallback(ctx context.Context, sessionID string, studentID uuid.UUID) (bool, error) {
	// Try Redis first
	marked, err := s.redisService.IsAlreadyMarked(ctx, sessionID, studentID.String())
	if err == nil {
		return marked, nil
	}

	// Fallback to DB
	sessionUUID, _ := uuid.Parse(sessionID)
	return s.attendanceRepo.CheckAttendanceExists(ctx, sessionUUID, studentID)
}

func (s *AttendanceService) warmSessionCache(ctx context.Context, session db.AttendanceSession) {
	// Implementation for warming Redis cache after fallback
	logger.Debug("warming session cache", zap.String("session_id", utils.PgUUIDToUUID(session.ID).String()))
}

// publishFailedAttendanceEvent publishes event to outbox
func (s *AttendanceService) publishFailedAttendanceEvent(ctx context.Context, data dto.AttendanceSemesterFailedEventData) error {
	payload, err := json.Marshal(dto.BaseEvent{
		EventID:   uuid.New(),
		EventType: "attendance.semester.failed",
		Timestamp: time.Now(),
		Data:      data,
	})
	if err != nil {
		return err
	}

	return s.outboxRepo.CreateOutboxEvent(ctx, "attendance.semester.failed", "attendance.semester.failed", payload)
}
