package config

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadBaseConfig_Defaults(t *testing.T) {
	resetViper()
	defer resetViper()

	cfg, err := LoadBaseConfig("auth-service", "8001", "mydreamcampus_auth")
	require.NoError(t, err)

	assert.Equal(t, "development", cfg.Server.Environment)
	assert.Equal(t, "8001", cfg.Server.Port)
	assert.Contains(t, cfg.Database.URL, "mydreamcampus_auth")
	assert.Equal(t, "amqp://rabbitmq:rabbitmq@localhost:5672/", cfg.RabbitMQ.URL)
	assert.Equal(t, "localhost:6379", cfg.Redis.Addr)
	assert.Equal(t, 0, cfg.Redis.DB)
	assert.Equal(t, "change-this-secret-in-production", cfg.JWT.Secret)
}

func TestLoadBaseConfig_ProductionRejectsDefaultJWT(t *testing.T) {
	resetViper()
	defer resetViper()

	t.Setenv("ENVIRONMENT", "production")

	_, err := LoadBaseConfig("auth-service", "8001", "mydreamcampus_auth")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")
}

func TestLoadBaseConfig_EnvOverrides(t *testing.T) {
	resetViper()
	defer resetViper()

	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("PORT", "9000")
	t.Setenv("DB_URL", "postgres://user:pass@db:5432/custom?sslmode=disable")
	t.Setenv("RABBITMQ_URL", "amqp://user:pass@rabbit:5672/")
	t.Setenv("REDIS_ADDR", "redis:6380")
	t.Setenv("REDIS_PASSWORD", "super-secret")
	t.Setenv("REDIS_DB", "2")
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))

	cfg, err := LoadBaseConfig("auth-service", "8001", "mydreamcampus_auth")
	require.NoError(t, err)

	assert.Equal(t, "production", cfg.Server.Environment)
	assert.Equal(t, "9000", cfg.Server.Port)
	assert.Equal(t, "postgres://user:pass@db:5432/custom?sslmode=disable", cfg.Database.URL)
	assert.Equal(t, "amqp://user:pass@rabbit:5672/", cfg.RabbitMQ.URL)
	assert.Equal(t, "redis:6380", cfg.Redis.Addr)
	assert.Equal(t, "super-secret", cfg.Redis.Password)
	assert.Equal(t, 2, cfg.Redis.DB)
	assert.Equal(t, strings.Repeat("a", 32), cfg.JWT.Secret)
}
