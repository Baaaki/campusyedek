package middleware

import (
	"context"
	"strings"

	"github.com/baaaki/mydreamcampus/shared/errors"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TokenBlacklistChecker interface for checking token blacklist
// Implemented by redis.ClientWrapper
type TokenBlacklistChecker interface {
	IsAccessTokenBlacklisted(ctx context.Context, jti string) (bool, error)
	GetMinTokenVersion(ctx context.Context, userID string) (int, error)
}

// blacklistChecker is the global blacklist checker (set by auth service)
var blacklistChecker TokenBlacklistChecker

// SetBlacklistChecker sets the global blacklist checker
// Should be called during auth service initialization
func SetBlacklistChecker(checker TokenBlacklistChecker) {
	blacklistChecker = checker
}

// JWTAuth validates JWT token and sets user claims in context
func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			logger.Warn("missing authorization header")
			c.JSON(401, gin.H{
				"error":   errors.ErrUnauthorized.Code,
				"message": "Authorization header is required",
			})
			c.Abort()
			return
		}

		// Parse Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			logger.Warn("invalid authorization header format",
				zap.String("auth_header", authHeader),
				zap.Int("parts_count", len(parts)),
			)
			c.JSON(401, gin.H{
				"error":   errors.ErrUnauthorized.Code,
				"message": "Authorization header must be 'Bearer <token>'",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := utils.ValidateToken(tokenString)
		if err != nil {
			logger.Warn("token validation failed",
				zap.Error(err),
				zap.String("ip", c.ClientIP()),
			)

			var errMsg string
			if err == utils.ErrExpiredToken {
				errMsg = "Token has expired"
			} else {
				errMsg = "Invalid token"
			}

			c.JSON(401, gin.H{
				"error":   errors.ErrUnauthorized.Code,
				"message": errMsg,
			})
			c.Abort()
			return
		}

		// Check blacklist if checker is configured (Redis available)
		if blacklistChecker != nil {
			ctx := c.Request.Context()

			// Check if specific token JTI is blacklisted
			if claims.JTI != "" {
				isBlacklisted, err := blacklistChecker.IsAccessTokenBlacklisted(ctx, claims.JTI)
				if err != nil {
					logger.Error("failed to check token blacklist",
						zap.Error(err),
						zap.String("jti", claims.JTI),
					)
					// Continue on error - fail open for availability
				} else if isBlacklisted {
					logger.Warn("blacklisted token used",
						zap.String("user_id", claims.UserID),
						zap.String("jti", claims.JTI),
					)
					c.JSON(401, gin.H{
						"error":   errors.ErrUnauthorized.Code,
						"message": "Token has been revoked",
					})
					c.Abort()
					return
				}
			}

			// Check token version (for logout-all scenarios)
			minVersion, err := blacklistChecker.GetMinTokenVersion(ctx, claims.UserID)
			if err != nil {
				logger.Error("failed to check min token version",
					zap.Error(err),
					zap.String("user_id", claims.UserID),
				)
				// Continue on error - fail open for availability
			} else if minVersion > 0 && claims.TokenVersion < minVersion {
				logger.Warn("token version too old - all tokens revoked",
					zap.String("user_id", claims.UserID),
					zap.Int("token_version", claims.TokenVersion),
					zap.Int("min_version", minVersion),
				)
				c.JSON(401, gin.H{
					"error":   errors.ErrUnauthorized.Code,
					"message": "Token has been revoked",
				})
				c.Abort()
				return
			}
		}

		// Set claims in context for downstream handlers
		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Set("department", claims.Department)
		c.Set("token_version", claims.TokenVersion)
		c.Set("jti", claims.JTI)

		logger.Debug("jwt authentication successful",
			zap.String("user_id", claims.UserID),
			zap.String("role", claims.Role),
		)

		c.Next()
	}
}

// OptionalJWTAuth validates JWT if present, but doesn't require it
func OptionalJWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]
		claims, err := utils.ValidateToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Set("department", claims.Department)
		c.Set("token_version", claims.TokenVersion)

		c.Next()
	}
}

// ExtractUserFromHeaders extracts user information from X-User-* headers
// These headers are set by Traefik after forward-auth to auth-service
// Use this middleware for services that rely on Traefik for authentication
func ExtractUserFromHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract user ID from header (required)
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			logger.Warn("missing X-User-ID header - request not authenticated via Traefik")
			c.JSON(401, gin.H{
				"error":   errors.ErrUnauthorized.Code,
				"message": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Extract role from header (required)
		role := c.GetHeader("X-User-Role")
		if role == "" {
			logger.Warn("missing X-User-Role header",
				zap.String("user_id", userID),
			)
			c.JSON(401, gin.H{
				"error":   errors.ErrUnauthorized.Code,
				"message": "User role not found",
			})
			c.Abort()
			return
		}

		// Extract department from header (optional)
		department := c.GetHeader("X-User-Department")

		// Set user information in context for downstream handlers
		c.Set("user_id", userID)
		c.Set("role", role)
		if department != "" {
			c.Set("department", department)
		}

		logger.Debug("user extracted from headers",
			zap.String("user_id", userID),
			zap.String("role", role),
		)

		c.Next()
	}
}
