package handler

import (
	"context"
	"net/http"

	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/dto"
	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/service"
	sharedErrors "github.com/baaaki/mydreamcampus/shared/errors"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type SemesterHandler struct {
	semesterService *service.SemesterService
}

func NewSemesterHandler(semesterService *service.SemesterService) *SemesterHandler {
	return &SemesterHandler{
		semesterService: semesterService,
	}
}

// CreateSemesterCourse handles POST /api/v1/semesters/:semester_id/courses
// Role: Admin
func (h *SemesterHandler) CreateSemesterCourse(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	semester := c.Param("semester_id")

	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("handler", "SemesterHandler"),
		zap.String("endpoint", "CreateSemesterCourse"),
		zap.String("semester", semester),
	)

	var req dto.CreateSemesterCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		reqLogger.Error("invalid request body",
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: sharedErrors.ErrValidation.Message,
			Code:  sharedErrors.ErrValidation.Code,
		})
		return
	}

	reqLogger.Info("creating semester course",
		zap.String("course_code", req.CourseCode),
		zap.Int16("class_level", req.ClassLevel),
		zap.String("instructor_id", req.InstructorID.String()),
	)

	response, err := h.semesterService.CreateSemesterCourse(ctx, semester, req)
	if err != nil {
		if appErr, ok := sharedErrors.As(err); ok {
			reqLogger.Error("failed to create semester course",
				zap.Error(err),
				zap.String("error_code", appErr.Code),
			)
			c.JSON(appErr.HTTPStatus, dto.ErrorResponse{
				Error: appErr.Message,
				Code:  appErr.Code,
			})
			return
		}

		reqLogger.Error("unexpected error creating semester course",
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error: sharedErrors.ErrInternal.Message,
			Code:  sharedErrors.ErrInternal.Code,
		})
		return
	}

	reqLogger.Info("semester course created successfully",
		zap.String("semester_course_id", response.ID.String()),
		zap.String("course_code", response.CourseCode),
	)

	c.JSON(http.StatusCreated, response)
}

// GetSemesterCourseByID handles GET /api/v1/semesters/:semester_id/courses/:course_id
// Role: Authenticated
func (h *SemesterHandler) GetSemesterCourseByID(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	semester := c.Param("semester_id")
	courseID := c.Param("course_id")

	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("handler", "SemesterHandler"),
		zap.String("endpoint", "GetSemesterCourseByID"),
		zap.String("semester", semester),
		zap.String("course_id", courseID),
	)

	reqLogger.Info("fetching semester course")

	response, err := h.semesterService.GetSemesterCourseByID(ctx, semester, courseID)
	if err != nil {
		if appErr, ok := sharedErrors.As(err); ok {
			reqLogger.Warn("semester course not found or error",
				zap.Error(err),
				zap.String("error_code", appErr.Code),
			)
			c.JSON(appErr.HTTPStatus, dto.ErrorResponse{
				Error: appErr.Message,
				Code:  appErr.Code,
			})
			return
		}

		reqLogger.Error("unexpected error fetching semester course",
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error: sharedErrors.ErrInternal.Message,
			Code:  sharedErrors.ErrInternal.Code,
		})
		return
	}

	reqLogger.Info("semester course fetched successfully",
		zap.String("course_code", response.CourseCode),
	)

	c.JSON(http.StatusOK, response)
}

