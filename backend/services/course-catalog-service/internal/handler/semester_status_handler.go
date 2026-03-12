package handler

import (
	"net/http"
	"regexp"
	"time"

	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/db"
	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/repository"
	"github.com/baaaki/mydreamcampus/shared/audit"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var semesterNameRegex = regexp.MustCompile(`^\d{4}-\d{4}-(Fall|Spring)$`)

type SemesterStatusHandler struct {
	repo        *repository.SemesterStatusRepository
	auditLogger audit.Logger
}

func NewSemesterStatusHandler(repo *repository.SemesterStatusRepository, auditLogger audit.Logger) *SemesterStatusHandler {
	return &SemesterStatusHandler{repo: repo, auditLogger: auditLogger}
}

// RegisterRoutes mounts semester status management endpoints under admin group.
func (h *SemesterStatusHandler) RegisterRoutes(rg *gin.RouterGroup) {
	semesters := rg.Group("/semesters")
	{
		semesters.POST("", h.CreateSemester)
		semesters.GET("", h.ListSemesters)
		semesters.GET("/active", h.GetActiveSemester)
		semesters.PUT("/:id/activate", h.ActivateSemester)
		semesters.PUT("/:id/complete", h.CompleteSemester)
	}
}

// RegisterInternalRoutes mounts internal endpoints for service-to-service communication.
func (h *SemesterStatusHandler) RegisterInternalRoutes(rg *gin.RouterGroup) {
	rg.GET("/semesters/:name/status", h.IsSemesterActive)
}

type createSemesterRequest struct {
	Name         string    `json:"name" binding:"required"`
	HardDeadline time.Time `json:"hard_deadline" binding:"required"`
}

type semesterResponse struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Status       string  `json:"status"`
	HardDeadline string  `json:"hard_deadline"`
	ActivatedAt  *string `json:"activated_at,omitempty"`
	CompletedAt  *string `json:"completed_at,omitempty"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// CreateSemester handles POST /admin/semesters
func (h *SemesterStatusHandler) CreateSemester(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "SemesterStatusHandler"),
		zap.String("method", "CreateSemester"),
	)

	var req createSemesterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handlerLogger.Warn("invalid request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "VALIDATION_ERROR"})
		return
	}

	if !semesterNameRegex.MatchString(req.Name) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "semester name must match format: YYYY-YYYY-Fall or YYYY-YYYY-Spring",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	if req.HardDeadline.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "hard_deadline must be in the future",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	semester, err := h.repo.CreateSemester(c.Request.Context(), req.Name, req.HardDeadline)
	if err != nil {
		handlerLogger.Error("failed to create semester", zap.Error(err))
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "semester already exists", "code": "CONFLICT"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create semester", "code": "INTERNAL_ERROR"})
		return
	}

	resp := toSemesterResponse(semester)

	// Audit log
	if h.auditLogger != nil {
		actorID, _ := c.Get("user_id")
		h.auditLogger.Log(c.Request.Context(), audit.AuditEvent{
			ActorID:      actorID.(string),
			ActorRole:    "admin",
			Action:       "semester.created",
			ResourceType: "semester",
			ResourceID:   resp.ID,
			Details: map[string]any{
				"semester_name": req.Name,
				"hard_deadline": req.HardDeadline.Format(time.RFC3339),
			},
		})
	}

	handlerLogger.Info("semester created", zap.String("name", req.Name))
	c.JSON(http.StatusCreated, resp)
}

// ListSemesters handles GET /admin/semesters
func (h *SemesterStatusHandler) ListSemesters(c *gin.Context) {
	semesters, err := h.repo.ListSemesters(c.Request.Context())
	if err != nil {
		logger.Error("failed to list semesters", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list semesters", "code": "INTERNAL_ERROR"})
		return
	}

	var result []semesterResponse
	for _, s := range semesters {
		result = append(result, toSemesterResponse(s))
	}
	if result == nil {
		result = []semesterResponse{}
	}

	c.JSON(http.StatusOK, result)
}

// GetActiveSemester handles GET /admin/semesters/active
func (h *SemesterStatusHandler) GetActiveSemester(c *gin.Context) {
	semester, err := h.repo.GetActiveSemester(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no active semester found", "code": "NOT_FOUND"})
		return
	}

	c.JSON(http.StatusOK, toSemesterResponse(semester))
}

// ActivateSemester handles PUT /admin/semesters/:id/activate
func (h *SemesterStatusHandler) ActivateSemester(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "SemesterStatusHandler"),
		zap.String("method", "ActivateSemester"),
	)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester ID", "code": "VALIDATION_ERROR"})
		return
	}

	semester, err := h.repo.ActivateSemester(c.Request.Context(), id)
	if err != nil {
		handlerLogger.Error("failed to activate semester", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "failed to activate semester — it may not be in 'planned' status",
			"code":  "INVALID_STATE_TRANSITION",
		})
		return
	}

	resp := toSemesterResponse(semester)

	if h.auditLogger != nil {
		actorID, _ := c.Get("user_id")
		h.auditLogger.Log(c.Request.Context(), audit.AuditEvent{
			ActorID:      actorID.(string),
			ActorRole:    "admin",
			Action:       "semester.activated",
			ResourceType: "semester",
			ResourceID:   resp.ID,
			Details: map[string]any{
				"semester_name": semester.Name,
				"hard_deadline": semester.HardDeadline.Time.Format(time.RFC3339),
			},
		})
	}

	handlerLogger.Info("semester activated", zap.String("name", semester.Name))
	c.JSON(http.StatusOK, resp)
}

// CompleteSemester handles PUT /admin/semesters/:id/complete
func (h *SemesterStatusHandler) CompleteSemester(c *gin.Context) {
	handlerLogger := logger.WithContextAndFields(c.Request.Context(),
		zap.String("handler", "SemesterStatusHandler"),
		zap.String("method", "CompleteSemester"),
	)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester ID", "code": "VALIDATION_ERROR"})
		return
	}

	semester, err := h.repo.CompleteSemester(c.Request.Context(), id)
	if err != nil {
		handlerLogger.Error("failed to complete semester", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "failed to complete semester — it may not be in 'active' status",
			"code":  "INVALID_STATE_TRANSITION",
		})
		return
	}

	resp := toSemesterResponse(semester)

	if h.auditLogger != nil {
		actorID, _ := c.Get("user_id")
		h.auditLogger.Log(c.Request.Context(), audit.AuditEvent{
			ActorID:      actorID.(string),
			ActorRole:    "admin",
			Action:       "semester.completed",
			ResourceType: "semester",
			ResourceID:   resp.ID,
			Details: map[string]any{
				"semester_name": semester.Name,
			},
		})
	}

	handlerLogger.Info("semester completed", zap.String("name", semester.Name))
	c.JSON(http.StatusOK, resp)
}

// IsSemesterActive handles GET /internal/semesters/:name/status
func (h *SemesterStatusHandler) IsSemesterActive(c *gin.Context) {
	name := c.Param("name")

	active, err := h.repo.IsSemesterActive(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"active": false, "error": "semester not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"active": active})
}

func toSemesterResponse(s db.Semester) semesterResponse {
	resp := semesterResponse{
		ID:           utils.PgtypeToUUIDString(s.ID),
		Name:         s.Name,
		Status:       string(s.Status),
		HardDeadline: utils.PgTimestamptzToTime(s.HardDeadline).Format(time.RFC3339),
		CreatedAt:    utils.PgTimestamptzToTime(s.CreatedAt).Format(time.RFC3339),
		UpdatedAt:    utils.PgTimestamptzToTime(s.UpdatedAt).Format(time.RFC3339),
	}

	if s.ActivatedAt.Valid {
		t := s.ActivatedAt.Time.Format(time.RFC3339)
		resp.ActivatedAt = &t
	}
	if s.CompletedAt.Valid {
		t := s.CompletedAt.Time.Format(time.RFC3339)
		resp.CompletedAt = &t
	}

	return resp
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return contains(s, "duplicate key") || contains(s, "unique constraint")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
