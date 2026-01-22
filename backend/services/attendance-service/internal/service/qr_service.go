package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/dto"
)

type QRService struct{}

func NewQRService() *QRService {
	return &QRService{}
}

// GenerateSecret generates a random secret for QR signing
func (s *QRService) GenerateSecret() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// GenerateQRPayload generates QR payload with HMAC signature
func (s *QRService) GenerateQRPayload(sessionID, secret string, rotationInterval int16) dto.QRPayload {
	now := time.Now().Unix()
	window := now / int64(rotationInterval)
	
	message := fmt.Sprintf("%s|%d", sessionID, window)
	signature := s.calculateHMAC(secret, message)
	
	return dto.QRPayload{
		SessionID: sessionID,
		Timestamp: now,
		Signature: signature,
	}
}

// ValidateQRSignature validates QR signature
func (s *QRService) ValidateQRSignature(payload dto.QRPayload, secret string, rotationInterval int16) bool {
	currentWindow := time.Now().Unix() / int64(rotationInterval)
	payloadWindow := payload.Timestamp / int64(rotationInterval)
	
	// Check current window
	message := fmt.Sprintf("%s|%d", payload.SessionID, currentWindow)
	if s.calculateHMAC(secret, message) == payload.Signature {
		return true
	}
	
	// Check previous window (grace period)
	if currentWindow > 0 {
		prevWindow := currentWindow - 1
		message = fmt.Sprintf("%s|%d", payload.SessionID, prevWindow)
		if s.calculateHMAC(secret, message) == payload.Signature {
			return true
		}
	}
	
	// Check if payload is from exact window
	message = fmt.Sprintf("%s|%d", payload.SessionID, payloadWindow)
	if s.calculateHMAC(secret, message) == payload.Signature {
		return true
	}
	
	return false
}

// IsTimestampFresh checks if timestamp is within acceptable range
func (s *QRService) IsTimestampFresh(timestamp int64, rotationInterval int16) bool {
	maxAge := int64(rotationInterval) * 3 // 3x rotation interval
	now := time.Now().Unix()
	return (now - timestamp) <= maxAge
}

func (s *QRService) calculateHMAC(secret, message string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}
