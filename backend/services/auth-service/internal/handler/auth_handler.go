package handler

import (
	"context"
	"net/http"
	"time"

	sharedErrors "github.com/baaaki/mydreamcampus/shared/errors"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/auth-service/config"
	"github.com/baaaki/mydreamcampus/auth-service/internal/dto"
	"github.com/baaaki/mydreamcampus/auth-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const (
	requestTimeout = 10 * time.Second
)

type AuthHandler struct {
	authService *service.AuthService
	config      *config.Config
}

func NewAuthHandler(authService *service.AuthService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		config:      cfg,
	}
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	// Create child logger with request context and endpoint info
	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("endpoint", "Login"),
		zap.String("handler", "AuthHandler"),
	)

	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		reqLogger.Error("invalid request body",
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Get device info and IP
	deviceInfo := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	reqLogger.Info("login attempt",
		zap.String("email", req.Email),
		zap.String("ip", ipAddress),
	)

	// Perform login
	response, refreshToken, err := h.authService.Login(ctx, req, deviceInfo, ipAddress)
	if err != nil {
		reqLogger.Error("login failed",
			zap.Error(err),
			zap.String("email", req.Email),
		)

		if err == sharedErrors.ErrUnauthorized {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "INVALID_CREDENTIALS",
				Message: "Invalid email or password",
			})
			return
		}

		if err.Error() == "account deactivated" {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "ACCOUNT_DEACTIVATED",
				Message: "Your account has been deactivated",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "An error occurred during login",
		})
		return
	}

	reqLogger.Info("login successful",
		zap.String("email", req.Email),
		zap.String("role", response.User.Role),
	)

	// Set refresh token as HttpOnly cookie
	maxAge := h.config.JWT.RefreshTokenExpiry * 3600 // convert hours to seconds
	c.SetCookie(
		"refresh_token",
		refreshToken,
		maxAge,
		"/api/v1/auth",
		"",
		h.config.Server.Environment == "production", // Secure flag (HTTPS only in production)
		true, // HttpOnly
	)

	c.JSON(http.StatusOK, response)
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	// Create child logger with request context and endpoint info
	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("endpoint", "Logout"),
		zap.String("handler", "AuthHandler"),
	)

	// Get refresh token from cookie
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil {
		reqLogger.Warn("logout without refresh token cookie",
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "MISSING_REFRESH_TOKEN",
			Message: "Refresh token not found",
		})
		return
	}

	// Get access token from Authorization header for blacklisting
	accessToken := ""
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		accessToken = authHeader[7:]
	}

	reqLogger.Info("logout attempt")

	// Perform logout (also blacklists the access token)
	err = h.authService.Logout(ctx, refreshToken, accessToken)
	if err != nil {
		reqLogger.Error("logout failed",
			zap.Error(err),
		)
		// Don't fail logout even if there's an error
	}

	// Clear refresh token cookie
	c.SetCookie(
		"refresh_token",
		"",
		-1, // MaxAge -1 deletes the cookie
		"/api/v1/auth",
		"",
		h.config.Server.Environment == "production",
		true, // HttpOnly
	)

	reqLogger.Info("logout successful")

	c.JSON(http.StatusOK, dto.MessageResponse{
		Message: "Successfully logged out",
	})
}

// LogoutAll handles logout from all devices
func (h *AuthHandler) LogoutAll(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	// Create child logger with request context and endpoint info
	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("endpoint", "LogoutAll"),
		zap.String("handler", "AuthHandler"),
	)

	// Get user ID from JWT (set by auth middleware)
	userIDStr, exists := c.Get("user_id")
	if !exists {
		reqLogger.Warn("logout all attempted without user authentication")
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "UNAUTHORIZED",
			Message: "User not authenticated",
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		reqLogger.Error("invalid user ID format",
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_USER_ID",
			Message: "Invalid user ID",
		})
		return
	}

	reqLogger = reqLogger.With(zap.String("user_id", userID.String()))
	reqLogger.Info("logout all attempt")

	// Get access token from Authorization header for blacklisting
	accessToken := ""
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		accessToken = authHeader[7:]
	}

	// Perform logout all (also blacklists all tokens)
	err = h.authService.LogoutAll(ctx, userID, accessToken)
	if err != nil {
		reqLogger.Error("logout all failed",
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to logout from all devices",
		})
		return
	}

	reqLogger.Info("logout all successful")

	// Clear current refresh token cookie
	c.SetCookie(
		"refresh_token",
		"",
		-1,
		"/api/v1/auth",
		"",
		h.config.Server.Environment == "production",
		true,
	)

	c.JSON(http.StatusOK, dto.MessageResponse{
		Message: "Successfully logged out from all devices",
	})
}

