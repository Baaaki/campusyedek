package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/baaaki/mydreamcampus/shared/clock"
	"github.com/baaaki/mydreamcampus/shared/dto"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func initTimeLogger(t *testing.T) {
	t.Helper()
	if logger.Log == nil {
		require.NoError(t, logger.Init("test"))
	}
}

func setupTimeRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewTimeHandler()
	admin := router.Group("/admin")
	handler.RegisterRoutes(admin)
	return router
}

func TestTimeHandler_Simulate_ValidRequest(t *testing.T) {
	initTimeLogger(t)
	clock.Reset()
	defer clock.Reset()

	router := setupTimeRouter()
	simulateAt := time.Date(2025, 11, 5, 9, 30, 0, 0, time.UTC)
	payload, err := json.Marshal(dto.SimulateTimeRequest{Time: simulateAt})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/admin/time/simulate", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, clock.ModeSimulated, clock.GetMode())
	require.NotNil(t, clock.SimulatedTime())
	assert.True(t, clock.SimulatedTime().Equal(simulateAt))
}

func TestTimeHandler_Simulate_InvalidRequest(t *testing.T) {
	initTimeLogger(t)
	clock.Reset()
	defer clock.Reset()

	router := setupTimeRouter()

	req := httptest.NewRequest(http.MethodPost, "/admin/time/simulate", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, clock.ModeReal, clock.GetMode())
}

func TestTimeHandler_Reset(t *testing.T) {
	initTimeLogger(t)
	simulateAt := time.Date(2025, 11, 5, 9, 30, 0, 0, time.UTC)
	clock.Set(simulateAt)
	defer clock.Reset()

	router := setupTimeRouter()

	req := httptest.NewRequest(http.MethodPost, "/admin/time/reset", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, clock.ModeReal, clock.GetMode())
	assert.Nil(t, clock.SimulatedTime())
}

func TestTimeHandler_Status(t *testing.T) {
	initTimeLogger(t)
	simulateAt := time.Date(2025, 11, 5, 9, 30, 0, 0, time.UTC)
	clock.Set(simulateAt)
	defer clock.Reset()

	router := setupTimeRouter()

	req := httptest.NewRequest(http.MethodGet, "/admin/time/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body dto.TimeStatusResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, string(clock.ModeSimulated), body.Mode)
	require.NotNil(t, body.SimulatedTime)
	assert.True(t, body.SimulatedTime.Equal(simulateAt))
}
