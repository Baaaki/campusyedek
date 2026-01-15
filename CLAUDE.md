# MyDreamCampus - Kod Yazım ve Geliştirme Rehberi

> **Not**: Detaylı konfigürasyon dosyaları için `docs/extraClaude.md` dosyasına bakın.

## ⚡ Claude İçin Önemli Notlar

### Docker Komutları İçin Sudo
**ÖNEMLİ**: Docker komutları çalıştırırken kullanıcının sisteminde Docker daemon'a erişim için `sudo` gerekebilir.

- ✅ **Direkt komut çalıştırma**: Eğer Docker komutunu doğrudan çalıştıracaksan, kullanıcıya komutu `sudo` ile çalıştırmasını söyle
- ✅ **Bash tool kullanımı**: `sudo` gerektiren komutlar için kullanıcıya komutu göster, onay aldıktan sonra kullanıcı kendisi çalıştırsın
- ❌ **Bash tool ile sudo**: Bash tool ile `sudo` komutları çalıştırma, kullanıcıya söyle kendisi çalıştırsın

**Örnek**:
```bash
# Kullanıcıya gösterilecek komut (sudo ile)
sudo docker compose up -d postgres-auth rabbitmq redis
```

---

## 📋 Proje Yapısı (Monorepo)

```
mydreamcampus/
├── services/          # Mikroservisler
├── shared/            # Ortak kod (database, logger, middleware, rabbitmq, redis, models, dto, errors, utils, config)
├── infrastructure/    # Docker Compose, Traefik, PostgreSQL, RabbitMQ, Redis, Loki, Promtail, Grafana
└── go.work           # Go workspace
```

---

## 🎯 Geliştirme Sırası

### Faz 0: Foundation
1. **Shared package setup**
2. **Infrastructure setup**

### Faz 1: Auth ve Kullanıcı Yönetimi
3. **Auth Service**
4. **Staff Service**
5. **Student Service**
6. **Loki Setup** (merkezi log toplama)

### Faz 2-4: Catalog → Enrollment → Attendance → Meal

---

## 🛠️ Teknoloji Stack (2025)

### Backend
- **Go** v1.23+, **Gin** v1.10+
- **pgx** v5+, **sqlc** v1.27+, **goose** v3.22+
- **PostgreSQL** v17+, **Air** v1.52+

### Mesajlaşma ve Cache
- **RabbitMQ** v4.0+, **Redis** v7.2+

### Security
- **JWT** (`github.com/golang-jwt/jwt/v5@latest`)
- **Argon2** (`golang.org/x/crypto/argon2`)

### Logging ve Validation
- **Zap** v1.27+ (structured logging)
- **Grafana Loki** v3.2+ + **Promtail** v3.2+ + **Grafana** v11.4+ (log aggregation)
- **Validator** v10

### Config & Infrastructure
- **Viper** v1.19+ (config management)
- **Docker** v27+, **Docker Compose** v2.30+, **Traefik** v3.2+

### Frontend
- **Next.js** v15+

---

## 📦 Her Servis Yapısı (Layered Architecture)

```
service-name/
├── cmd/main.go
├── internal/
│   ├── db/          # sqlc generated code
│   ├── repository/  # Data access (uses sqlc)
│   ├── service/     # Business logic
│   ├── handler/     # HTTP handlers
│   └── dto/         # Request/Response DTOs
├── sql/
│   ├── migrations/  # goose migrations
│   └── queries/     # SQL queries (sqlc input)
├── config/
├── sqlc.yaml
├── .air.toml
├── Makefile
├── Dockerfile
└── go.mod
```

---

## 🚀 9-Adımlı Geliştirme Workflow