// RefreshToken handles access token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	// Create child logger with request context and endpoint info
	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("endpoint", "RefreshToken"),
		zap.String("handler", "AuthHandler"),
	)

	// Get refresh token from cookie
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil {
		reqLogger.Warn("refresh token not found in cookie",
			zap.Error(err),
		)
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "MISSING_REFRESH_TOKEN",
			Message: "Refresh token not found",
		})
		return
	}

	reqLogger.Info("refresh token attempt")

	// Perform refresh
	response, newRefreshToken, err := h.authService.RefreshAccessToken(ctx, refreshToken)
	if err != nil {
		reqLogger.Error("refresh token failed",
			zap.Error(err),
		)

		if err == sharedErrors.ErrUnauthorized {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "INVALID_TOKEN",
				Message: "Invalid or expired refresh token",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to refresh token",
		})
		return
	}

	reqLogger.Info("refresh token successful")

	// Set new refresh token cookie
	maxAge := h.config.JWT.RefreshTokenExpiry * 3600 // convert hours to seconds
	c.SetCookie(
		"refresh_token",
		newRefreshToken,
		maxAge,
		"/api/v1/auth",
		"",
		h.config.Server.Environment == "production",
		true, // HttpOnly
	)

	c.JSON(http.StatusOK, response)
}

// ChangePassword handles password change
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	// Get user ID from JWT
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "UNAUTHORIZED",
			Message: "User not authenticated",
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_USER_ID",
			Message: "Invalid user ID",
		})
		return
	}

	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Perform password change
	response, newRefreshToken, err := h.authService.ChangePassword(ctx, userID, req)
	if err != nil {
		logger.Error("change password failed",
			zap.Error(err),
			zap.String("user_id", userID.String()),
		)

		if err == sharedErrors.ErrUnauthorized {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "INVALID_OLD_PASSWORD",
				Message: "Invalid old password",
			})
			return
		}

		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "PASSWORD_CHANGE_FAILED",
			Message: err.Error(),
		})
		return
	}

	// Set new refresh token cookie
	maxAge := h.config.JWT.RefreshTokenExpiry * 3600
	c.SetCookie(
		"refresh_token",
		newRefreshToken,
		maxAge,
		"/api/v1/auth",
		"",
		h.config.Server.Environment == "production",
		true,
	)

	c.JSON(http.StatusOK, response)
}

// GetSessions returns all active sessions for the user
func (h *AuthHandler) GetSessions(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	// Get user ID from JWT
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "UNAUTHORIZED",
			Message: "User not authenticated",
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_USER_ID",
			Message: "Invalid user ID",
		})
		return
	}

	// Get current JTI from context (set by middleware)
	currentJTI, _ := c.Get("jti")
	jti := ""
	if currentJTI != nil {
		jti = currentJTI.(string)
	}

	// Get sessions
	response, err := h.authService.GetUserSessions(ctx, userID, jti)
	if err != nil {
		logger.Error("get sessions failed",
			zap.Error(err),
			zap.String("user_id", userID.String()),
		)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to retrieve sessions",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// Verify validates the JWT token and returns user info for Traefik forward auth
// This endpoint is called by Traefik before forwarding requests to protected services
func (h *AuthHandler) Verify(c *gin.Context) {
	// Get user claims from context (set by JWT middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	role, _ := c.Get("role")
	department, _ := c.Get("department")

	// Set headers for downstream services (Traefik forwards these)
	c.Header("X-User-ID", userID.(string))
	c.Header("X-User-Role", role.(string))
	if dept, ok := department.(string); ok && dept != "" {
		c.Header("X-User-Department", dept)
	}

	c.Status(http.StatusOK)
}

// DeleteSession deletes a specific session
func (h *AuthHandler) DeleteSession(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	// Get user ID from JWT
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "UNAUTHORIZED",
			Message: "User not authenticated",
		})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_USER_ID",
			Message: "Invalid user ID",
		})
		return
	}

	// Get session ID from URL param
	sessionIDStr := c.Param("id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "INVALID_SESSION_ID",
			Message: "Invalid session ID",
		})
		return
	}

	// Get current JTI from context
	currentJTI, _ := c.Get("jti")
	jti := ""
	if currentJTI != nil {
		jti = currentJTI.(string)
	}

	// Delete session
	err = h.authService.DeleteSession(ctx, sessionID, userID, jti)
	if err != nil {
		logger.Error("delete session failed",
			zap.Error(err),
			zap.String("session_id", sessionID.String()),
		)

		if err.Error() == "cannot terminate current session, use logout instead" {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{
				Error:   "CANNOT_TERMINATE_CURRENT_SESSION",
				Message: "Aktif oturumunuzu sonlandırmak için logout endpoint'ini kullanın",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to delete session",
		})
		return
	}

	c.JSON(http.StatusOK, dto.MessageResponse{
		Message: "Session terminated successfully",
	})
}
