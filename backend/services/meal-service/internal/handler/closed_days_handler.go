package handler

import (
	"net/http"
	"time"

	"github.com/baaaki/mydreamcampus/meal-service/internal/db"
	"github.com/baaaki/mydreamcampus/meal-service/internal/repository"
	"github.com/baaaki/mydreamcampus/shared/audit"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"go.uber.org/zap"
)

type ClosedDaysHandler struct {
	repo        *repository.ClosedDaysRepository
	logger      *zap.Logger
	auditLogger audit.Logger
}

func NewClosedDaysHandler(repo *repository.ClosedDaysRepository, logger *zap.Logger, auditLogger audit.Logger) *ClosedDaysHandler {
	return &ClosedDaysHandler{repo: repo, logger: logger, auditLogger: auditLogger}
}

// RegisterRoutes mounts closed days endpoints under the given router group.
func (h *ClosedDaysHandler) RegisterRoutes(rg *gin.RouterGroup) {
	closedDays := rg.Group("/closed-days")
	{
		closedDays.POST("", h.CreateClosedDay)
		closedDays.GET("", h.ListClosedDays)
		closedDays.DELETE("/:id", h.DeleteClosedDay)
	}
}

type createClosedDayRequest struct {
	Date   string `json:"date" binding:"required"`   // YYYY-MM-DD
	Reason string `json:"reason" binding:"required"` // e.g. "Republic Day", "Eid al-Fitr"
}

type closedDayResponse struct {
	ID        string `json:"id"`
	Date      string `json:"date"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"created_at"`
}

// CreateClosedDay adds a closed day.
// POST /admin/closed-days
func (h *ClosedDaysHandler) CreateClosedDay(c *gin.Context) {
	var req createClosedDayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid date format (expected YYYY-MM-DD)",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	closedDay, err := h.repo.CreateClosedDay(c.Request.Context(), db.CreateClosedDayParams{
		Date:   pgtype.Date{Time: date, Valid: true},
		Reason: req.Reason,
	})
	if err != nil {
		h.logger.Error("failed to create closed day", zap.Error(err))
		c.JSON(http.StatusConflict, gin.H{
			"error": "a closed day already exists for this date",
			"code":  "CONFLICT",
		})
		return
	}

	// Audit log
	if h.auditLogger != nil {
		actorID, _ := c.Get("user_id")
		h.auditLogger.Log(c.Request.Context(), audit.AuditEvent{
			ActorID:      actorID.(string),
			ActorRole:    "admin",
			Action:       "closed_day.created",
			ResourceType: "closed_day",
			ResourceID:   closedDay.ID.String(),
			Details: map[string]any{
				"date":   req.Date,
				"reason": req.Reason,
			},
		})
	}

	h.logger.Info("closed day created",
		zap.String("date", req.Date),
		zap.String("reason", req.Reason),
	)

	c.JSON(http.StatusCreated, toClosedDayResponse(closedDay))
}

// ListClosedDays lists closed days with optional date range filter.
// GET /admin/closed-days?from=2025-01-01&to=2025-12-31
func (h *ClosedDaysHandler) ListClosedDays(c *gin.Context) {
	var fromDate, toDate pgtype.Date

	if from := c.Query("from"); from != "" {
		t, err := time.Parse("2006-01-02", from)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid 'from' date format (expected YYYY-MM-DD)",
				"code":  "VALIDATION_ERROR",
			})
			return
		}
		fromDate = pgtype.Date{Time: t, Valid: true}
	}

	if to := c.Query("to"); to != "" {
		t, err := time.Parse("2006-01-02", to)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid 'to' date format (expected YYYY-MM-DD)",
				"code":  "VALIDATION_ERROR",
			})
			return
		}
		toDate = pgtype.Date{Time: t, Valid: true}
	}

	days, err := h.repo.ListClosedDays(c.Request.Context(), db.ListClosedDaysParams{
		Column1: fromDate,
		Column2: toDate,
	})
	if err != nil {
		h.logger.Error("failed to list closed days", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list closed days",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	response := make([]closedDayResponse, 0, len(days))
	for _, d := range days {
		response = append(response, toClosedDayResponse(d))
	}

	c.JSON(http.StatusOK, response)
}

// DeleteClosedDay removes a closed day.
// DELETE /admin/closed-days/:id
func (h *ClosedDaysHandler) DeleteClosedDay(c *gin.Context) {
	idStr := c.Param("id")

	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid closed day ID",
			"code":  "INVALID_ID",
		})
		return
	}

	if err := h.repo.DeleteClosedDay(c.Request.Context(), id); err != nil {
		h.logger.Error("failed to delete closed day", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete closed day",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	// Audit log
	if h.auditLogger != nil {
		actorID, _ := c.Get("user_id")
		h.auditLogger.Log(c.Request.Context(), audit.AuditEvent{
			ActorID:      actorID.(string),
			ActorRole:    "admin",
			Action:       "closed_day.deleted",
			ResourceType: "closed_day",
			ResourceID:   idStr,
		})
	}

	h.logger.Info("closed day deleted", zap.String("id", idStr))

	c.JSON(http.StatusOK, gin.H{
		"message": "closed day deleted successfully",
	})
}

func toClosedDayResponse(d db.ClosedDay) closedDayResponse {
	return closedDayResponse{
		ID:        d.ID.String(),
		Date:      d.Date.Time.Format("2006-01-02"),
		Reason:    d.Reason,
		CreatedAt: d.CreatedAt.Time.Format(time.RFC3339),
	}
}