**1. Planla** → Özelliği düşün (tablolar, endpoint'ler)

**2. Migration Oluştur**
```bash
make migrate-create name=create_users
```

**3. Migration Çalıştır**
```bash
make migrate-up
```

**4. Query Yaz** → `sql/queries/users.sql`

**5. Generate**
```bash
make sqlc  # Type-safe Go kodu üretilir
```

**6. Code** → Repository → Service → Handler → DTO

**7. Logging Ekle** → Zap structured logging

**8. Manual Test** → `air` + Postman/curl

**9. Commit**
```bash
git commit -m "feat(auth): add user registration"
```

**Makefile Komutları**:
```bash
make migrate-create/up/down/status
make sqlc
make build / docker-build
```

> **Not**: `air`, `go test`, `go mod tidy` direkt çalıştırılır, make'e gerek yok.

---

## ⚠️ KRITIK: pgtype Conversion Hatası (Her Serviste Yaşanıyor!)

### Problem
sqlc ile PostgreSQL kullanırken `pgtype.Text`, `pgtype.Bool`, `pgtype.Numeric` gibi tipler doğrudan Go primitive tipleri gibi kullanılamaz. Bu hatayı **her yeni serviste** tekrar yaşıyoruz.

### Neden Bu Hata Oluyor?
PostgreSQL NULL değerleri destekler, Go primitive tipleri desteklemez. pgx/v5 kütüphanesi bu yüzden wrapper struct'lar kullanır:
- `pgtype.Text` → `{String: "value", Valid: bool}`
- `pgtype.Bool` → `{Bool: true, Valid: bool}`
- `pgtype.Numeric` → `{Int: *big.Int, Exp: int32, NaN: bool, Valid: bool}`

**Eski pgx versiyonları** `AssignTo()` metodunu destekliyordu, **yeni versiyonlar desteklemiyor**!

### Çözüm: SADECE shared/utils Kullan

**ALTTIN KURAL**: Yeni bir servis oluştururken, kod yazmaya başlamadan **ÖNCE**:

```go
import (
    "github.com/baaaki/mydreamcampus/shared/utils"  // ✅ BUNU HER ZAMAN EKLE!
)
```

### Hızlı Referans Tablosu

| pgtype Type | Go'ya Çevirme | pgtype'a Çevirme | ⚠️ YANLIŞ Kullanım |
|-------------|---------------|------------------|-------------------|
| `pgtype.Text` | `utils.PgTextToString(val)` | `utils.StringToPgText("str")` | `pgtype.Text{String: "x", Valid: true}` |
| `pgtype.Bool` | `utils.PgBoolToBool(val)` | `utils.BoolToPgBool(true)` | `if record.IsActive {` ❌ |
| `pgtype.Numeric` | `f, err := utils.PgNumericToFloat64(val)` | `utils.Float64ToPgNumeric(42.5)` | `val.AssignTo(&f)` ❌ |
| `pgtype.Int2` | `int16(val.Int16)` | `utils.Int16ToPgInt2(val)` | `pgtype.Int2{Int16: x, Valid: true}` |
| `pgtype.Timestamp` | `utils.PgTimestampToTime(val)` | `utils.TimeToPgTimestamp(time.Now())` | `pgtype.Timestamp{Time: t, Valid: true}` |

### En Sık Yapılan Hatalar

#### ❌ HATA 1: Struct Literal Kullanımı
```go
// YANLIŞ!
params := db.CreateUserParams{
    Email: pgtype.Text{String: req.Email, Valid: true},
    IsActive: pgtype.Bool{Bool: true, Valid: true},
}

// DOĞRU!
params := db.CreateUserParams{
    Email: utils.StringToPgText(req.Email),
    IsActive: utils.BoolToPgBool(true),
}
```

#### ❌ HATA 2: Boolean Kontrolü
```go
// YANLIŞ! (pgtype.Bool bir struct, true/false değil!)
if student.IsActive {
    // ...
}

// DOĞRU!
if utils.PgBoolToBool(student.IsActive) {
    // ...
}
```

#### ❌ HATA 3: AssignTo() Kullanımı
```go
// YANLIŞ! (Artık desteklenmiyor!)
var score float64
result.Score.AssignTo(&score)

// DOĞRU!
score, err := utils.PgNumericToFloat64(result.Score)
if err != nil {
    // handle error
}
```

#### ❌ HATA 4: Aggregate Query Sonuçları (interface{})
```go
// sqlc bazı aggregate query'lerde interface{} döndürür (AVG, SUM, etc.)

// YANLIŞ!
var gpa float64
result.Gpa.AssignTo(&gpa)  // interface{} üzerinde metod yok!

// DOĞRU!
var gpa float64
if result.Gpa != nil {
    if gpaFloat, ok := result.Gpa.(float64); ok {
        gpa = gpaFloat
    }
}
```

### Yeni Servis Oluştururken Checklist

Kod yazmaya başlamadan ÖNCE:
1. ✅ `internal/service/*.go` dosyalarına `import "github.com/baaaki/mydreamcampus/shared/utils"` ekle
2. ✅ Repository'den gelen tüm pgtype değerleri utils ile çevir
3. ✅ Repository'ye gönderilen tüm değerleri utils ile pgtype'a çevir
4. ✅ Boolean check yaparken `utils.PgBoolToBool()` kullan
5. ✅ `AssignTo()` kelimesini hiçbir zaman kullanma
6. ✅ Aggregate query sonuçları için type assertion kullan

### Neden Bu Yaklaşım?
- **Consistency**: Tüm servisler aynı pattern'i kullanır
- **DRY Principle**: Conversion logic tek yerde (shared/utils)
- **Type Safety**: Compile-time'da hataları yakalar
- **Maintainability**: pgx versiyonu değişirse sadece utils güncellenir
- **Zaman Tasarrufu**: Her serviste aynı hatayı çözmeye gerek kalmaz

### Özet: Tek Kural
**ASLA** doğrudan `pgtype.*{...}` struct literal veya `AssignTo()` kullanma.
**HER ZAMAN** `shared/utils/pgtype_helpers.go` fonksiyonlarını kullan.

---

## ✅ Best Practices

### 1. Shared Package Kullan
Ortak kod tekrarı YAPMA. Database, logger, middleware shared'da olmalı.

### 2. Database per Service
Her servis kendi PostgreSQL DB'sine sahip (`mydreamcampus_auth`, `mydreamcampus_staff`, etc.)

### 3. Event-Driven Communication
Servisler arası HTTP call YAPMA. RabbitMQ ile asenkron event'ler gönder.

### 4. API Gateway Pattern
Frontend direkt servise ULAŞMAZ. Traefik üzerinden (`http://localhost/api/auth`)

---

## 🔐 Code Style

### goose Migration Örneği
```sql
-- sql/migrations/00001_create_users_table.sql
-- +goose Up
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- +goose Down
DROP TABLE IF EXISTS users;
```

### sqlc Query Örneği
```sql
-- sql/queries/users.sql

-- name: GetUserByEmail :one
SELECT id, email, password_hash, role, created_at, updated_at
FROM users
WHERE email = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (email, password_hash, role)
VALUES ($1, $2, $3)
RETURNING id, email, role, created_at, updated_at;
```

### Repository Katmanı (sqlc + pgx)
```go
package repository

import (
    "context"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/yourusername/mydreamcampus/auth-service/internal/db"
)

type AuthRepository struct {
    queries *db.Queries
    pool    *pgxpool.Pool
}

func NewAuthRepository(pool *pgxpool.Pool) *AuthRepository {
    return &AuthRepository{
        queries: db.New(pool),
        pool:    pool,
    }
}

func (r *AuthRepository) GetUserByEmail(ctx context.Context, email string) (db.User, error) {
    return r.queries.GetUserByEmail(ctx, email)
}

func (r *AuthRepository) CreateUser(ctx context.Context, arg db.CreateUserParams) (db.User, error) {
    return r.queries.CreateUser(ctx, arg)
}
```

### Service Katmanı (Business Logic + Shared Utils)
```go
package service

import (
    "context"
    "github.com/yourusername/mydreamcampus/auth-service/internal/db"
    "github.com/yourusername/mydreamcampus/auth-service/internal/dto"
    "github.com/yourusername/mydreamcampus/auth-service/internal/repository"
    sharedErrors "github.com/yourusername/mydreamcampus/shared/errors"
    "github.com/yourusername/mydreamcampus/shared/utils"
)

type AuthService struct {
    repo *repository.AuthRepository
}

func NewAuthService(repo *repository.AuthRepository) *AuthService {
    return &AuthService{repo: repo}
}

func (s *AuthService) Register(ctx context.Context, req dto.RegisterRequest) (dto.AuthResponse, error) {
    // Hash password using shared utils
    hashedPassword, err := utils.HashPassword(req.Password)
    if err != nil {
        return dto.AuthResponse{}, err
    }

    // Create user
    user, err := s.repo.CreateUser(ctx, db.CreateUserParams{
        Email:        req.Email,
        PasswordHash: hashedPassword,
        Role:         "student",
    })
    if err != nil {
        return dto.AuthResponse{}, err
    }

    // Generate JWT using shared utils
    token, err := utils.GenerateJWT(user.ID, user.Role)
    if err != nil {
        return dto.AuthResponse{}, err
    }

    return dto.AuthResponse{
        Token: token,
        User:  dto.UserResponse{ID: user.ID, Email: user.Email, Role: user.Role},
    }, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (dto.AuthResponse, error) {
    user, err := s.repo.GetUserByEmail(ctx, email)
    if err != nil {
        return dto.AuthResponse{}, sharedErrors.ErrNotFound
    }

    if !utils.VerifyPassword(user.PasswordHash, password) {
        return dto.AuthResponse{}, sharedErrors.ErrUnauthorized
    }

    token, err := utils.GenerateJWT(user.ID, user.Role)
    if err != nil {
        return dto.AuthResponse{}, err
    }

    return dto.AuthResponse{
        Token: token,
        User:  dto.UserResponse{ID: user.ID, Email: user.Email, Role: user.Role},
    }, nil
}
```

### Handler Katmanı (Logging ile)
```go
package handler

import (
    "github.com/gin-gonic/gin"
    "github.com/yourusername/mydreamcampus/shared/logger"
    "github.com/yourusername/mydreamcampus/shared/errors"
    "go.uber.org/zap"
)

type AuthHandler struct {
    service AuthService
}

func (h *AuthHandler) Login(c *gin.Context) {
    var req dto.LoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        logger.Error("invalid request body",
            zap.Error(err),
            zap.String("endpoint", "/login"),
        )
        c.JSON(400, gin.H{"error": errors.ErrValidation.Error()})
        return
    }

    logger.Info("login attempt",
        zap.String("email", req.Email),
        zap.String("ip", c.ClientIP()),
    )

    response, err := h.service.Login(c.Request.Context(), req.Email, req.Password)
    if err != nil {
        logger.Error("login failed",
            zap.Error(err),
            zap.String("email", req.Email),
        )
        c.JSON(401, gin.H{"error": errors.ErrUnauthorized.Error()})
        return
    }

    logger.Info("login successful", zap.String("email", req.Email))
    c.JSON(200, response)
}
```

### Viper Config Örneği
```go
package config

import "github.com/spf13/viper"

type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Redis    RedisConfig
    RabbitMQ RabbitMQConfig
    JWT      JWTConfig
}

type ServerConfig struct {
    Port string `mapstructure:"PORT"`
    Env  string `mapstructure:"ENV"`
}

type DatabaseConfig struct {
    Host     string `mapstructure:"DB_HOST"`
    Port     string `mapstructure:"DB_PORT"`
    User     string `mapstructure:"DB_USER"`
    Password string `mapstructure:"DB_PASSWORD"`
    DBName   string `mapstructure:"DB_NAME"`
    SSLMode  string `mapstructure:"DB_SSLMODE"`
}

func LoadConfig(path string) (*Config, error) {
    viper.SetConfigFile(path)
    viper.AutomaticEnv()

    if err := viper.ReadInConfig(); err != nil {
        return nil, err
    }

    var config Config
    if err := viper.Unmarshal(&config); err != nil {
        return nil, err
    }

    return &config, nil
}
```

### DLQ (Dead Letter Queue) Pattern
```go
// shared/rabbitmq/dlq.go
package rabbitmq

import amqp "github.com/rabbitmq/amqp091-go"

func SetupDLQ(channel *amqp.Channel, queueName string) error {
    dlqName := queueName + ".dlq"

    // Declare DLQ
    _, err := channel.QueueDeclare(dlqName, true, false, false, false, nil)
    if err != nil {
        return err
    }

    // Declare main queue with DLQ configuration
    args := amqp.Table{
        "x-dead-letter-exchange":    "",
        "x-dead-letter-routing-key": dlqName,
        "x-message-ttl":             86400000, // 24 hours
    }

    _, err = channel.QueueDeclare(queueName, true, false, false, false, args)
    return err
}

func (c *Consumer) ConsumeWithDLQ(queueName string, handler MessageHandler, maxRetries int) error {
    msgs, err := c.channel.Consume(queueName, "", false, false, false, false, nil)
    if err != nil {
        return err
    }

    go func() {
        for msg := range msgs {
            retryCount := getRetryCount(msg.Headers)

            if err := handler(msg.Body); err != nil {
                if retryCount < maxRetries {
                    c.republishWithRetry(msg, retryCount+1)
                } else {
                    c.publishToDLQ(msg, "max retries exceeded")
                }
                msg.Nack(false, false)
            } else {
                msg.Ack(false)
            }
        }
    }()

    return nil
}
```

---

## 📦 Git Commit Stratejisi

### Monorepo Format
```
<type>(<scope>): <description>

feat(auth): add login and register endpoints
fix(shared): resolve logger initialization bug
chore(infra): update traefik configuration
```

### Atomic Commits
```bash
# ✅ İYİ - Her feature ayrı commit
git commit -m "feat(shared): add database connection pool"
git commit -m "feat(auth): add User model"
git commit -m "feat(auth): implement authentication logic"

# ❌ KÖTÜ - Monolithic commit
git commit -m "feat: add everything"
```

**ÖNEMLİ**: Her özellik tamamlandığında HEMEN commit at!

---

## 🎓 Mentoring İlkeleri

### Rol: Senior Developer Coach
- **Dil**: Türkçe konuşma, English kod
- **İlke**: COACH, DON'T CODE (açıkça istenmedikçe)

### Best Practice Doğrudan Göster

**✅ İYİ**:
```
"UUID generation'ı PostgreSQL'de yapmalıyız (gen_random_uuid()), Go'da değil.
Neden?
- Database-level uniqueness guarantee
- Daha hızlı (DB'de generate edilir)
- Race condition riski yok"
```

**❌ KÖTÜ**:
```
"UUID generation'ı nerede yapalım?"
```

### Ne Zaman Soru Sor?
- ✅ Gerçek mimari seçimler (monolith vs microservice)
- ✅ Trade-off'lar (REST vs GraphQL bu özel durum için)
- ✅ Kullanıcı tercihi önemli (kütüphane X vs Y)

### Ne Zaman Sorma?
- ❌ Açık best practice var (Argon2 kullan, MD5 değil)
- ❌ Industry standard açık (HTTP status code'lar)
- ❌ Performance/security'de açık kazanan var

---

## 🚀 İleri Seviye Pattern'ler (Sonraki Fazlarda)

### Circuit Breaker
**Ne Zaman**: Servis arası HTTP call varsa
**Kütüphane**: `github.com/sony/gobreaker@latest`
**Amaç**: Cascade failure önleme

### Distributed Locking
**Ne Zaman**: Kontenjan kontrolü, critical section
**Kütüphane**: `github.com/bsm/redislock@latest`
**Amaç**: Race condition önleme

### Idempotency
**Ne Zaman**: Enrollment, Payment servisleri
**Yöntem**: Database unique constraint + Redis cache
**Amaç**: Duplicate request önleme

### Graceful Shutdown
**Shared package'a ekle**: `shared/server/graceful.go`
```go
func GracefulShutdown(srv *http.Server, timeout time.Duration)
```

---

## 📊 Loki Setup (Faz 1 Sonrası)

**Ne Zaman**: Auth, Staff, Student servisleri bittikten sonra

**Mimari**:
```
Go Servisler (Zap JSON logs)
    ↓ stdout/stderr
Docker Container Logs
    ↓ (Promtail scraper)
Grafana Loki (storage)
    ↓ (query)
Grafana Dashboard (visualization)
```

**Avantajları**:
- ✅ Merkezi log yönetimi
- ✅ Servisler arası log korelasyonu
- ✅ Powerful log search (LogQL)
- ✅ 7 gün log retention

> **Detaylı konfigürasyon**: `docs/extraClaude.md`

---

## 🔍 Observability & Testing

### Observability
- **Faz 1 sırasında**: Zap structured logging (kod yazarken ekle)
- **Faz 1 bitiminde**: Grafana Loki + Promtail (merkezi log toplama)
- **Tüm servisler bittikten sonra**: Prometheus metrics

### Testing
- **Şimdi**: Manuel test (Postman/curl)
- **Sonra**: Unit + Integration + E2E tests (tüm servisler bittikten sonra)

**ÖNEMLİ**: Geliştirme sırasında sadece manuel test yap.

---

## 📚 Referanslar

- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
- [Go Workspace Tutorial](https://go.dev/doc/tutorial/workspaces)
- [Microservices Patterns](https://microservices.io/patterns/)
- [Traefik v3 Docs](https://doc.traefik.io/traefik/)
- [sqlc Documentation](https://docs.sqlc.dev/en/latest/)
- [pgx Documentation](https://pkg.go.dev/github.com/jackc/pgx/v5)
- [goose Documentation](https://pressly.github.io/goose/)
- [Air Documentation](https://github.com/cosmtrek/air)
- [Viper Documentation](https://github.com/spf13/viper)
- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Prometheus Go Client](https://github.com/prometheus/client_golang)

---

**Not**: Her aşama sonunda commit at! Sorular için çekinme.

> **Detaylı setup komutları ve config dosyaları**: `docs/extraClaude.md`
