package handler

import (
	"net/http"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/dto"
	"github.com/baaaki/mydreamcampus/attendance-service/internal/service"
	sharedErrors "github.com/baaaki/mydreamcampus/shared/errors"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type AttendanceHandler struct {
	service *service.AttendanceService
}

func NewAttendanceHandler(service *service.AttendanceService) *AttendanceHandler {
	return &AttendanceHandler{service: service}
}

// CreateSession godoc
// @Summary Create attendance session
// @Tags attendance
// @Accept json
// @Produce json
// @Param request body dto.CreateSessionRequest true "Session details"
// @Success 201 {object} dto.CreateSessionResponse
// @Router /api/v1/attendance/sessions [post]
func (h *AttendanceHandler) CreateSession(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "AttendanceHandler"),
		zap.String("method", "CreateSession"),
	)

	var req dto.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handlerLogger.Error("invalid request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: sharedErrors.ErrValidation.Message,
			Code:  sharedErrors.ErrValidation.Code,
		})
		return
	}

	// Get instructor ID from JWT
	instructorID, _ := c.Get("user_id")

	handlerLogger.Info("creating attendance session",
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
		zap.String("course_id", req.CourseID.String()),
	)

	resp, err := h.service.CreateSession(c.Request.Context(), instructorID.(uuid.UUID), req)
	if err != nil {
		handlerLogger.Error("failed to create session", zap.Error(err))
		h.handleError(c, err)
		return
	}

	handlerLogger.Info("session created successfully",
		zap.String("session_id", resp.SessionID.String()),
	)
	c.JSON(http.StatusCreated, resp)
}

// ScanQR godoc
// @Summary Scan QR code for attendance
// @Tags attendance
// @Accept json
// @Produce json
// @Param request body dto.ScanQRRequest true "QR payload"
// @Success 200 {object} dto.ScanQRResponse
// @Router /api/v1/attendance/scan [post]
func (h *AttendanceHandler) ScanQR(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "AttendanceHandler"),
		zap.String("method", "ScanQR"),
	)

	var req dto.ScanQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handlerLogger.Error("invalid request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: sharedErrors.ErrValidation.Message,
			Code:  sharedErrors.ErrValidation.Code,
		})
		return
	}

	// Get student ID from JWT
	studentID, _ := c.Get("user_id")

	handlerLogger.Info("scanning QR code",
		zap.String("student_id", studentID.(uuid.UUID).String()),
	)

	resp, err := h.service.ScanQR(c.Request.Context(), studentID.(uuid.UUID), req)
	if err != nil {
		handlerLogger.Error("failed to scan QR", zap.Error(err))
		h.handleError(c, err)
		return
	}

	handlerLogger.Info("QR scanned successfully")
	c.JSON(http.StatusOK, resp)
}

// GetQRCode godoc
// @Summary Get QR code data for session
// @Tags attendance
// @Produce json
// @Param sessionId path string true "Session ID"
// @Success 200 {object} dto.GetQRResponse
// @Router /api/v1/attendance/sessions/{sessionId}/qr [get]
func (h *AttendanceHandler) GetQRCode(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "AttendanceHandler"),
		zap.String("method", "GetQRCode"),
	)

	sessionID, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		handlerLogger.Error("invalid session ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid session ID",
			Code:  "INVALID_ID",
		})
		return
	}

	instructorID, _ := c.Get("user_id")

	handlerLogger.Info("getting QR code",
		zap.String("session_id", sessionID.String()),
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
	)

	resp, err := h.service.GetQRCode(c.Request.Context(), sessionID, instructorID.(uuid.UUID))
	if err != nil {
		handlerLogger.Error("failed to get QR code", zap.Error(err))
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// CreateManualAttendance godoc
// @Summary Create manual attendance record
// @Tags attendance
// @Accept json
// @Produce json
// @Param sessionId path string true "Session ID"
// @Param request body dto.ManualAttendanceRequest true "Manual attendance details"
// @Success 201 {object} dto.ManualAttendanceResponse
// @Router /api/v1/attendance/sessions/{sessionId}/manual [post]
func (h *AttendanceHandler) CreateManualAttendance(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "AttendanceHandler"),
		zap.String("method", "CreateManualAttendance"),
	)

	sessionID, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		handlerLogger.Error("invalid session ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid session ID",
			Code:  "INVALID_ID",
		})
		return
	}

	var req dto.ManualAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handlerLogger.Error("invalid request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: sharedErrors.ErrValidation.Message,
			Code:  sharedErrors.ErrValidation.Code,
		})
		return
	}

	instructorID, _ := c.Get("user_id")

	handlerLogger.Info("creating manual attendance",
		zap.String("session_id", sessionID.String()),
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
	)

	resp, err := h.service.CreateManualAttendance(c.Request.Context(), sessionID, instructorID.(uuid.UUID), req)
	if err != nil {
		handlerLogger.Error("failed to create manual attendance", zap.Error(err))
		h.handleError(c, err)
		return
	}

	handlerLogger.Info("manual attendance created successfully")
	c.JSON(http.StatusCreated, resp)
}

