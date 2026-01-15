# Mock Data Documentation

Bu klasör, backend servisleri henüz hazır değilken frontend geliştirme için mock (sahte) veriler içerir.

## 📁 Dosya Yapısı

```
mock_data/
├── index.ts              # Tüm mock dataları export eden ana dosya
├── auth.ts               # Kullanıcı, oturum ve auth verileri
├── staff.ts              # Akademik personel verileri
├── students.ts           # Öğrenci verileri
├── catalog.ts            # Ders kataloğu, ders açılımları, kayıtlar
├── attendance.ts         # Yoklama verileri
├── grades.ts             # Not ve transkript verileri
└── meal.ts               # Yemekhane rezervasyon verileri
```

## 🔄 Mock API Kullanımı

### Aktifleştirme

Mock API'yi kullanmak için `.env.local` dosyasında:

```bash
NEXT_PUBLIC_USE_MOCK_API=true
```

Gerçek API'ye geçmek için:

```bash
NEXT_PUBLIC_USE_MOCK_API=false
```

### Import Yöntemleri

```typescript
// Tek tek import
import { mockUsers } from '@/mock_data/auth';
import { mockStaff } from '@/mock_data/staff';
import { mockCourseOfferings } from '@/mock_data/catalog';

// Veya tümünü birden
import { MockData } from '@/mock_data';

// Kullanım
const users = MockData.users;
const courses = MockData.courseOfferings;
```

## 📊 Mock Veriler

### Auth (auth.ts)
- **6 kullanıcı**: 1 admin, 3 öğretmen, 2 öğrenci
- **3 oturum**: Farklı cihazlar ve IP adresleri
- **Login response**: Token ve kullanıcı bilgileri

### Staff (staff.ts)
- **6 akademisyen**
- **Unvanlar**: Prof. Dr., Doç. Dr., Dr. Öğr. Üyesi, Arş. Gör.
- **Bölümler**: Bilgisayar Müh., Matematik, Fizik, Elektrik Müh.

### Students (students.ts)
- **6 öğrenci**
- **Sınıf seviyeleri**: 1, 2, 3
- **Danışman atamaları** yapılmış

### Catalog (catalog.ts)
- **6 ders**: Zorunlu ve seçmeli dersler
- **6 ders açılımı**: Schedule bilgileri ile
- **Schedule yapısı**: `{ day: 1-5, slot: 1-9 }`
- **3 enrollment**: Onaylanmış ve bekleyen kayıtlar

### Attendance (attendance.ts)
- **3 yoklama oturumu**: Aktif ve pasif
- **QR kodları** ve bitiş süreleri
- **Yoklama kayıtları**: Present, absent, excused
- **Özet raporlar**: Toplam hafta, devamsızlık limiti

### Grades (grades.ts)
- **6 not kaydı**: Finalized ve draft
- **Assessment skorları**: Vize, final, ödev, proje
- **Harf notları**: AA, BA, BB, CB, CC, DC, DD, FD, FF
- **GPA hesaplama**: Otomatik ortalama
- **Transkript**: Tüm dönemler

### Meal (meal.ts)
- **4 kafeterya**: Aktif ve pasif
- **6 rezervasyon**: Geçmiş, güncel, gelecek
- **QR kodları**: Günlük yemek için
- **Menü tipleri**: Normal, vegan

## 🎯 Endpoint Mapping

### Mock API Client

Mock API client, gerçek API endpoint'lerini simüle eder:

```typescript
// GET endpoints
catalogApi.get('offerings?semester=fall&year=2025')
enrollmentApi.get('my')
studentApi.get('students')
attendanceApi.get('sessions/active')
gradesApi.get('my')

// POST endpoints
authApi.post('login', { json: { email, password } })
enrollmentApi.post('enroll', { json: { course_offering_ids } })
attendanceApi.post('mark', { json: { session_id, qr_secret } })

// DELETE endpoints
enrollmentApi.delete(enrollmentId)
```

## 🔧 Mock Data Güncelleme

### Yeni Veri Ekleme

1. İlgili dosyayı aç (örn: `catalog.ts`)
2. Array'e yeni obje ekle
3. UUID'leri unique tut
4. Tarihleri güncel tut

```typescript
// catalog.ts dosyasına yeni ders ekleme
export const mockCourseOfferings: CourseOffering[] = [
  ...existing courses,
  {
    id: 'offering-007',
    course_code: 'BİL 3005-1',
    course_name: 'Yeni Ders',
    // ...diğer alanlar
  }
];
```

### Endpoint Ekleme

`mock-api-client.ts` dosyasında yeni endpoint handle et:

```typescript
async get(url: string): Promise<MockResponse<any>> {
  if (cleanUrl === 'new-endpoint') {
    return new MockResponse(MockData.newData);
  }
  // ...
}
```

## 📝 Notlar

- **Network delay**: 300ms simüle edilir (gerçekçi API davranışı)
- **Console log**: Tüm API çağrıları console'a loglanır
- **Type safety**: Tüm mock data TypeScript ile tip güvenli
- **Auto-complete**: IDE'de otomatik tamamlama çalışır

## 🚀 Production

Production'da mutlaka `NEXT_PUBLIC_USE_MOCK_API=false` olmalı!

```bash
# .env.production
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_BASE_URL=https://api.mydreamcampus.edu.tr
```
