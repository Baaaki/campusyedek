# Zero Trust Dönem Güvenliği & Audit Log Sistemi — Uygulama Planı

> **Tarih**: 20 Şubat 2026
> **Durum**: Onaylandı — uygulamaya hazır
> **Tahmini etkilenen servisler**: catalog, enrollment, grades, meal + shared + frontend

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Özellik 1: Semester State Machine](#2-özellik-1-semester-state-machine)
3. [Özellik 2: Period CRUD Kilidi](#3-özellik-2-period-crud-kilidi)
4. [Özellik 3: Hard Deadline ile Otomatik Kilit](#4-özellik-3-hard-deadline-ile-otomatik-kilit)
5. [Özellik 4: Audit Log (RabbitMQ Streams)](#5-özellik-4-audit-log-rabbitmq-streams)
6. [Özellik 5: Appeal (İtiraz) İyileştirmesi](#6-özellik-5-appeal-i̇tiraz-i̇yileştirmesi)
7. [Frontend Güncellemeleri](#7-frontend-güncellemeleri)
8. [Uygulama Sırası](#8-uygulama-sırası)
9. [Dosya Değişiklik Özeti](#9-dosya-değişiklik-özeti)
10. [Doğrulama Adımları](#10-doğrulama-adımları)

---

## 1. Genel Bakış

### Problem
Mevcut sistemde:
- Admin hesabı ele geçirilirse geçmiş dönemlerin deadline'ları değiştirilebilir
- Gelecek dönemlere sahte deadline eklenebilir
- Hiçbir kritik işlemin değiştirilemez kaydı tutulmuyor

### Güvenlik Modeli

| Dönem Durumu | Deadline CRUD | Not Girişi | Not İtirazı |
|---|---|---|---|
| `planned` (açılmamış) | ❌ Yasak | ❌ Yasak | ❌ Yasak |
| `active` (açık) | ✅ Serbest | ✅ Deadline'a bağlı | ✅ Serbest |
| `completed` (bitmiş) | ❌ Yasak | ❌ Yasak | ✅ Serbest (audit ile) |

### Prensipler
- **Geri dönüşsüz geçişler**: `completed` → `active` asla mümkün değil (DB seviyesinde)
- **Otomatik kilit**: `hard_deadline` tarihi geçince admin unutsa bile dönem kapanır
- **Merkezi audit log**: RabbitMQ Streams ile tüm kritik işlemler append-only loglanır
- **Deadline'dan bağımsız itiraz**: Geçmiş dönemlere not düzeltme ayrı mekanizma ile yapılır

---

## 2. Özellik 1: Semester State Machine

Şu an catalog servisinde ayrı bir `semesters` tablosu yok. Semester bilgisi sadece
`semester_courses.semester` kolonunda VARCHAR olarak tutuluyor (`2025-2026-Fall` formatında).

### 2.1 Migration Dosyası

**Dosya**: `backend/services/course-catalog-service/sql/migrations/00010_create_semesters_table.sql`

```sql
-- +goose Up

-- Dönem durumu enum'ı
CREATE TYPE semester_status AS ENUM ('planned', 'active', 'completed');

-- Dönem tablosu
CREATE TABLE semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,               -- "2025-2026-Fall"
    status semester_status NOT NULL DEFAULT 'planned',
    hard_deadline TIMESTAMPTZ NOT NULL,              -- Bu tarihten sonra otomatik completed
    activated_at TIMESTAMPTZ,                        -- planned → active geçiş zamanı
    completed_at TIMESTAMPTZ,                        -- active → completed geçiş zamanı
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_semesters_status ON semesters(status);
CREATE INDEX idx_semesters_name ON semesters(name);

-- GERİ DÖNÜŞÜ ENGELLEME: completed → active veya planned geçişini DB seviyesinde engelle
-- Bu trigger, uygulama katmanı bypass edilse bile (SQL injection vb.) güvenlik sağlar
CREATE OR REPLACE FUNCTION prevent_semester_reactivation()
RETURNS TRIGGER AS $$
BEGIN
    -- completed olan dönem başka bir duruma geçemez
    IF OLD.status = 'completed' THEN
        RAISE EXCEPTION 'Cannot change status of a completed semester (id: %)', OLD.id;
    END IF;

    -- planned sadece active'e geçebilir
    IF OLD.status = 'planned' AND NEW.status != 'active' THEN
        RAISE EXCEPTION 'Planned semester can only transition to active (id: %)', OLD.id;
    END IF;

    -- active sadece completed'e geçebilir
    IF OLD.status = 'active' AND NEW.status != 'completed' THEN
        RAISE EXCEPTION 'Active semester can only transition to completed (id: %)', OLD.id;
    END IF;

    -- Otomatik timestamp
    IF OLD.status = 'planned' AND NEW.status = 'active' THEN
        NEW.activated_at = NOW();
    END IF;

    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
        NEW.completed_at = NOW();
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_semester_status_change
    BEFORE UPDATE OF status ON semesters
    FOR EACH ROW
    EXECUTE FUNCTION prevent_semester_reactivation();

-- +goose Down
DROP TRIGGER IF EXISTS trg_semester_status_change ON semesters;
DROP FUNCTION IF EXISTS prevent_semester_reactivation();
DROP TABLE IF EXISTS semesters;
DROP TYPE IF EXISTS semester_status;
```

### 2.2 SQL Queries

**Dosya**: `backend/services/course-catalog-service/sql/queries/semesters.sql`

```sql
-- name: CreateSemester :one
INSERT INTO semesters (name, hard_deadline)
VALUES ($1, $2)
RETURNING *;

-- name: GetSemesterByName :one
SELECT * FROM semesters WHERE name = $1;

-- name: GetActiveSemester :one
SELECT * FROM semesters WHERE status = 'active' LIMIT 1;

-- name: ListSemesters :many
SELECT * FROM semesters ORDER BY created_at DESC;

-- name: ActivateSemester :one
UPDATE semesters SET status = 'active' WHERE id = $1 AND status = 'planned'
RETURNING *;

-- name: CompleteSemester :one
UPDATE semesters SET status = 'completed' WHERE id = $1 AND status = 'active'
RETURNING *;

-- name: AutoCompleteSemester :exec
UPDATE semesters SET status = 'completed'
WHERE name = $1 AND status = 'active' AND hard_deadline < NOW();
```

### 2.3 Repository

**Dosya**: `backend/services/course-catalog-service/internal/repository/semester_status_repository.go`

```go
package repository

// SemesterStatusRepository — semesters tablosu CRUD işlemleri
// sqlc tarafından generate edilen db.Queries'i wrap eder

type SemesterStatusRepository struct {
    queries *db.Queries
}

func NewSemesterStatusRepository(queries *db.Queries) *SemesterStatusRepository { ... }

// Temel metodlar:
// - CreateSemester(ctx, name, hardDeadline) → Semester
// - GetSemesterByName(ctx, name) → Semester
// - GetActiveSemester(ctx) → Semester
// - ListSemesters(ctx) → []Semester
// - ActivateSemester(ctx, id) → Semester  (planned → active)
// - CompleteSemester(ctx, id) → Semester  (active → completed)
// - IsSemesterActive(ctx, name) → bool    (status + hard_deadline kontrolü)
```

**`IsSemesterActive` metodunun detayı** (hard deadline kontrolü ile birlikte):
```go
func (r *SemesterStatusRepository) IsSemesterActive(ctx context.Context, name string) (bool, error) {
    semester, err := r.queries.GetSemesterByName(ctx, name)
    if err != nil {
        return false, err // semester bulunamadı → aktif değil
    }

    if semester.Status == "completed" {
        return false, nil
    }
    if semester.Status == "planned" {
        return false, nil
    }

    // status == "active" — ama hard_deadline geçmiş mi?
    if time.Now().After(semester.HardDeadline) {
        // Otomatik complete et
        r.queries.AutoCompleteSemester(ctx, name)
        return false, nil
    }

    return true, nil
}
```

### 2.4 Handler

**Dosya**: `backend/services/course-catalog-service/internal/handler/semester_status_handler.go`

```go
package handler

// SemesterStatusHandler — Admin semester yönetim endpoint'leri

// Endpoint'ler:
// POST   /api/catalog/admin/semesters           → CreateSemester
// GET    /api/catalog/admin/semesters           → ListSemesters
// GET    /api/catalog/admin/semesters/active    → GetActiveSemester
// PUT    /api/catalog/admin/semesters/:id/activate  → ActivateSemester (planned → active)
// PUT    /api/catalog/admin/semesters/:id/complete   → CompleteSemester (active → completed)
// GET    /api/catalog/admin/semesters/:name/status   → IsSemesterActive (diğer servisler bunu çağırır)
```

**CreateSemester request body:**
```json
{
    "name": "2025-2026-Fall",
    "hard_deadline": "2026-02-15T23:59:59Z"
}
```

Validasyon:
- `name` formatı regex ile kontrol: `^\d{4}-\d{4}-(Fall|Spring)$`
- `hard_deadline` gelecekte olmalı
- Aynı isimde semester zaten varsa → 409 Conflict

### 2.5 Mevcut Dosyalardaki Değişiklikler

**`backend/services/course-catalog-service/internal/service/semester_service.go`**:
- `CreateSemesterCourse` fonksiyonunda mevcut period kontrolünden ÖNCE semester status kontrolü eklenir:
```go
// Yeni eklenen kontrol (mevcut period kontrolünden önce)
isActive, err := s.semesterStatusRepo.IsSemesterActive(ctx, semester)
if err != nil || !isActive {
    return dto.SemesterCourseResponse{}, catalogErrors.ErrSemesterNotActive
}
// ... mevcut period kontrolü devam eder
```

**`backend/services/course-catalog-service/internal/errors/errors.go`**:
- Yeni hata eklenir:
```go
var ErrSemesterNotActive = sharedErrors.New("SEMESTER_NOT_ACTIVE",
    "This semester is not active — courses cannot be created", http.StatusForbidden)
```

**`backend/services/course-catalog-service/cmd/main.go`**:
- `SemesterStatusRepository` oluştur
- `SemesterStatusHandler` oluştur
- Route'ları kaydet: `admin.Group("/semesters")` altına
- `SemesterService`'e `semesterStatusRepo` inject et

### 2.6 Diğer Servislerin Semester Durumunu Öğrenmesi

Enrollment ve grades servisleri, catalog servisine HTTP çağrısı yaparak semester durumunu kontrol eder.

**Shared interface** — `backend/shared/semester/checker.go` (yeni dosya):
```go
package semester

import "context"

// Checker verifies if a semester is currently active.
// Catalog service implements this via direct DB access.
// Other services implement this via HTTP call to catalog service.
type Checker interface {
    IsSemesterActive(ctx context.Context, semester string) (bool, error)
}
```

**HTTP implementasyonu** — `backend/shared/semester/http_checker.go` (yeni dosya):
```go
package semester

// HTTPChecker calls catalog service to verify semester status.
// Used by enrollment, grades, and meal services.
//
// Endpoint: GET /api/catalog/admin/semesters/{name}/status
//
// Kullanım:
//   checker := semester.NewHTTPChecker("http://localhost:8004")
//   active, err := checker.IsSemesterActive(ctx, "2025-2026-Fall")

type HTTPChecker struct {
    catalogBaseURL string  // örn: "http://localhost:8004"
    httpClient     *http.Client
}
```

**NOT**: Bu endpoint'e Traefik'ten erişim için `catalog-admin` router'ı zaten
`forward-auth` middleware'i kullanıyor. Servisler arası iletişimde ise direkt
`host.docker.internal:8004` üzerinden erişim yapılır (Traefik bypass).

---

## 3. Özellik 2: Period CRUD Kilidi

Period handler'lar (hem `PeriodHandler` hem `SimplePeriodHandler`) her Create/Update/Delete
işleminde semester'ın aktif olup olmadığını kontrol edecek.

### 3.1 Handler Değişiklikleri

**`backend/shared/handler/period_handler.go`** — değişiklikler:

```go
// Mevcut struct:
type PeriodHandler struct {
    repo *repository.PeriodRepository
}

// Yeni struct (SemesterChecker ekleniyor):
type PeriodHandler struct {
    repo            *repository.PeriodRepository
    semesterChecker semester.Checker  // yeni alan
}

// Constructor değişir:
func NewPeriodHandler(repo *repository.PeriodRepository, checker semester.Checker) *PeriodHandler {
    return &PeriodHandler{repo: repo, semesterChecker: checker}
}
```

**CreatePeriod metoduna eklenen kontrol:**
```go
func (h *PeriodHandler) CreatePeriod(c *gin.Context) {
    // ... mevcut request parse ...

    // YENİ: Semester aktif mi kontrol et
    active, err := h.semesterChecker.IsSemesterActive(c.Request.Context(), req.Semester)
    if err != nil || !active {
        c.JSON(http.StatusForbidden, gin.H{
            "error": "SEMESTER_NOT_ACTIVE",
            "message": "Cannot modify periods for a non-active semester",
        })
        return
    }

    // ... mevcut CRUD devam ...
}
```

Aynı kontrol `UpdatePeriod` ve `DeletePeriod`'a da eklenir (period'un semester'ını
DB'den çekip kontrol eder).

**`backend/shared/handler/simple_period_handler.go`** — aynı değişiklikler uygulanır.

### 3.2 Meal Service Closed Days Handler

**`backend/services/meal-service/internal/handler/closed_days_handler.go`** — değişiklikler:

Closed days semester'a bağlı değil (tarih bazlı), ama yine de audit log'a yazılacak.
Semester kilidi closed days için geçerli DEĞİL — çünkü tatil günleri dönemden bağımsız.

### 3.3 Etkilenen cmd/main.go Dosyaları

Her serviste `NewPeriodHandler` veya `NewSimplePeriodHandler` çağrısına
`semesterChecker` parametresi eklenir:

- `backend/services/course-catalog-service/cmd/main.go`:
  ```go
  // Catalog kendi DB'sine direkt bakabilir
  checker := semesterStatusRepo  // (SemesterStatusRepository zaten Checker interface'ini karşılar)
  periodHandler := sharedHandler.NewSimplePeriodHandler(periodRepo, checker)
  ```

- `backend/services/enrollment-service/cmd/main.go`:
  ```go
  checker := semester.NewHTTPChecker("http://localhost:8004")
  periodHandler := sharedHandler.NewSimplePeriodHandler(periodRepo, checker)
  ```

- `backend/services/grades-service/cmd/main.go`:
  ```go
  checker := semester.NewHTTPChecker("http://localhost:8004")
  periodHandler := sharedHandler.NewPeriodHandler(periodRepo, checker)
  ```

---

## 4. Özellik 3: Hard Deadline ile Otomatik Kilit

Bu özellik Özellik 1 içinde zaten tanımlandı. Ek bir dosya gerektirmiyor.

### Nasıl çalışır:

1. Admin semester oluştururken `hard_deadline` tarihi verir
2. `IsSemesterActive()` her çağrıldığında:
   - `status == "active"` VE `hard_deadline > NOW()` → aktif
   - `status == "active"` VE `hard_deadline <= NOW()` → otomatik `completed`'e güncelle, aktif değil
3. DB trigger geri dönüşü engelliyor (completed → active asla mümkün değil)

### Örnek senaryo:
```
Semester: 2025-2026-Spring
Hard Deadline: 2026-07-01T00:00:00Z
Status: active

→ 30 Haziran 2026'da admin deadline ekleyebilir ✅
→ 1 Temmuz 2026'da IsSemesterActive() çağrılınca:
  - hard_deadline geçmiş → otomatik completed
  - Admin artık bu döneme dokunAMAZ ❌
```

---

## 5. Özellik 4: Audit Log (RabbitMQ Streams)

### 5.1 RabbitMQ Streams Nedir?

Normal RabbitMQ queue'larından farklı olarak:
- Mesajlar consume edildikten sonra **silinmez** (append-only)
- İstenen offset'ten **replay** yapılabilir
- Kafka benzeri log semantiği
- RabbitMQ 3.9+ ile birlikte gelir (projede 4.0 var ✅)

### 5.2 RabbitMQ Streams Aktifleştirme

**`backend/infrastructure/rabbitmq/rabbitmq.conf`** — ekleme:
```conf
# RabbitMQ Streams plugin
# Append-only log for audit events — messages are never deleted
rabbitmq_stream.listeners.tcp.default = 5552
```

**`backend/infrastructure/docker-compose.yml`** — rabbitmq servisine ekleme:
```yaml
# Port ekleme:
ports:
  - "5672:5672"   # AMQP (mevcut)
  - "15672:15672" # Management UI (mevcut)
  - "5552:5552"   # Streams (yeni)

# Plugin aktifleştirme:
environment:
  RABBITMQ_ENABLED_PLUGINS: "rabbitmq_management,rabbitmq_stream"
```

### 5.3 Audit Stream Oluşturma

**`backend/shared/rabbitmq/audit.go`** (yeni dosya):

```go
package rabbitmq

import (
    "context"
    "encoding/json"
    "time"
)

// AuditEvent represents an immutable audit log entry.
type AuditEvent struct {
    ID           string    `json:"id"`            // UUID
    Timestamp    time.Time `json:"timestamp"`
    Service      string    `json:"service"`       // "catalog", "enrollment", "grades", "meal"
    ActorID      string    `json:"actor_id"`      // İşlemi yapan kullanıcı UUID
    ActorRole    string    `json:"actor_role"`     // "admin", "teacher"
    Action       string    `json:"action"`        // "period.created", "semester.activated", vb.
    ResourceType string    `json:"resource_type"` // "academic_period", "semester", "closed_day", "grade"
    ResourceID   string    `json:"resource_id"`   // İlgili kaynağın UUID'si
    Details      any       `json:"details"`       // Ek JSON bilgisi (eski/yeni değer, sebep vb.)
}

// AuditLogger publishes audit events to a RabbitMQ Stream.
// Messages in a stream are NEVER deleted — append-only, immutable log.
type AuditLogger struct {
    publisher    *Publisher
    serviceName  string
}

func NewAuditLogger(publisher *Publisher, serviceName string) *AuditLogger {
    return &AuditLogger{publisher: publisher, serviceName: serviceName}
}

// Log publishes an audit event to the "audit.log" stream.
func (a *AuditLogger) Log(ctx context.Context, event AuditEvent) error {
    event.Service = a.serviceName
    event.Timestamp = time.Now()
    return a.publisher.Publish(ctx, "audit.events", "audit.log", event)
}
```

### 5.4 Stream Declare (Uygulama Başlangıcında)

Her servisin `cmd/main.go` dosyasında:
```go
// Normal queue yerine STREAM olarak declare
// Stream'ler x-queue-type: stream argümanı ile oluşturulur
ch := rabbitConn.Channel()
_, err := ch.QueueDeclare(
    "audit.log.stream",
    true,  // durable
    false, // auto-delete
    false, // exclusive
    false, // no-wait
    amqp.Table{
        "x-queue-type":            "stream",
        "x-max-length-bytes":      int64(1_000_000_000), // 1GB retention
    },
)
```

Veya shared'da bir helper fonksiyon:
```go
// backend/shared/rabbitmq/audit.go içine eklenir:
func (a *AuditLogger) DeclareStream(conn *Connection) error {
    ch := conn.Channel()
    // Exchange declare
    if err := ch.ExchangeDeclare("audit.events", "topic", true, false, false, false, nil); err != nil {
        return err
    }
    // Stream declare
    _, err := ch.QueueDeclare(
        "audit.log.stream",
        true, false, false, false,
        amqp.Table{
            "x-queue-type":       "stream",
            "x-max-length-bytes": int64(1_000_000_000), // 1GB
        },
    )
    if err != nil {
        return err
    }
    // Bind
    return ch.QueueBind("audit.log.stream", "audit.#", "audit.events", false, nil)
}
```

### 5.5 Hangi İşlemler Loglanır

| Action | Service | Tetiklendiği Yer |
|---|---|---|
| `semester.created` | catalog | SemesterStatusHandler.CreateSemester |
| `semester.activated` | catalog | SemesterStatusHandler.ActivateSemester |
| `semester.completed` | catalog | SemesterStatusHandler.CompleteSemester |
| `semester.auto_completed` | catalog | SemesterStatusRepository.IsSemesterActive (hard_deadline) |
| `period.created` | catalog, enrollment, grades | PeriodHandler.CreatePeriod / SimplePeriodHandler.CreatePeriod |
| `period.updated` | catalog, enrollment, grades | PeriodHandler.UpdatePeriod / SimplePeriodHandler.UpdatePeriod |
| `period.deleted` | catalog, enrollment, grades | PeriodHandler.DeletePeriod / SimplePeriodHandler.DeletePeriod |
| `closed_day.created` | meal | ClosedDaysHandler.CreateClosedDay |
| `closed_day.deleted` | meal | ClosedDaysHandler.DeleteClosedDay |
| `grade.appeal_processed` | grades | GradeService.ProcessAppeal |

### 5.6 Audit Event Örnekleri

**Semester aktivasyonu:**
```json
{
    "id": "550e8400-...",
    "timestamp": "2026-02-20T10:30:00Z",
    "service": "catalog",
    "actor_id": "00000000-0000-0000-0000-000000000001",
    "actor_role": "admin",
    "action": "semester.activated",
    "resource_type": "semester",
    "resource_id": "a1b2c3d4-...",
    "details": {
        "semester_name": "2025-2026-Spring",
        "hard_deadline": "2026-07-01T00:00:00Z"
    }
}
```

**Period silme:**
```json
{
    "id": "660e8400-...",
    "timestamp": "2026-03-15T14:20:00Z",
    "service": "grades",
    "actor_id": "00000000-0000-0000-0000-000000000001",
    "actor_role": "admin",
    "action": "period.deleted",
    "resource_type": "academic_period",
    "resource_id": "b2c3d4e5-...",
    "details": {
        "semester": "2025-2026-Spring",
        "period_start": "2026-02-01T00:00:00Z",
        "period_end": "2026-06-30T23:59:59Z",
        "course_id": null
    }
}
```

**Not itirazı:**
```json
{
    "id": "770e8400-...",
    "timestamp": "2026-09-01T09:00:00Z",
    "service": "grades",
    "actor_id": "00000000-0000-0000-0000-000000000001",
    "actor_role": "admin",
    "action": "grade.appeal_processed",
    "resource_type": "grade",
    "resource_id": "c3d4e5f6-...",
    "details": {
        "student_id": "d4e5f6g7-...",
        "course_code": "CS101",
        "semester": "2024-2025-Spring",
        "slug": "final",
        "old_score": 45.0,
        "new_score": 65.0,
        "old_grade_point": "FF",
        "new_grade_point": "CB",
        "reason": "Sınav kağıdı yeniden değerlendirildi"
    }
}
```

### 5.7 Audit Log Okuma (Admin Dashboard İçin)

RabbitMQ Streams'ten okuma için bir **consumer servis** veya **mevcut bir servisin
admin endpoint'i** kullanılabilir. En basit yaklaşım: catalog servisinde bir admin
endpoint oluşturup stream'den okuma yapmak.

Alternatif: İleride ayrı bir "audit-service" oluşturulabilir. Şimdilik
frontend'den audit logları göstermek için catalog servisine bir endpoint eklenir.

**Endpoint**: `GET /api/catalog/admin/audit-log?service=grades&action=period.deleted&limit=50`

Bu endpoint RabbitMQ stream'den consume eder (offset bazlı) ve JSON döner.

---

## 6. Özellik 5: Appeal (İtiraz) İyileştirmesi

### 6.1 DTO Değişikliği

**`backend/services/grades-service/internal/dto/grade_dto.go`**:

```go
// Mevcut:
type AppealScoreRequest struct {
    StudentID uuid.UUID `json:"student_id" binding:"required"`
    CourseID  uuid.UUID `json:"course_id" binding:"required"`
    Slug      string    `json:"slug" binding:"required"`
    NewScore  float64   `json:"new_score" binding:"required,min=0,max=100"`
}

// Yeni (reason alanı ekleniyor):
type AppealScoreRequest struct {
    StudentID uuid.UUID `json:"student_id" binding:"required"`
    CourseID  uuid.UUID `json:"course_id" binding:"required"`
    Slug      string    `json:"slug" binding:"required"`
    NewScore  float64   `json:"new_score" binding:"required,min=0,max=100"`
    Reason    string    `json:"reason" binding:"required,min=10"` // minimum 10 karakter gerekçe
}
```

### 6.2 Service Değişikliği

**`backend/services/grades-service/internal/service/grade_service.go`** — `ProcessAppeal` fonksiyonuna:

```go
func (s *GradeService) ProcessAppeal(ctx context.Context, req dto.AppealScoreRequest) (*dto.AppealScoreResponse, error) {
    // ... mevcut appeal mantığı ...

    // YENİ: İşlem bittikten sonra audit log yaz
    s.auditLogger.Log(ctx, rabbitmq.AuditEvent{
        ActorID:      getActorIDFromContext(ctx), // middleware'den gelen user_id
        ActorRole:    "admin",
        Action:       "grade.appeal_processed",
        ResourceType: "grade",
        ResourceID:   req.CourseID.String(),
        Details: map[string]any{
            "student_id":      req.StudentID,
            "course_code":     completedCourse.CourseCode,
            "semester":        completedCourse.Semester,
            "slug":            req.Slug,
            "old_score":       oldScore,
            "new_score":       req.NewScore,
            "old_grade_point": oldGradePoint,
            "new_grade_point": newGradePoint,
            "reason":          req.Reason,     // İtiraz gerekçesi
        },
    })

    return response, nil
}
```

---

## 7. Frontend Güncellemeleri

### 7.1 Yeni TypeScript Tipleri

**`frontend/lib/types.ts`** — eklenecekler:

```typescript
// Semester State Machine
export type SemesterStatus = 'planned' | 'active' | 'completed';

export interface Semester {
    id: string;
    name: string;                // "2025-2026-Fall"
    status: SemesterStatus;
    hard_deadline: string;       // ISO 8601
    activated_at?: string;
    completed_at?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateSemesterRequest {
    name: string;
    hard_deadline: string;
}

// Audit Log
export interface AuditLogEntry {
    id: string;
    timestamp: string;
    service: string;
    actor_id: string;
    actor_role: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details: Record<string, any>;
}
```

### 7.2 Yeni Servis Fonksiyonları

**`frontend/lib/services/system-service.ts`** — eklenecekler:

```typescript
// Semester Management
export async function listSemesters(): Promise<Semester[]> { ... }
export async function createSemester(data: CreateSemesterRequest): Promise<Semester> { ... }
export async function activateSemester(id: string): Promise<Semester> { ... }
export async function completeSemester(id: string): Promise<Semester> { ... }

// Audit Log
export async function listAuditLog(params?: {
    service?: string;
    action?: string;
    limit?: number;
}): Promise<AuditLogEntry[]> { ... }
```

### 7.3 Yeni UI Sayfaları/Bileşenleri

**`frontend/app/(admin)/system/periods/page.tsx`** — mevcut sayfaya ekleme:
- Sayfanın üst kısmına **aktif semester bilgisi** banner'ı eklenir
- Eğer aktif semester yoksa → "Önce bir dönem aktifleştirin" uyarısı gösterilir
- Period CRUD butonları aktif semester yoksa disabled olur

**`frontend/app/(admin)/system/semesters/page.tsx`** — yeni sayfa:
- Semester listesi (planned / active / completed badge'leri ile)
- "Yeni Dönem Oluştur" butonu ve formu (name + hard_deadline)
- "Aktifleştir" butonu (planned dönemlerde) — onay dialogu ile
- "Tamamla" butonu (active dönemlerde) — onay dialogu ile
- Geri dönüş butonu YOK (tasarım gereği)
- Hard deadline yaklaşıyorsa uyarı banner'ı

**`frontend/app/(admin)/system/audit/page.tsx`** — yeni sayfa:
- Audit log tablosu (tarih, servis, işlem, aktör, detay)
- Filtreleme: servise göre, işleme göre, tarihe göre
- Detay modal'ı: JSON details alanını güzel formatlayarak gösterir
- Sayfalama (limit/offset)

### 7.4 Sidebar Güncelleme

Sistem menüsüne iki yeni link eklenir:
- Dönem Yönetimi → `/system/semesters`
- Audit Log → `/system/audit`

---

## 8. Uygulama Sırası

Adımlar arasındaki bağımlılıklar dikkate alınarak sıralama:

### Adım 1: RabbitMQ Streams Altyapısı
1. `rabbitmq.conf`'a stream plugin ekle
2. `docker-compose.yml`'a port 5552 ve plugin environment ekle
3. `backend/shared/rabbitmq/audit.go` — AuditLogger + DeclareStream
4. Docker container'ı yeniden başlat

### Adım 2: Semester State Machine (Catalog Servisinde)
1. Migration dosyası oluştur (tablo + trigger)
2. sqlc queries yaz + `sqlc generate`
3. `SemesterStatusRepository` oluştur
4. `SemesterStatusHandler` oluştur
5. `cmd/main.go`'ya entegre et
6. `semester_service.go`'ya aktif semester kontrolü ekle
7. Migration uygula + `go build` ile doğrula

### Adım 3: Shared Semester Checker
1. `backend/shared/semester/checker.go` — interface
2. `backend/shared/semester/http_checker.go` — HTTP implementasyonu
3. Catalog repo'nun Checker interface'ini karşıladığını doğrula

### Adım 4: Period CRUD Kilidi
1. `PeriodHandler`'a `SemesterChecker` inject et
2. `SimplePeriodHandler`'a `SemesterChecker` inject et
3. Create/Update/Delete'e semester kontrolü ekle
4. Her servisin `cmd/main.go`'suna checker'ı geç
5. Tüm servisleri build et

### Adım 5: Audit Log Entegrasyonu
1. Her serviste `AuditLogger` oluştur ve inject et
2. Period handler'lara audit log yaz
3. SemesterStatusHandler'a audit log yaz
4. ClosedDaysHandler'a audit log yaz
5. Tüm servisleri build et

### Adım 6: Appeal İyileştirmesi
1. `AppealScoreRequest`'e `reason` alanı ekle
2. `ProcessAppeal`'a audit log yaz
3. `go build` ile doğrula

### Adım 7: Frontend
1. TypeScript tipleri ekle
2. Servis fonksiyonları ekle
3. Semester yönetimi sayfası
4. Periods sayfasına aktif semester banner'ı
5. Audit log sayfası
6. Sidebar güncelle
7. `bun tsc` ile doğrula

---

## 9. Dosya Değişiklik Özeti

### Yeni Dosyalar
| Dosya | Açıklama |
|---|---|
| `backend/services/course-catalog-service/sql/migrations/00010_create_semesters_table.sql` | Semester tablosu + DB trigger |
| `backend/services/course-catalog-service/sql/queries/semesters.sql` | Semester SQL sorguları |
| `backend/services/course-catalog-service/internal/repository/semester_status_repository.go` | Semester repository |
| `backend/services/course-catalog-service/internal/handler/semester_status_handler.go` | Semester admin endpoint'leri |
| `backend/shared/semester/checker.go` | SemesterChecker interface |
| `backend/shared/semester/http_checker.go` | HTTP bazlı semester checker |
| `backend/shared/rabbitmq/audit.go` | AuditLogger + stream declare |
| `frontend/app/(admin)/system/semesters/page.tsx` | Semester yönetimi UI |
| `frontend/app/(admin)/system/audit/page.tsx` | Audit log görüntüleme UI |

### Değiştirilecek Dosyalar
| Dosya | Değişiklik |
|---|---|
| `backend/infrastructure/rabbitmq/rabbitmq.conf` | Stream plugin port ekleme |
| `backend/infrastructure/docker-compose.yml` | Port 5552 + stream plugin |
| `backend/shared/handler/period_handler.go` | SemesterChecker inject + kontrol |
| `backend/shared/handler/simple_period_handler.go` | SemesterChecker inject + kontrol |
| `backend/services/course-catalog-service/cmd/main.go` | Semester repo/handler ekleme |
| `backend/services/course-catalog-service/internal/service/semester_service.go` | Aktif semester kontrolü |
| `backend/services/course-catalog-service/internal/errors/errors.go` | ErrSemesterNotActive |
| `backend/services/enrollment-service/cmd/main.go` | HTTPChecker + AuditLogger ekleme |
| `backend/services/grades-service/cmd/main.go` | HTTPChecker + AuditLogger ekleme |
| `backend/services/grades-service/internal/dto/grade_dto.go` | AppealScoreRequest.Reason |
| `backend/services/grades-service/internal/service/grade_service.go` | Appeal audit log |
| `backend/services/meal-service/cmd/main.go` | AuditLogger ekleme |
| `backend/services/meal-service/internal/handler/closed_days_handler.go` | Audit log |
| `frontend/lib/types.ts` | Semester + AuditLogEntry tipleri |
| `frontend/lib/services/system-service.ts` | Semester + audit servis fonksiyonları |
| `frontend/app/(admin)/system/periods/page.tsx` | Aktif semester banner |

### sqlc Regenerate Gereken Servisler
- `backend/services/course-catalog-service/` (yeni semesters queries)

---

## 10. Doğrulama Adımları

### Backend
```bash
# 1. RabbitMQ Streams çalışıyor mu?
docker exec mydreamcampus-rabbitmq rabbitmq-plugins list | grep stream

# 2. Migration uygula
cd backend/services/course-catalog-service && goose -dir sql/migrations postgres "$DB_URL" up

# 3. DB trigger testi — completed semester geri aktif edilememeli
psql -c "UPDATE semesters SET status = 'active' WHERE status = 'completed';"
# → HATA beklenir: "Cannot change status of a completed semester"

# 4. Tüm servisleri build et
cd backend/services/course-catalog-service && go build ./...
cd backend/services/enrollment-service && go build ./...
cd backend/services/grades-service && go build ./...
cd backend/services/meal-service && go build ./...

# 5. Period oluşturma testi — inactive semester için
curl -X POST /api/catalog/periods -d '{"semester":"2020-2021-Fall",...}'
# → 403 SEMESTER_NOT_ACTIVE beklenir

# 6. Audit stream'e mesaj geldi mi?
rabbitmqadmin get queue=audit.log.stream count=5
```

### Frontend
```bash
cd frontend && bun tsc --noEmit
```

### Manuel Test Senaryoları
1. Yeni semester oluştur (planned) → deadline eklemeyi dene → ❌ reddedilmeli
2. Semester'ı aktifleştir → deadline ekle → ✅ başarılı
3. Semester'ı tamamla → deadline silmeyi dene → ❌ reddedilmeli
4. Tamamlanmış semester'ı geri aktifleştirmeyi dene → ❌ DB trigger hatası
5. Hard deadline geçmiş active semester → otomatik completed olmalı
6. Not itirazı yap → audit log'da görünmeli (reason ile birlikte)
7. Audit log sayfasını aç → tüm işlemler listelenmiş olmalı
