package handler

import (
	"net/http"

	"github.com/baaaki/mydreamcampus/shared/dto"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
)

// PeriodHandler provides admin endpoints for managing academic periods.
type PeriodHandler struct {
	repo *repository.PeriodRepository
}

func NewPeriodHandler(repo *repository.PeriodRepository) *PeriodHandler {
	return &PeriodHandler{repo: repo}
}

// RegisterRoutes mounts period CRUD endpoints under the given router group.
// The caller is responsible for applying RequireAdmin() middleware.
func (h *PeriodHandler) RegisterRoutes(rg *gin.RouterGroup) {
	periods := rg.Group("/periods")
	{
		periods.POST("", h.CreatePeriod)
		periods.GET("", h.ListPeriods)
		periods.PUT("/:id", h.UpdatePeriod)
		periods.DELETE("/:id", h.DeletePeriod)
	}
}

// CreatePeriod creates a new academic period.
// POST /admin/periods
func (h *PeriodHandler) CreatePeriod(c *gin.Context) {
	var req dto.CreatePeriodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Warn("invalid create period request", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	if req.PeriodEnd.Before(req.PeriodStart) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "period_end must be after period_start",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	period, err := h.repo.CreatePeriod(c.Request.Context(), repository.AcademicPeriod{
		Semester:    req.Semester,
		CourseID:    req.CourseID,
		PeriodStart: req.PeriodStart,
		PeriodEnd:   req.PeriodEnd,
		IsActive:    true,
	})
	if err != nil {
		logger.Error("failed to create academic period", zap.Error(err))
		c.JSON(http.StatusConflict, gin.H{
			"error": "a period for this semester already exists (check course_id)",
			"code":  "CONFLICT",
		})
		return
	}

	logger.Info("academic period created",
		zap.String("semester", period.Semester),
		zap.String("period_id", period.ID.String()),
	)

	c.JSON(http.StatusCreated, toPeriodResponse(period))
}

// ListPeriods lists academic periods, optionally filtered by semester.
// GET /admin/periods?semester=2025-2026-Fall
func (h *PeriodHandler) ListPeriods(c *gin.Context) {
	semester := c.Query("semester")

	var periods []repository.AcademicPeriod
	var err error

	if semester != "" {
		periods, err = h.repo.GetPeriodsBySemester(c.Request.Context(), semester)
	} else {
		periods, err = h.repo.GetAllPeriods(c.Request.Context())
	}

	if err != nil {
		logger.Error("failed to list academic periods", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list periods",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	response := make([]dto.PeriodResponse, 0, len(periods))
	for _, p := range periods {
		response = append(response, toPeriodResponse(&p))
	}

	c.JSON(http.StatusOK, response)
}

// UpdatePeriod updates a period's end date and/or active status.
// PUT /admin/periods/:id
func (h *PeriodHandler) UpdatePeriod(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid period ID",
			"code":  "INVALID_ID",
		})
		return
	}

	var req dto.UpdatePeriodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	period, err := h.repo.UpdatePeriod(c.Request.Context(), id, req.PeriodEnd, req.IsActive)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "period not found",
				"code":  "NOT_FOUND",
			})
			return
		}
		logger.Error("failed to update academic period", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update period",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	logger.Info("academic period updated",
		zap.String("period_id", id.String()),
	)

	c.JSON(http.StatusOK, toPeriodResponse(period))
}

// DeletePeriod removes a period.
// DELETE /admin/periods/:id
func (h *PeriodHandler) DeletePeriod(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid period ID",
			"code":  "INVALID_ID",
		})
		return
	}

	if err := h.repo.DeletePeriod(c.Request.Context(), id); err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "period not found",
				"code":  "NOT_FOUND",
			})
			return
		}
		logger.Error("failed to delete academic period", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete period",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	logger.Info("academic period deleted",
		zap.String("period_id", id.String()),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "period deleted successfully",
	})
}

func toPeriodResponse(p *repository.AcademicPeriod) dto.PeriodResponse {
	return dto.PeriodResponse{
		ID:          p.ID,
		Semester:    p.Semester,
		PeriodStart: p.PeriodStart,
		PeriodEnd:   p.PeriodEnd,
		CourseID:    p.CourseID,
		IsActive:    p.IsActive,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
}
