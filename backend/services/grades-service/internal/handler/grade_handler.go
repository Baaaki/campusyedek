package handler

import (
	"net/http"

	"github.com/baaaki/mydreamcampus/grades-service/internal/dto"
	"github.com/baaaki/mydreamcampus/grades-service/internal/service"
	sharedErrors "github.com/baaaki/mydreamcampus/shared/errors"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type GradeHandler struct {
	gradeService        *service.GradeService
	studentGradeService *service.StudentGradesService
}

func NewGradeHandler(
	gradeService *service.GradeService,
	studentGradeService *service.StudentGradesService,
) *GradeHandler {
	return &GradeHandler{
		gradeService:        gradeService,
		studentGradeService: studentGradeService,
	}
}

// ============================================
// Instructor Endpoints
// ============================================

// GetCourseStatus - GET /api/v1/grades/course/:courseId/status
func (h *GradeHandler) GetCourseStatus(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "GradeHandler"),
		zap.String("method", "GetCourseStatus"),
	)

	// Get instructor ID from JWT context
	instructorID, exists := c.Get("user_id")
	if !exists {
		handlerLogger.Error("user_id not found in context")
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error: sharedErrors.ErrUnauthorized.Message,
			Code:  sharedErrors.ErrUnauthorized.Code,
		})
		return
	}

	// Parse course ID
	courseIDStr := c.Param("courseId")
	courseID, err := uuid.Parse(courseIDStr)
	if err != nil {
		handlerLogger.Error("invalid course ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid course ID",
			Code:  "INVALID_ID",
		})
		return
	}

	handlerLogger.Info("getting course status",
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
		zap.String("course_id", courseID.String()),
	)

	// Get course status
	status, err := h.gradeService.GetCourseStatus(c.Request.Context(), instructorID.(uuid.UUID), courseID)
	if err != nil {
		handlerLogger.Error("failed to get course status", zap.Error(err))
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetCourseStudents - GET /api/v1/grades/course/:courseId/students
func (h *GradeHandler) GetCourseStudents(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "GradeHandler"),
		zap.String("method", "GetCourseStudents"),
	)

	// Get instructor ID from JWT context
	instructorID, exists := c.Get("user_id")
	if !exists {
		handlerLogger.Error("user_id not found in context")
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error: sharedErrors.ErrUnauthorized.Message,
			Code:  sharedErrors.ErrUnauthorized.Code,
		})
		return
	}

	// Parse course ID
	courseIDStr := c.Param("courseId")
	courseID, err := uuid.Parse(courseIDStr)
	if err != nil {
		handlerLogger.Error("invalid course ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid course ID",
			Code:  "INVALID_ID",
		})
		return
	}

	handlerLogger.Info("getting course students",
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
		zap.String("course_id", courseID.String()),
	)

	// Get course students
	students, err := h.gradeService.GetCourseStudents(c.Request.Context(), instructorID.(uuid.UUID), courseID)
	if err != nil {
		handlerLogger.Error("failed to get course students", zap.Error(err))
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, students)
}

// SubmitScore - POST /api/v1/grades/course/:courseId/scores
func (h *GradeHandler) SubmitScore(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "GradeHandler"),
		zap.String("method", "SubmitScore"),
	)

	// Get instructor ID from JWT context
	instructorID, exists := c.Get("user_id")
	if !exists {
		handlerLogger.Error("user_id not found in context")
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error: sharedErrors.ErrUnauthorized.Message,
			Code:  sharedErrors.ErrUnauthorized.Code,
		})
		return
	}

	// Parse course ID
	courseIDStr := c.Param("courseId")
	courseID, err := uuid.Parse(courseIDStr)
	if err != nil {
		handlerLogger.Error("invalid course ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid course ID",
			Code:  "INVALID_ID",
		})
		return
	}

	// Parse request body
	var req dto.SubmitScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handlerLogger.Error("invalid request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: sharedErrors.ErrValidation.Message,
			Code:  sharedErrors.ErrValidation.Code,
		})
		return
	}

	handlerLogger.Info("submitting score",
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
		zap.String("course_id", courseID.String()),
		zap.String("registration_id", req.RegistrationID.String()),
	)

	// Submit score
	result, err := h.gradeService.SubmitScore(c.Request.Context(), instructorID.(uuid.UUID), courseID, req)
	if err != nil {
		handlerLogger.Error("failed to submit score", zap.Error(err))
		h.handleError(c, err)
		return
	}

	handlerLogger.Info("score submitted successfully")
	c.JSON(http.StatusCreated, result)
}

