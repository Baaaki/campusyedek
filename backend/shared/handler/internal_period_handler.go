package handler

import (
	"net/http"

	"github.com/baaaki/mydreamcampus/shared/dto"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/repository"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// InternalPeriodHandler provides internal endpoints for period management.
// Internal endpoint: called by catalog-service during semester setup to create
// this service's period. Protected by X-Internal-Secret header.
// Not exposed to external clients.
type InternalPeriodHandler struct {
	repo *repository.SimplePeriodRepository
}

func NewInternalPeriodHandler(repo *repository.SimplePeriodRepository) *InternalPeriodHandler {
	return &InternalPeriodHandler{repo: repo}
}

// RegisterRoutes mounts internal period endpoints.
func (h *InternalPeriodHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/periods", h.CreatePeriod)
}

// CreatePeriod handles POST /internal/periods
func (h *InternalPeriodHandler) CreatePeriod(c *gin.Context) {
	var req dto.SimpleCreatePeriodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Warn("invalid internal period request", zap.Error(err))
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

	period, err := h.repo.CreatePeriod(c.Request.Context(), repository.SimplePeriod{
		Semester:    req.Semester,
		PeriodStart: req.PeriodStart,
		PeriodEnd:   req.PeriodEnd,
		IsActive:    true,
	})
	if err != nil {
		logger.Error("failed to create period via internal endpoint", zap.Error(err))
		c.JSON(http.StatusConflict, gin.H{
			"error": "a period for this semester already exists",
			"code":  "CONFLICT",
		})
		return
	}

	logger.Info("period created via internal endpoint",
		zap.String("semester", period.Semester),
		zap.String("period_id", period.ID.String()),
	)

	c.JSON(http.StatusCreated, dto.SimplePeriodResponse{
		ID:          period.ID,
		Semester:    period.Semester,
		PeriodStart: period.PeriodStart,
		PeriodEnd:   period.PeriodEnd,
		IsActive:    period.IsActive,
		CreatedAt:   period.CreatedAt,
		UpdatedAt:   period.UpdatedAt,
	})
}
