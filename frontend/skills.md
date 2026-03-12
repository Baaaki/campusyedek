# Frontend - React + Vite

Bu proje React + Vite ile yazilmistir. Next.js DEGILDIR.

## Kurallar

- Paket yoneticisi: `bun` (npm/npx KULLANMA, `bunx --bun` kullan)
- `'use client'` KULLANMA — Vite'da boyle bir sey yok
- `next/navigation`, `next/link`, `next/image`, `next/font` gibi Next.js modulleri KULLANMA

## Teknoloji

- **Build**: Vite
- **Routing**: react-router v7 (`import { Link, useNavigate, useLocation, useParams, useSearchParams } from 'react-router'`)
- **UI**: shadcn/ui (radix-vega style) + Tailwind CSS 4
- **State/Data**: @tanstack/react-query
- **HTTP**: ky
- **Icons**: lucide-react

## Routing Kurallari

- Link componenti: `<Link to="/path">` (`href` DEGIL, `to` kullan)
- Programmatic navigation: `const navigate = useNavigate()` sonra `navigate('/path')`
- Geri gitme: `navigate(-1)`
- Aktif route: `const { pathname } = useLocation()`
- URL parametreleri: `const { id } = useParams()`
- Query parametreleri: `const [searchParams] = useSearchParams()`

## Dosya Yapisi

- `src/pages/` — Sayfa componentleri
- `src/components/ui/` — shadcn componentleri
- `src/components/layout/` — Layout componentleri (Outlet kullanir)
- `src/components/providers/` — Context provider'lar
- `src/lib/api-client.ts` — ky HTTP client (tum API instance'lari)
- `src/lib/services/` — API servis fonksiyonlari
- `src/lib/types.ts` — TypeScript tipleri
- `src/lib/utils.ts` — Utility fonksiyonlari (cn helper)
- `src/routes.tsx` — Tum route tanimlari
- `src/main.tsx` — Entry point

## Alias

- `@/` -> `src/` (ornek: `import { Button } from '@/components/ui/button'`)

## Environment Variables

- Prefix: `VITE_` (ornek: `VITE_API_BASE_URL`)
- Erisim: `import.meta.env.VITE_API_BASE_URL` (`process.env` DEGIL)
