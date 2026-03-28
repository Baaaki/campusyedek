# Backend - Go Microservices

Bu proje Go 1.26 ile yazilmis bir mikroservis mimarisidir. Detayli rehber icin `CLAUDE.md` dosyasina bak.

## Kurallar

- **pgtype**: ASLA struct literal (`pgtype.Text{String: "x", Valid: true}`) veya `AssignTo()` KULLANMA — her zaman `shared/utils/pgtype_helpers.go` fonksiyonlarini kullan
- **Servisler arasi iletisim**: HTTP call YAPMA — RabbitMQ ile event-driven iletisim kullan
- **Database**: Her servisin kendi PostgreSQL veritabani var (database-per-service)
- **Frontend erisimine**: Direkt servis erisimine IZIN VERME — Traefik API gateway uzerinden (`http://localhost/api/{service}`)

## Teknoloji

- **Dil**: Go 1.26 (monorepo: `go.work`)
- **Framework**: Gin v1.11
- **Database**: PostgreSQL 18+ (pgx/v5, sqlc, goose)
- **Messaging**: RabbitMQ 4.0+ (topic exchange, outbox pattern)
- **Cache**: Redis 7.2+ (token blacklist, rate limiting, caching)
- **Auth**: JWT (HS256) + Argon2id password hashing
- **Logging**: Zap (structured JSON logging, Loki entegrasyonu)
- **Config**: Viper (.env dosyalari)
- **Gateway**: Traefik v3.2 (port 80)
- **Observability**: Grafana + Loki + Promtail

## Servisler

| Servis | Port | DB Port | Amac |
|--------|------|---------|------|
| auth-service | 8001 | 5432 | Kimlik dogrulama, JWT, session yonetimi |
| staff-service | 8002 | 5433 | Personel/ogretmen yonetimi |
| student-service | 8003 | 5434 | Ogrenci yonetimi, CSV import |
| course-catalog-service | 8004 | 5435 | Ders katalogu, mufredat, donem dersleri |
| enrollment-service | 8005 | 5436 | Ders kayit, onay/red surecleri |
| attendance-service | 8006 | 5437 | Yoklama takibi |
| grades-service | 8007 | 5438 | Not yonetimi, GPA hesaplama |
| meal-service | 8008 | 5439 | Yemekhane yonetimi |
| payment-service | 50051 | 5440 | Odeme isleme (gRPC) |

## Servis Yapisi (Layered Architecture)

```
service-name/
├── cmd/main.go              # Entry point
├── config/config.go         # Viper config
├── internal/
│   ├── db/                  # sqlc generated (DUZENLEME)
│   ├── repository/          # Data access (sqlc queries kullanir)
│   ├── service/             # Business logic
│   ├── handler/             # HTTP handlers (Gin)
│   ├── dto/                 # Request/Response DTOs
│   ├── worker/              # Background workers (outbox, consumer)
│   └── errors/              # Servise ozel hatalar
├── sql/
│   ├── migrations/          # goose migration dosyalari
│   └── queries/             # sqlc SQL query dosyalari
├── sqlc.yaml
├── Makefile
└── go.mod
```

## Shared Paketler (`shared/`)

| Paket | Amac |
|-------|------|
| `database/` | PostgreSQL pool olusturma (pgxpool) |
| `middleware/` | Auth, CORS, RBAC, rate limit, recovery, logger |
| `rabbitmq/` | Connection, Publisher, Consumer, DLQ |
| `redis/` | Redis client, token blacklist, session yonetimi |
| `utils/` | pgtype helpers, JWT, password hash, validation |
| `logger/` | Zap wrapper, context propagation, request ID |
| `errors/` | AppError tipi (HTTP status + wrapping) |
| `config/` | Ortak config helper'lar |
| `clock/` | Zaman simulasyonu (test icin Real/Simulated) |
| `events/` | Event type sabitleri, queue isimleri |
| `audit/` | HTTP audit loglama |
| `rules/` | Is kurali tanimlari |

## Goose Migration Kurallari

**`$$` delimiter kullanan SQL fonksiyonlari (PL/pgSQL) icin `-- +goose StatementBegin` / `-- +goose StatementEnd` satirlari ZORUNLUDUR.** Goose, `$$` isaretlerini varsayilan statement ayiricisi olarak tanimiyor ve "unterminated dollar-quoted string" hatasi veriyor.

```sql
-- YANLIS! (goose parse edemez)
CREATE OR REPLACE FUNCTION my_func()
RETURNS TRIGGER AS $$
BEGIN
    -- ...
END;
$$ LANGUAGE plpgsql;

-- DOGRU!
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION my_func()
RETURNS TRIGGER AS $$
BEGIN
    -- ...
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
```

Bu kural tum `CREATE FUNCTION`, `CREATE TRIGGER` ve `DO $$` bloklari icin gecerlidir.

## Gelistirme Workflow (Yeni Ozellik / Servis)

