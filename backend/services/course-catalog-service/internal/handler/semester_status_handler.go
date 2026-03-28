package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/db"
	"github.com/baaaki/mydreamcampus/course-catalog-service/internal/repository"
	"github.com/baaaki/mydreamcampus/shared/audit"
	"github.com/baaaki/mydreamcampus/shared/logger"
	sharedRepo "github.com/baaaki/mydreamcampus/shared/repository"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var semesterNameRegex = regexp.MustCompile(`^\d{4}-\d{4}-(Fall|Spring)$`)

// ServiceURLs holds the base URLs of other services for period distribution.
type ServiceURLs struct {
	Enrollment string
	Grades     string
	Attendance string
}

type SemesterStatusHandler struct {
	repo        *repository.SemesterStatusRepository
	periodRepo  *sharedRepo.SimplePeriodRepository
	auditLogger audit.Logger
	serviceURLs ServiceURLs
}

func NewSemesterStatusHandler(repo *repository.SemesterStatusRepository, periodRepo *sharedRepo.SimplePeriodRepository, auditLogger audit.Logger, serviceURLs ServiceURLs) *SemesterStatusHandler {
	return &SemesterStatusHandler{repo: repo, periodRepo: periodRepo, auditLogger: auditLogger, serviceURLs: serviceURLs}
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
	rg.GET("/semesters/:name/info", h.GetSemesterInfo)
}

type periodTimeRange struct {
	Start time.Time `json:"start" binding:"required"`
	End   time.Time `json:"end" binding:"required"`
}

type semesterPeriods struct {
	Enrollment *periodTimeRange `json:"enrollment,omitempty"`
	Grading    *periodTimeRange `json:"grading,omitempty"`
	Attendance *periodTimeRange `json:"attendance,omitempty"`
	Catalog    *periodTimeRange `json:"catalog,omitempty"`
}

type createSemesterRequest struct {
	Name         string           `json:"name" binding:"required"`
	HardDeadline time.Time        `json:"hard_deadline" binding:"required"`
	Periods      *semesterPeriods `json:"periods,omitempty"`
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

	// Semester setup distributes periods to each service via internal HTTP calls.
	// This is intentionally NOT a single atomic endpoint — the steps are separated so that
	// in the future, a "department_head" role can handle course creation (step 2)
	// while admin handles semester creation (step 1) and activation (step 3).
	// See: docs/semester-wizard-plan.md "Gelecek Uyumluluk: Bolum Baskani Rolu"
	if req.Periods != nil {
		periodErrors := h.distributePeriods(c.Request.Context(), req.Name, req.HardDeadline, req.Periods)
		if len(periodErrors) > 0 {
			handlerLogger.Warn("some period distributions failed", zap.Any("errors", periodErrors))
			c.JSON(http.StatusCreated, gin.H{
				"semester":      resp,
				"period_errors": periodErrors,
			})
			return
		}
	}

	c.JSON(http.StatusCreated, resp)
}

// distributePeriods sends period creation requests to each service.
// Catalog period is created locally, others via internal HTTP.
func (h *SemesterStatusHandler) distributePeriods(ctx context.Context, semester string, hardDeadline time.Time, periods *semesterPeriods) []string {
	var errs []string

	type periodTarget struct {
		name    string
		pr      *periodTimeRange
		url     string
		isLocal bool
	}

	targets := []periodTarget{
		{"catalog", periods.Catalog, "", true},
		{"enrollment", periods.Enrollment, h.serviceURLs.Enrollment + "/api/enrollment", false},
		{"grading", periods.Grading, h.serviceURLs.Grades + "/api/grades", false},
		{"attendance", periods.Attendance, h.serviceURLs.Attendance + "/api/attendance", false},
	}

	for _, t := range targets {
		if t.pr == nil {
			continue
		}

		// Validation: period.end must not exceed hard_deadline
		if t.pr.End.After(hardDeadline) {
			errs = append(errs, fmt.Sprintf("%s: period end exceeds hard_deadline", t.name))
			continue
		}

		if t.isLocal {
			// Create locally in catalog DB
			_, err := h.periodRepo.CreatePeriod(ctx, sharedRepo.SimplePeriod{
				Semester:    semester,
				PeriodStart: t.pr.Start,
				PeriodEnd:   t.pr.End,
				IsActive:    true,
			})
			if err != nil {
				errs = append(errs, fmt.Sprintf("%s: %v", t.name, err))
			}
		} else {
			// Internal endpoint: called by catalog-service during semester setup to create
			// this service's period. Protected by X-Internal-Secret header.
			// Not exposed to external clients.
			if err := h.createRemotePeriod(ctx, t.url, semester, t.pr); err != nil {
				errs = append(errs, fmt.Sprintf("%s: %v", t.name, err))
			}
		}
	}

	return errs
}

func (h *SemesterStatusHandler) createRemotePeriod(ctx context.Context, baseURL, semester string, pr *periodTimeRange) error {
	if baseURL == "" {
		return fmt.Errorf("service URL not configured")
	}

	payload := map[string]any{
		"semester":     semester,
		"period_start": pr.Start.Format(time.RFC3339),
		"period_end":   pr.End.Format(time.RFC3339),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal period payload: %w", err)
	}

	url := baseURL + "/internal/periods"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	return nil
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
//
// INVARIANT: Only one semester can be active at any given time.
// Before activating, we check if another semester is already active.
// If yes, the request is rejected with a clear error message.
// This rule exists because the entire system (enrollment, grades, attendance)
// operates on a single active semester — having two active semesters would
// cause ambiguity in which semester students enroll in, teachers grade for, etc.
// The database also enforces this via idx_semesters_single_active partial unique index
// as a safety net against race conditions.
// See: docs/semester-wizard-plan.md "Tek Aktif Dönem Kuralı"
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

	// INVARIANT: Only one semester can be active at any given time.
	// Check before attempting activation to provide a clear, user-friendly error message.
	hasActive, err := h.repo.HasActiveSemester(c.Request.Context())
	if err != nil {
		handlerLogger.Error("failed to check active semester", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check active semester", "code": "INTERNAL_ERROR"})
		return
	}
	if hasActive {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Zaten aktif bir dönem bulunuyor. Yeni bir dönem aktifleştirmek için önce mevcut aktif dönemi tamamlayın.",
			"code":  "ACTIVE_SEMESTER_EXISTS",
		})
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

// GetSemesterInfo handles GET /internal/semesters/:name/info
// Returns semester info including hard_deadline for enforcement by other services.
func (h *SemesterStatusHandler) GetSemesterInfo(c *gin.Context) {
	name := c.Param("name")

	info, err := h.repo.GetSemesterInfo(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "semester not found", "code": "NOT_FOUND"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"name":             info.Name,
		"status":           info.Status,
		"hard_deadline":    info.HardDeadline.Format(time.RFC3339),
		"is_past_deadline": info.IsPastDeadline,
	})
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
