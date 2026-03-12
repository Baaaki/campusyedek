# MyDreamCampus - Gelistirme Rehberi

Universite yonetim sistemi. Full-stack monorepo: Go mikroservisler + React web + React Native mobil.

## Proje Yapisi

```
mydreamcampus/
├── backend/                # Go mikroservisler monorepo
│   ├── services/           # 9 mikroservis
│   ├── shared/             # Ortak Go paketleri
│   ├── infrastructure/     # Docker Compose, Traefik, DB, RabbitMQ, Redis, Loki
│   └── go.work             # Go workspace
├── frontend/               # React + Vite web uygulamasi
├── mobile/                 # React Native + Expo mobil uygulama
└── old-frontend/           # Eski Next.js frontend (deprecated)
```

### Detayli Rehberler

- **Backend**: `backend/skills.md` (hizli referans)
- **Frontend**: `frontend/skills.md`
- **Mobile**: `mobile/skills.md`

---

## Genel Kurallar

### Docker
- `sudo` ile docker komutu CALISTIRMA — kullaniciya komutu goster, kendisi calistirsin
- Ornek: `sudo docker compose up -d postgres-auth rabbitmq redis`

### Dil
- Konusma dili: Turkce
- Kod ve degisken isimleri: Ingilizce

### Git Commit Formati
```
<type>(<scope>): <description>

feat(auth): add login and register endpoints
fix(shared): resolve logger initialization bug
chore(infra): update traefik configuration
feat(frontend): add student dashboard page
feat(mobile): implement attendance screen
```

Her ozellik tamamlandiginda HEMEN commit at. Atomic commit'ler tercih et.

---

## Mentoring Ilkeleri

### Rol: Senior Developer Coach
- Best practice'leri dogrudan goster, soru SORMA
- Acik standart varsa (Argon2 > MD5, HTTP status code'lar) direkt uygula
- Gercek mimari secimlerde kullaniciya sor (trade-off'lar, kutuphane tercihleri)

---

## Kullanici Icin Claude Code Ipuclari

### /simplify — Kod Kalite Kontrolu
Bir ozellik yazdiktan sonra `/simplify` calistir. Degisiklikleri 3 paralel incelemeye sokar:
- **Tekrar kullanim**: Ayni kod baska yerde var mi? Shared'a tasinabilir mi?
- **Kalite**: Bug riski, edge case, error handling eksigi var mi?
- **Verimlilik**: Gereksiz dongu, fazla allocation, optimize edilebilecek query var mi?

Sorun bulursa dogrudan duzeltir.

### Subagent — Genis Kapsamli Arastirma
Cok dosya okumayi gerektiren arastirmalarda context'in dolmasini onlemek icin subagent kullan.

**Ne zaman:** Birden fazla serviste bir pattern aramak, karsilastirma yapmak, genis analiz.
**Nasil:** Mesajinda "subagent kullanarak arastir" veya "agent ile incele" yaz.

Ornekler:
- "Subagent kullanarak tum servislerdeki event consumer'lari karsilastir"
- "Agent ile shared/ altindaki tum middleware'lerin kullanim yerlerini bul"
- "Bunu arastirmak icin agent kullan, sonucu ozetle"

**Ne zaman kullanma:** Tek dosya okumak, basit sorular — bunlar icin gereksiz overhead.

---

## Referanslar

- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
- [sqlc Docs](https://docs.sqlc.dev/en/latest/)
- [pgx Docs](https://pkg.go.dev/github.com/jackc/pgx/v5)
- [goose Docs](https://pressly.github.io/goose/)
- [Traefik v3 Docs](https://doc.traefik.io/traefik/)
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [React Router v7 Docs](https://reactrouter.com/)
- [TanStack Query Docs](https://tanstack.com/query/latest)