1. **Migration olustur**: `make migrate-create name=create_xxx`
2. **Migration calistir**: `make migrate-up`
3. **SQL query yaz**: `sql/queries/xxx.sql` (sqlc annotation'lari ile)
4. **Go kodu uret**: `make sqlc` (internal/db/ altina generate eder)
5. **Repository yaz**: `internal/repository/xxx_repository.go` — sqlc queries'i sarar, `db.New(pool)` ile Queries olusturur
6. **Service yaz**: `internal/service/xxx_service.go` — business logic, pgtype donusumleri icin `shared/utils` kullan
7. **DTO yaz**: `internal/dto/xxx_dto.go` — request/response struct'lari (JSON tag'leri ile)
8. **Handler yaz**: `internal/handler/xxx_handler.go` — Gin handler'lari, `c.ShouldBindJSON`, `c.JSON`, Zap logging
9. **Route ekle**: `cmd/main.go` icerisinde router grubuna endpoint'leri bagla
10. **Test et**: `air` ile hot reload, Postman/curl ile manuel test

## Onemli Pattern'ler

### Outbox Pattern (Event Publishing)
1. Servis, event'i kendi `outbox_events` tablosuna yazar (ayni transaction)
2. `OutboxWorker` periyodik olarak pending event'leri alir
3. RabbitMQ'ya publish eder
4. Status'u `processed` olarak gunceller

### Event Consumer
- Manual acknowledgment (auto-ack KAPALI)
- Retry counter header'da tutulur
- Max retry sonrasi DLQ'ya gonder
- Idempotency icin `processed_events` tablosu kontrol edilir

### Auth & RBAC
- Roller: `admin`, `teacher`, `student`
- JWT claims: UserID, Role, Department, TokenVersion
- Access token: 15 dk, Refresh token: 24 saat
- Middleware: `JWTAuth()`, `RequireRole("admin")`, `ExtractUserFromHeaders()`

### Rate Limiting (Redis-backed)
- IP bazli, kullanici bazli, endpoint bazli
- Sliding window counter
- Redis hata durumunda fail-open

### Graceful Shutdown
- SIGINT/SIGTERM dinler
- 5 saniye timeout
- DB pool, Redis, RabbitMQ baglantilari kapatilir

## pgtype Hizli Referans

| pgtype | Go'ya | pgtype'a |
|--------|-------|----------|
| `pgtype.Text` | `utils.PgTextToString(v)` | `utils.StringToPgText(s)` |
| `pgtype.Bool` | `utils.PgBoolToBool(v)` | `utils.BoolToPgBool(b)` |
| `pgtype.Numeric` | `utils.PgNumericToFloat64(v)` | `utils.Float64ToPgNumeric(f)` |
| `pgtype.Int2` | `int16(v.Int16)` | `utils.Int16ToPgInt2(i)` |
| `pgtype.Timestamp` | `utils.PgTimestampToTime(v)` | `utils.TimeToPgTimestamp(t)` |
| `pgtype.UUID` | `utils.PgUUIDToString(v)` | `utils.StringToPgUUID(s)` |

### pgtype Sik Yapilan Hatalar

#### HATA 1: Struct Literal Kullanimi
```go
// YANLIS!
params := db.CreateUserParams{
    Email: pgtype.Text{String: req.Email, Valid: true},
    IsActive: pgtype.Bool{Bool: true, Valid: true},
}

// DOGRU!
params := db.CreateUserParams{
    Email: utils.StringToPgText(req.Email),
    IsActive: utils.BoolToPgBool(true),
}
```

#### HATA 2: Boolean Kontrolu
```go
// YANLIS! (pgtype.Bool bir struct, true/false degil!)
if student.IsActive {
}

// DOGRU!
if utils.PgBoolToBool(student.IsActive) {
}
```

#### HATA 3: AssignTo() Kullanimi
```go
// YANLIS! (Artik desteklenmiyor!)
var score float64
result.Score.AssignTo(&score)

// DOGRU!
score, err := utils.PgNumericToFloat64(result.Score)
if err != nil {
    // handle error
}
```

#### HATA 4: Aggregate Query Sonuclari (interface{})
```go
// sqlc bazi aggregate query'lerde interface{} dondurur (AVG, SUM, etc.)

// YANLIS!
var gpa float64
result.Gpa.AssignTo(&gpa)  // interface{} uzerinde metod yok!

// DOGRU!
var gpa float64
if result.Gpa != nil {
    if gpaFloat, ok := result.Gpa.(float64); ok {
        gpa = gpaFloat
    }
}
```

### Yeni Servis Olustururken pgtype Checklist

1. `internal/service/*.go` dosyalarina `import "github.com/baaaki/mydreamcampus/shared/utils"` ekle
2. Repository'den gelen tum pgtype degerleri utils ile cevir
3. Repository'ye gonderilen tum degerleri utils ile pgtype'a cevir
4. Boolean check yaparken `utils.PgBoolToBool()` kullan
5. `AssignTo()` kelimesini hicbir zaman kullanma
6. Aggregate query sonuclari icin type assertion kullan