// ListSemesterCourses handles GET /api/v1/semesters/:semester_id/courses
// Role: Authenticated
func (h *SemesterHandler) ListSemesterCourses(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	semester := c.Param("semester_id")

	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("handler", "SemesterHandler"),
		zap.String("endpoint", "ListSemesterCourses"),
		zap.String("semester", semester),
	)

	var req dto.ListSemesterCoursesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		reqLogger.Error("invalid query parameters",
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: sharedErrors.ErrValidation.Message,
			Code:  sharedErrors.ErrValidation.Code,
		})
		return
	}

	// Set default pagination
	if req.Page == 0 {
		req.Page = 1
	}
	if req.Limit == 0 {
		req.Limit = defaultLimit
	}
	if req.Limit > maxPageLimit {
		req.Limit = maxPageLimit
	}

	reqLogger.Info("listing semester courses",
		zap.Int("page", req.Page),
		zap.Int("limit", req.Limit),
	)

	response, err := h.semesterService.ListSemesterCourses(ctx, semester, req)
	if err != nil {
		if appErr, ok := sharedErrors.As(err); ok {
			reqLogger.Error("failed to list semester courses",
				zap.Error(err),
				zap.String("error_code", appErr.Code),
			)
			c.JSON(appErr.HTTPStatus, dto.ErrorResponse{
				Error: appErr.Message,
				Code:  appErr.Code,
			})
			return
		}

		reqLogger.Error("unexpected error listing semester courses",
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error: sharedErrors.ErrInternal.Message,
			Code:  sharedErrors.ErrInternal.Code,
		})
		return
	}

	reqLogger.Info("semester courses listed successfully",
		zap.Int("total_records", response.Pagination.Total),
		zap.Int("returned_records", len(response.Data)),
	)

	c.JSON(http.StatusOK, response)
}

// UpdateSemesterCourse handles PUT /api/v1/semesters/:semester_id/courses/:course_id
// Role: Admin
func (h *SemesterHandler) UpdateSemesterCourse(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	semester := c.Param("semester_id")
	courseID := c.Param("course_id")

	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("handler", "SemesterHandler"),
		zap.String("endpoint", "UpdateSemesterCourse"),
		zap.String("semester", semester),
		zap.String("course_id", courseID),
	)

	var req dto.UpdateSemesterCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		reqLogger.Error("invalid request body",
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error: sharedErrors.ErrValidation.Message,
			Code:  sharedErrors.ErrValidation.Code,
		})
		return
	}

	reqLogger.Info("updating semester course")

	response, err := h.semesterService.UpdateSemesterCourse(ctx, semester, courseID, req)
	if err != nil {
		if appErr, ok := sharedErrors.As(err); ok {
			reqLogger.Error("failed to update semester course",
				zap.Error(err),
				zap.String("error_code", appErr.Code),
			)
			c.JSON(appErr.HTTPStatus, dto.ErrorResponse{
				Error: appErr.Message,
				Code:  appErr.Code,
			})
			return
		}

		reqLogger.Error("unexpected error updating semester course",
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error: sharedErrors.ErrInternal.Message,
			Code:  sharedErrors.ErrInternal.Code,
		})
		return
	}

	reqLogger.Info("semester course updated successfully",
		zap.String("course_code", response.CourseCode),
	)

	c.JSON(http.StatusOK, response)
}

// DeleteSemesterCourse handles DELETE /api/v1/semesters/:semester_id/courses/:course_id
// Role: Admin
func (h *SemesterHandler) DeleteSemesterCourse(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	semester := c.Param("semester_id")
	courseID := c.Param("course_id")

	reqLogger := logger.WithContextAndFields(ctx,
		zap.String("handler", "SemesterHandler"),
		zap.String("endpoint", "DeleteSemesterCourse"),
		zap.String("semester", semester),
		zap.String("course_id", courseID),
	)

	reqLogger.Info("deleting semester course")

	response, err := h.semesterService.DeleteSemesterCourse(ctx, semester, courseID)
	if err != nil {
		if appErr, ok := sharedErrors.As(err); ok {
			reqLogger.Error("failed to delete semester course",
				zap.Error(err),
				zap.String("error_code", appErr.Code),
			)
			c.JSON(appErr.HTTPStatus, dto.ErrorResponse{
				Error: appErr.Message,
				Code:  appErr.Code,
			})
			return
		}

		reqLogger.Error("unexpected error deleting semester course",
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error: sharedErrors.ErrInternal.Message,
			Code:  sharedErrors.ErrInternal.Code,
		})
		return
	}

	reqLogger.Info("semester course deleted successfully",
		zap.String("course_code", response.CourseCode),
	)

	c.JSON(http.StatusOK, response)
}