// CloseSession godoc
// @Summary Close session and mark absent students
// @Tags attendance
// @Produce json
// @Param sessionId path string true "Session ID"
// @Success 200 {object} dto.CloseSessionResponse
// @Router /api/v1/attendance/sessions/{sessionId}/close [post]
func (h *AttendanceHandler) CloseSession(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "AttendanceHandler"),
		zap.String("method", "CloseSession"),
	)

	sessionID, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		handlerLogger.Error("invalid session ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid session ID",
			Code:  "INVALID_ID",
		})
		return
	}

	instructorID, _ := c.Get("user_id")

	handlerLogger.Info("closing session",
		zap.String("session_id", sessionID.String()),
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
	)

	resp, err := h.service.CloseSession(c.Request.Context(), sessionID, instructorID.(uuid.UUID))
	if err != nil {
		handlerLogger.Error("failed to close session", zap.Error(err))
		h.handleError(c, err)
		return
	}

	handlerLogger.Info("session closed successfully",
		zap.Int("total_present", resp.Summary.PresentCount),
		zap.Int("total_absent", resp.Summary.AbsentCount),
	)
	c.JSON(http.StatusOK, resp)
}

// GetMyAttendance godoc
// @Summary Get my attendance records
// @Tags attendance
// @Produce json
// @Param semester query string false "Semester"
// @Success 200 {object} dto.GetMyAttendanceResponse
// @Router /api/v1/attendance/my [get]
func (h *AttendanceHandler) GetMyAttendance(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "AttendanceHandler"),
		zap.String("method", "GetMyAttendance"),
	)

	semester := c.Query("semester")
	studentID, _ := c.Get("user_id")

	handlerLogger.Info("getting attendance records",
		zap.String("student_id", studentID.(uuid.UUID).String()),
		zap.String("semester", semester),
	)

	resp, err := h.service.GetMyAttendance(c.Request.Context(), studentID.(uuid.UUID), semester)
	if err != nil {
		handlerLogger.Error("failed to get attendance", zap.Error(err))
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// FinalizeAttendance godoc
// @Summary Finalize attendance for course
// @Tags attendance
// @Produce json
// @Param courseId path string true "Course ID"
// @Param semester query string true "Semester"
// @Success 200 {object} dto.FinalizeAttendanceResponse
// @Router /api/v1/attendance/courses/{courseId}/finalize [post]
func (h *AttendanceHandler) FinalizeAttendance(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "AttendanceHandler"),
		zap.String("method", "FinalizeAttendance"),
	)

	courseID, err := uuid.Parse(c.Param("courseId"))
	if err != nil {
		handlerLogger.Error("invalid course ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid course ID",
			Code:  "INVALID_ID",
		})
		return
	}

	semester := c.Query("semester")
	if semester == "" {
		handlerLogger.Error("semester query parameter is required")
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "semester is required",
			Code:  "VALIDATION_ERROR",
		})
		return
	}

	instructorID, _ := c.Get("user_id")

	handlerLogger.Info("finalizing attendance",
		zap.String("course_id", courseID.String()),
		zap.String("semester", semester),
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
	)

	resp, err := h.service.FinalizeAttendance(c.Request.Context(), courseID, instructorID.(uuid.UUID), semester)
	if err != nil {
		handlerLogger.Error("failed to finalize attendance", zap.Error(err))
		h.handleError(c, err)
		return
	}

	handlerLogger.Info("attendance finalized successfully",
		zap.Int("total_students", resp.TotalStudents),
		zap.Int("failed_students", len(resp.FailedStudents)),
	)
	c.JSON(http.StatusOK, resp)
}

// handleError maps service errors to HTTP status codes
func (h *AttendanceHandler) handleError(c *gin.Context, err error) {
	reqLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "AttendanceHandler"),
		zap.String("method", "handleError"),
	)

	// Try to extract AppError
	if appErr, ok := sharedErrors.As(err); ok {
		reqLogger.Warn("application error",
			zap.Error(err),
			zap.String("error_code", appErr.Code),
		)
		c.JSON(appErr.HTTPStatus, dto.ErrorResponse{
			Error: appErr.Message,
			Code:  appErr.Code,
		})
		return
	}

	// Unexpected error (not an AppError)
	reqLogger.Error("unexpected error",
		zap.Error(err),
	)
	c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
		Error: sharedErrors.ErrInternal.Message,
		Code:  sharedErrors.ErrInternal.Code,
	})
}
