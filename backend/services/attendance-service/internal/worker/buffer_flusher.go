package worker

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/db"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/repository"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/service"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"go.uber.org/zap"
)

type BufferFlusher struct {
	attendanceRepo *repository.AttendanceRepository
	redisService   *service.RedisService
}

func NewBufferFlusher(
	attendanceRepo *repository.AttendanceRepository,
	redisService   *service.RedisService,
) *BufferFlusher {
	return &BufferFlusher{
		attendanceRepo: attendanceRepo,
		redisService:   redisService,
	}
}

func (w *BufferFlusher) Start(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	logger.Info("Buffer flusher started")

	for {
		select {
		case <-ctx.Done():
			logger.Info("Buffer flusher stopped")
			return
		case <-ticker.C:
			if err := w.flushBuffers(ctx); err != nil {
				logger.Error("failed to flush buffers", zap.Error(err))
			}
		}
	}
}

func (w *BufferFlusher) flushBuffers(ctx context.Context) error {
	// Get all session buffer keys from Redis (pattern: attendance:buffer:*)
	bufferKeys, err := w.redisService.GetAllBufferKeys(ctx)
	if err != nil {
		logger.Error("failed to get buffer keys", zap.Error(err))
		return err
	}

	if len(bufferKeys) == 0 {
		logger.Debug("no buffers to flush")
		return nil
	}

	logger.Info("flushing buffers", zap.Int("buffer_count", len(bufferKeys)))

	// Process each buffer
	for _, key := range bufferKeys {
		if err := w.flushSingleBuffer(ctx, key); err != nil {
			logger.Error("failed to flush buffer",
				zap.String("key", key),
				zap.Error(err),
			)
			// Continue to next buffer on error
			continue
		}
	}

	logger.Debug("buffer flush cycle completed")
	return nil
}

func (w *BufferFlusher) flushSingleBuffer(ctx context.Context, bufferKey string) error {
	// Extract sessionID from key (format: attendance:buffer:SESSION_ID)
	parts := strings.Split(bufferKey, ":")
	if len(parts) != 3 {
		return nil
	}
	sessionID := parts[2]

	// Get all records from this buffer as map[studentID]jsonData
	bufferData, err := w.redisService.GetBuffer(ctx, sessionID)
	if err != nil {
		return err
	}

	if len(bufferData) == 0 {
		return nil
	}

	logger.Info("flushing buffer",
		zap.String("buffer", bufferKey),
		zap.Int("record_count", len(bufferData)),
	)

	// Batch insert to PostgreSQL
	successCount := 0
	for studentID, jsonData := range bufferData {
		var record db.CreateAttendanceRecordQRParams
		if err := json.Unmarshal([]byte(jsonData), &record); err != nil {
			logger.Error("failed to unmarshal buffered record",
				zap.String("student_id", studentID),
				zap.Error(err),
			)
			continue
		}

		if err := w.attendanceRepo.CreateAttendanceRecordQR(ctx, record); err != nil {
			logger.Error("failed to insert buffered record",
				zap.String("student_id", studentID),
				zap.Error(err),
			)
			continue
		}
		successCount++
	}

	// Delete processed records from buffer
	if successCount > 0 {
		if err := w.redisService.ClearBuffer(ctx, bufferKey); err != nil {
			logger.Error("failed to clear buffer after flush",
				zap.String("buffer", bufferKey),
				zap.Error(err),
			)
		}
	}

	logger.Info("buffer flushed successfully",
		zap.String("buffer", bufferKey),
		zap.Int("success_count", successCount),
		zap.Int("total_count", len(bufferData)),
	)

	return nil
}
