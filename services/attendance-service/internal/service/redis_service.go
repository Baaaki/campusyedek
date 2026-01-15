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
func (s *RedisService) SetSessionCache(ctx context.Context, sessionID string, data map[string]interface{}, ttl time.Duration) error {
	key := fmt.Sprintf("attendance:session:%s", sessionID)
	return s.client.HSet(ctx, key, data).Err()
}

func (s *RedisService) GetSessionCache(ctx context.Context, sessionID string) (map[string]string, error) {
	key := fmt.Sprintf("attendance:session:%s", sessionID)
	return s.client.HGetAll(ctx, key).Result()
}

// Enrolled students set
func (s *RedisService) AddEnrolledStudents(ctx context.Context, sessionID string, studentIDs []uuid.UUID) error {
	key := fmt.Sprintf("attendance:session:%s:enrolled", sessionID)
	members := make([]interface{}, len(studentIDs))
	for i, id := range studentIDs {
		members[i] = id.String()
	}
	return s.client.SAdd(ctx, key, members...).Err()
}

func (s *RedisService) IsStudentEnrolled(ctx context.Context, sessionID, studentID string) (bool, error) {
	key := fmt.Sprintf("attendance:session:%s:enrolled", sessionID)
	return s.client.SIsMember(ctx, key, studentID).Result()
}

// Marked students check
func (s *RedisService) IsAlreadyMarked(ctx context.Context, sessionID, studentID string) (bool, error) {
	key := fmt.Sprintf("attendance:marked:%s", sessionID)
	return s.client.SIsMember(ctx, key, studentID).Result()
}

func (s *RedisService) MarkStudentPresent(ctx context.Context, sessionID, studentID string) error {
	key := fmt.Sprintf("attendance:marked:%s", sessionID)
	return s.client.SAdd(ctx, key, studentID).Err()
}

// Buffer operations
func (s *RedisService) AddToBuffer(ctx context.Context, sessionID, studentID, data string) error {
	key := fmt.Sprintf("attendance:buffer:%s", sessionID)
	return s.client.HSet(ctx, key, studentID, data).Err()
}

func (s *RedisService) GetBuffer(ctx context.Context, sessionID string) (map[string]string, error) {
	key := fmt.Sprintf("attendance:buffer:%s", sessionID)
	return s.client.HGetAll(ctx, key).Result()
}

func (s *RedisService) DeleteBufferFields(ctx context.Context, sessionID string, studentIDs []string) error {
	if len(studentIDs) == 0 {
		return nil
	}
	key := fmt.Sprintf("attendance:buffer:%s", sessionID)
	return s.client.HDel(ctx, key, studentIDs...).Err()
}

// Clear all session keys
func (s *RedisService) ClearSessionKeys(ctx context.Context, sessionID string) error {
	keys := []string{
		fmt.Sprintf("attendance:session:%s", sessionID),
		fmt.Sprintf("attendance:session:%s:enrolled", sessionID),
		fmt.Sprintf("attendance:marked:%s", sessionID),
		fmt.Sprintf("attendance:buffer:%s", sessionID),
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
