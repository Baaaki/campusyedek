package audit

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var httpLoggerOnce sync.Once

func initHTTPLogger(t *testing.T) {
	t.Helper()
	httpLoggerOnce.Do(func() {
		require.NoError(t, logger.Init("test"))
	})
}

func TestHTTPLogger_Log_SendsAuditEvent(t *testing.T) {
	t.Parallel()
	initHTTPLogger(t)

	var gotEvent AuditEvent
	var gotMethod string
	var gotPath string
	var gotContentType string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotContentType = r.Header.Get("Content-Type")

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(body, &gotEvent))

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	logger := NewHTTPLogger(server.URL, "grades-service")

	err := logger.Log(context.Background(), AuditEvent{
		Service:      "override",
		ActorID:      "u-1",
		ActorRole:    "admin",
		Action:       "period.created",
		ResourceType: "academic_period",
		ResourceID:   "p-1",
		Details:      map[string]any{"semester": "2025-Fall"},
	})
	require.NoError(t, err)

	assert.Equal(t, http.MethodPost, gotMethod)
	assert.Equal(t, "/api/catalog/internal/audit-log", gotPath)
	assert.Equal(t, "application/json", gotContentType)
	assert.Equal(t, "grades-service", gotEvent.Service)
	assert.Equal(t, "u-1", gotEvent.ActorID)
	assert.Equal(t, "admin", gotEvent.ActorRole)
	assert.Equal(t, "period.created", gotEvent.Action)
	assert.Equal(t, "academic_period", gotEvent.ResourceType)
	assert.Equal(t, "p-1", gotEvent.ResourceID)
	assert.Equal(t, "2025-Fall", gotEvent.Details["semester"])
}

func TestHTTPLogger_Log_ReturnsErrorWhenPayloadInvalid(t *testing.T) {
	t.Parallel()
	initHTTPLogger(t)

	logger := NewHTTPLogger("http://example.com", "enrollment-service")

	err := logger.Log(context.Background(), AuditEvent{
		ActorID:   "u-1",
		ActorRole: "admin",
		Action:    "period.updated",
		Details:   map[string]any{"bad": make(chan int)},
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to marshal audit event")
}

func TestHTTPLogger_Log_IgnoresRequestFailure(t *testing.T) {
	t.Parallel()
	initHTTPLogger(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	server.Close()

	logger := NewHTTPLogger(server.URL, "meal-service")

	err := logger.Log(context.Background(), AuditEvent{
		ActorID:      "u-9",
		ActorRole:    "admin",
		Action:       "meal.reserved",
		ResourceType: "meal",
	})

	assert.NoError(t, err)
}

func TestHTTPLogger_Log_AllowsNon201Response(t *testing.T) {
	t.Parallel()
	initHTTPLogger(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	logger := NewHTTPLogger(server.URL, "enrollment-service")

	err := logger.Log(context.Background(), AuditEvent{
		ActorID:      "u-2",
		ActorRole:    "admin",
		Action:       "period.deleted",
		ResourceType: "academic_period",
	})

	assert.NoError(t, err)
}