// BulkSubmitScores - POST /api/v1/grades/course/:courseId/scores/bulk
func (h *GradeHandler) BulkSubmitScores(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "GradeHandler"),
		zap.String("method", "BulkSubmitScores"),
	)

	// Get instructor ID from JWT context
	instructorID, exists := c.Get("user_id")
	if !exists {
		handlerLogger.Error("user_id not found in context")
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error: sharedErrors.ErrUnauthorized.Message,
			Code:  sharedErrors.ErrUnauthorized.Code,
		})
		return
	}

	// Parse course ID
	courseIDStr := c.Param("courseId")
	courseID, err := uuid.Parse(courseIDStr)
	if err != nil {
		handlerLogger.Error("invalid course ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid course ID",
			Code:  "INVALID_ID",
		})
		return
	}

	// Parse request body
	var req dto.BulkSubmitScoresRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handlerLogger.Error("invalid request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: sharedErrors.ErrValidation.Message,
			Code:  sharedErrors.ErrValidation.Code,
		})
		return
	}

	handlerLogger.Info("bulk submitting scores",
		zap.String("instructor_id", instructorID.(uuid.UUID).String()),
		zap.String("course_id", courseID.String()),
		zap.Int("score_count", len(req.Scores)),
	)

	// Bulk submit scores
	result, err := h.gradeService.BulkSubmitScores(c.Request.Context(), instructorID.(uuid.UUID), courseID, req)
	if err != nil {
		handlerLogger.Error("failed to bulk submit scores", zap.Error(err))
		h.handleError(c, err)
		return
	}

	handlerLogger.Info("bulk scores submitted successfully",
		zap.Int("success_count", result.SuccessCount),
		zap.Bool("auto_finalized", result.AutoFinalized),
	)
	c.JSON(http.StatusCreated, result)
}

// ============================================
// Student Endpoints
// ============================================

// GetMyGrades - GET /api/v1/grades/student/my
func (h *GradeHandler) GetMyGrades(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "GradeHandler"),
		zap.String("method", "GetMyGrades"),
	)

	// Get student ID from JWT context
	studentID, exists := c.Get("user_id")
	if !exists {
		handlerLogger.Error("user_id not found in context")
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error: sharedErrors.ErrUnauthorized.Message,
			Code:  sharedErrors.ErrUnauthorized.Code,
		})
		return
	}

	handlerLogger.Info("getting my grades",
		zap.String("student_id", studentID.(uuid.UUID).String()),
	)

	// Get my grades
	grades, err := h.studentGradeService.GetMyGrades(c.Request.Context(), studentID.(uuid.UUID))
	if err != nil {
		handlerLogger.Error("failed to get my grades", zap.Error(err))
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, grades)
}

// GetTranscript - GET /api/v1/grades/transcript/:studentId
func (h *GradeHandler) GetTranscript(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "GradeHandler"),
		zap.String("method", "GetTranscript"),
	)

	// Get requester info from JWT context
	requesterID, exists := c.Get("user_id")
	if !exists {
		handlerLogger.Error("user_id not found in context")
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error: sharedErrors.ErrUnauthorized.Message,
			Code:  sharedErrors.ErrUnauthorized.Code,
		})
		return
	}

	requesterRole, exists := c.Get("role")
	if !exists {
		handlerLogger.Error("role not found in context")
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error: sharedErrors.ErrUnauthorized.Message,
			Code:  sharedErrors.ErrUnauthorized.Code,
		})
		return
	}

	// Parse student ID
	studentIDStr := c.Param("studentId")
	studentID, err := uuid.Parse(studentIDStr)
	if err != nil {
		handlerLogger.Error("invalid student ID format", zap.Error(err))
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: "invalid student ID",
			Code:  "INVALID_ID",
		})
		return
	}

	handlerLogger.Info("getting transcript",
		zap.String("requester_id", requesterID.(uuid.UUID).String()),
		zap.String("requester_role", requesterRole.(string)),
		zap.String("student_id", studentID.String()),
	)

	// Get transcript
	transcript, err := h.studentGradeService.GetTranscript(
		c.Request.Context(),
		requesterID.(uuid.UUID),
		requesterRole.(string),
		studentID,
	)
	if err != nil {
		handlerLogger.Error("failed to get transcript", zap.Error(err))
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, transcript)
}

// ============================================
// Helper Functions
// ============================================

// handleError maps service errors to HTTP status codes
func (h *GradeHandler) handleError(c *gin.Context, err error) {
	reqLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "GradeHandler"),
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
