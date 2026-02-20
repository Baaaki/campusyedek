package worker

import (
	"context"
	"time"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/repository"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/service"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"go.uber.org/zap"
)

type SessionExpiryHandler struct {
	sessionRepo  *repository.SessionRepository
	redisService *service.RedisService
}

func NewSessionExpiryHandler(
	sessionRepo *repository.SessionRepository,
	redisService *service.RedisService,
) *SessionExpiryHandler {
	return &SessionExpiryHandler{
		sessionRepo:  sessionRepo,
		redisService: redisService,
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
		sessionID := utils.PgUUIDToUUID(session.ID)
		sessionIDStr := sessionID.String()

		logger.Info("processing expired session",
			zap.String("session_id", sessionIDStr),
			zap.String("course_id", utils.PgUUIDToUUID(session.CourseID).String()),
		)

		// 1. Deactivate session
		if err := w.sessionRepo.DeactivateSession(ctx, sessionID); err != nil {
			logger.Error("failed to deactivate expired session",
				zap.String("session_id", sessionIDStr),
				zap.Error(err),
			)
			continue
		}

		// 2. Clear all Redis keys for this session
		if err := w.redisService.ClearSessionKeys(ctx, sessionIDStr); err != nil {
			logger.Error("failed to clear redis keys for expired session",
				zap.String("session_id", sessionIDStr),
				zap.Error(err),
			)
			// Don't fail the whole process if Redis clear fails
		}

		logger.Info("expired session processed successfully",
			zap.String("session_id", sessionIDStr),
		)
	}

	logger.Debug("session expiry check completed")
	return nil
}
