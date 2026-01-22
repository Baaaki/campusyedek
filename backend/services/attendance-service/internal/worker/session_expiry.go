package worker

import (
	"context"
	"time"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/db"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/repository"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/service"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type SessionExpiryHandler struct {
	sessionRepo    *repository.SessionRepository
	attendanceRepo *repository.AttendanceRepository
	cacheRepo      *repository.CacheRepository
	redisService   *service.RedisService
}

func NewSessionExpiryHandler(
	sessionRepo *repository.SessionRepository,
	attendanceRepo *repository.AttendanceRepository,
	cacheRepo *repository.CacheRepository,
	redisService *service.RedisService,
) *SessionExpiryHandler {
	return &SessionExpiryHandler{
		sessionRepo:    sessionRepo,
		attendanceRepo: attendanceRepo,
		cacheRepo:      cacheRepo,
		redisService:   redisService,
	}
}

func (w *SessionExpiryHandler) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	logger.Info("Session expiry handler started")

	for {
		select {
		case <-ctx.Done():
			logger.Info("Session expiry handler stopped")
			return
		case <-ticker.C:
			if err := w.handleExpiredSessions(ctx); err != nil {
				logger.Error("failed to handle expired sessions", zap.Error(err))
			}
		}
	}
}

func (w *SessionExpiryHandler) handleExpiredSessions(ctx context.Context) error {
	// Find expired but still active sessions
	expiredSessions, err := w.sessionRepo.GetExpiredSessions(ctx)
	if err != nil {
		logger.Error("failed to get expired sessions", zap.Error(err))
		return err
	}

	if len(expiredSessions) == 0 {
		logger.Debug("no expired sessions to process")
		return nil
	}

	logger.Info("processing expired sessions", zap.Int("count", len(expiredSessions)))

	for _, session := range expiredSessions {
		if err := w.processExpiredSession(ctx, session); err != nil {
			logger.Error("failed to process expired session",
				zap.String("session_id", utils.PgUUIDToUUID(session.ID).String()),
				zap.Error(err),
			)
			// Continue with next session
			continue
		}
	}

	logger.Debug("session expiry check completed")
	return nil
}

func (w *SessionExpiryHandler) processExpiredSession(ctx context.Context, session db.AttendanceSession) error {
	sessionID := utils.PgUUIDToUUID(session.ID)
	sessionIDStr := sessionID.String()

	logger.Info("processing expired session",
		zap.String("session_id", sessionIDStr),
		zap.String("course_id", utils.PgUUIDToUUID(session.CourseID).String()),
	)

	// 1. Flush any remaining buffer from Redis to PostgreSQL
	bufferData, err := w.redisService.GetBuffer(ctx, sessionIDStr)
	if err == nil && len(bufferData) > 0 {
		logger.Info("flushing remaining buffer for expired session",
			zap.String("session_id", sessionIDStr),
			zap.Int("buffer_count", len(bufferData)),
		)
		// Buffer will be flushed by buffer_flusher worker
	}

	// 2. Get all enrolled students for this course
	courseID := utils.PgUUIDToUUID(session.CourseID)
	enrolledStudents, err := w.cacheRepo.GetEnrolledStudentsByCourse(
		ctx,
		courseID,
		session.Semester,
	)
	if err != nil {
		return err
	}

	// 3. Get students who already marked attendance
	markedStudents, err := w.attendanceRepo.GetMarkedStudentsBySession(ctx, sessionID)
	if err != nil {
		return err
	}

	// 4. Create a map for quick lookup
	markedMap := make(map[string]bool)
	for _, studentID := range markedStudents {
		markedMap[studentID.String()] = true
	}

	// 5. Find absent students
	var absentStudents []uuid.UUID
	for _, enrolled := range enrolledStudents {
		enrolledID := utils.PgUUIDToUUID(enrolled.ID)
		if !markedMap[enrolledID.String()] {
			absentStudents = append(absentStudents, enrolledID)
		}
	}

	// 6. Mark absent students
	if len(absentStudents) > 0 {
		logger.Info("marking absent students for expired session",
			zap.String("session_id", sessionIDStr),
			zap.Int("absent_count", len(absentStudents)),
		)

		err = w.attendanceRepo.BatchCreateAbsentRecords(
			ctx,
			sessionID,
			courseID,
			session.Semester,
			session.WeekNumber,
			utils.PgUUIDToUUID(session.InstructorID),
			absentStudents,
		)
		if err != nil {
			return err
		}
	}

	// 7. Deactivate session
	if err := w.sessionRepo.DeactivateSession(ctx, sessionID); err != nil {
		return err
	}

	// 8. Clear all Redis keys for this session
	if err := w.redisService.ClearSessionKeys(ctx, sessionIDStr); err != nil {
		logger.Error("failed to clear redis keys for expired session",
			zap.String("session_id", sessionIDStr),
			zap.Error(err),
		)
		// Don't fail the whole process if Redis clear fails
	}

	logger.Info("expired session processed successfully",
		zap.String("session_id", sessionIDStr),
		zap.Int("absent_count", len(absentStudents)),
	)

	return nil
}
