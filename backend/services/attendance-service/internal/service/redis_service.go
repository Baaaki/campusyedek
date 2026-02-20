package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type RedisService struct {
	client *redis.Client
}

func NewRedisService(client *redis.Client) *RedisService {
	return &RedisService{client: client}
}

// Session cache operations
func (s *RedisService) SetSessionCache(ctx context.Context, sessionID string, data map[string]any, ttl time.Duration) error {
	key := fmt.Sprintf("attendance:session:%s", sessionID)
	pipe := s.client.Pipeline()
	pipe.HSet(ctx, key, data)
	pipe.Expire(ctx, key, ttl)
	_, err := pipe.Exec(ctx)
	if err != nil {
		s.client.Expire(ctx, key, 6*time.Hour)
		return err
	}
	return nil
}

func (s *RedisService) GetSessionCache(ctx context.Context, sessionID string) (map[string]string, error) {
	key := fmt.Sprintf("attendance:session:%s", sessionID)
	return s.client.HGetAll(ctx, key).Result()
}

// Enrolled students set
func (s *RedisService) AddEnrolledStudents(ctx context.Context, sessionID string, studentIDs []uuid.UUID) error {
	key := fmt.Sprintf("attendance:session:%s:enrolled", sessionID)
	members := make([]any, len(studentIDs))
	for i, id := range studentIDs {
		members[i] = id.String()
	}
	return s.client.SAdd(ctx, key, members...).Err()
}

func (s *RedisService) IsStudentEnrolled(ctx context.Context, sessionID, studentID string) (bool, error) {
	key := fmt.Sprintf("attendance:session:%s:enrolled", sessionID)
	return s.client.SIsMember(ctx, key, studentID).Result()
}

// IsAlreadyScanned checks if student already scanned this session (SISMEMBER on persistent SET - O(1))
// This SET persists until session closes, unlike buffer which gets flushed every 5s
func (s *RedisService) IsAlreadyScanned(ctx context.Context, sessionID, studentID string) (bool, error) {
	key := fmt.Sprintf("attendance:scanned:%s", sessionID)
	return s.client.SIsMember(ctx, key, studentID).Result()
}

// AddToBuffer writes scan data to buffer and marks student as scanned (atomic pipeline)
// Pipeline: HSET buffer + SADD scanned + EXPIRE scanned (3 commands, 1 round-trip)
func (s *RedisService) AddToBuffer(ctx context.Context, sessionID, studentID, data string, scannedTTL time.Duration) error {
	bufferKey := fmt.Sprintf("attendance:buffer:%s", sessionID)
	scannedKey := fmt.Sprintf("attendance:scanned:%s", sessionID)
	pipe := s.client.Pipeline()
	pipe.HSet(ctx, bufferKey, studentID, data)
	pipe.SAdd(ctx, scannedKey, studentID)
	pipe.Expire(ctx, scannedKey, scannedTTL)
	_, err := pipe.Exec(ctx)
	return err
}

func (s *RedisService) GetBuffer(ctx context.Context, sessionID string) (map[string]string, error) {
	key := fmt.Sprintf("attendance:buffer:%s", sessionID)
	return s.client.HGetAll(ctx, key).Result()
}

// Clear all session keys
func (s *RedisService) ClearSessionKeys(ctx context.Context, sessionID string) error {
	keys := []string{
		fmt.Sprintf("attendance:session:%s", sessionID),
		fmt.Sprintf("attendance:session:%s:enrolled", sessionID),
		fmt.Sprintf("attendance:buffer:%s", sessionID),
		fmt.Sprintf("attendance:scanned:%s", sessionID),
	}
	return s.client.Del(ctx, keys...).Err()
}

// Student summary cache
func (s *RedisService) InvalidateStudentSummary(ctx context.Context, studentID uuid.UUID, semester string) error {
	key := fmt.Sprintf("attendance:student:%s:summary:%s", studentID.String(), semester)
	return s.client.Del(ctx, key).Err()
}

// Get all buffer keys (for buffer flusher worker)
func (s *RedisService) GetAllBufferKeys(ctx context.Context) ([]string, error) {
	pattern := "attendance:buffer:*"
	return s.client.Keys(ctx, pattern).Result()
}

// Clear buffer after successful flush
func (s *RedisService) ClearBuffer(ctx context.Context, bufferKey string) error {
	return s.client.Del(ctx, bufferKey).Err()
}
