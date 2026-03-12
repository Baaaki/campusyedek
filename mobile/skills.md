# Mobile - React Native (Expo)

Bu proje React Native + Expo ile yazilmistir. Web frontend (React + Vite) DEGILDIR.

## Kurallar

- Paket yoneticisi: `npm` (bun DEGIL — mobile projede package-lock.json kullaniliyor)
- React Router KULLANMA — Expo Router kullan (`expo-router`)
- `next/navigation`, `next/link` gibi Next.js/web modulleri KULLANMA
- `react-router` KULLANMA — bu web frontend icin, mobile icin Expo Router var
- Web-only React hook'lari (`useSearchParams` from react-router) KULLANMA

## Teknoloji

- **Framework**: React Native 0.81 + Expo 54 (New Architecture enabled)
- **Routing**: Expo Router v6 (file-based routing, `app/` dizini)
- **State/Data**: @tanstack/react-query
- **HTTP**: axios
- **Forms**: react-hook-form + zod (validation)
- **Auth Storage**: expo-secure-store
- **Icons**: @expo/vector-icons
- **Animations**: react-native-reanimated
- **Navigation**: @react-navigation/native (Expo Router tarafindan kullanilir)

## Routing Kurallari (Expo Router - File-based)

- `app/_layout.tsx` — Root layout (Stack, Tabs tanimlari)
- `app/(tabs)/` — Tab navigator gruplari
- `app/(auth)/` — Auth akisi sayfalari (login, register)
- `app/(staff)/` — Staff akisi sayfalari
- `app/screens/` — Ekran componentleri
- `app/modal.tsx` — Modal ekran
- `app/+not-found.tsx` — 404 sayfasi
- `app/+html.tsx` — Web HTML wrapper

### Navigation
```tsx
import { useRouter, useLocalSearchParams, Link } from 'expo-router';

// Programmatic navigation
const router = useRouter();
router.push('/screens/detail');
router.back();

// Link componenti
<Link href="/screens/detail">Detay</Link>  // href kullan, to DEGIL

// URL parametreleri
const { id } = useLocalSearchParams();  // useParams DEGIL
```

## Dosya Yapisi

```
mobile/
├── app/                    # Expo Router sayfalari (file-based routing)
│   ├── _layout.tsx         # Root layout
│   ├── (tabs)/             # Tab navigator
│   ├── (auth)/             # Auth flow
│   ├── (staff)/            # Staff flow
│   └── screens/            # Screen componentleri
├── components/             # Paylasilan componentler
├── contexts/               # Context provider'lar (AuthContext, ThemeContext)
├── hooks/                  # Custom hook'lar (useAuth, useGrades, useMeals, useAttendance)
├── services/               # API servisleri (authService, attendanceService, gradesService, mealService)
│   └── api.ts              # Axios API client instance
├── constants/              # Sabit degerler
├── types/                  # TypeScript tipleri
└── assets/                 # Gorseller, fontlar
```

## API Client

- Base instance: `services/api.ts` (axios)
- Her servis icin ayri dosya: `services/authService.ts`, `services/gradesService.ts`, vb.
- Token yonetimi: `expo-secure-store` ile guvenli depolama

## Environment Variables

- Expo Constants uzerinden: `expo-constants`
- `app.json` icinde `extra` alani veya `.env` dosyasi ile EAS Build

## Platform Farkliliklari

- `.web.ts` suffix'i web-specific implementasyonlar icin (ornek: `useColorScheme.web.ts`)
- `react-native-web` ile web desteji mevcut
- Platform kontrolu: `import { Platform } from 'react-native'`
