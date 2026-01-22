'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  UtensilsCrossed,
  History,
  CalendarCheck,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Mock reservation data
const reservations = [
  // Current/Upcoming
  {
    id: 1,
    date: '2026-01-16',
    day: 'Cuma',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'normal',
    status: 'upcoming',
  },
  {
    id: 2,
    date: '2026-01-19',
    day: 'Pazartesi',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'vegan',
    status: 'upcoming',
  },
  {
    id: 3,
    date: '2026-01-20',
    day: 'Salı',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'normal',
    status: 'upcoming',
  },
  // Past (More data for pagination)
  {
    id: 4,
    date: '2026-01-15',
    day: 'Perşembe',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'normal',
    status: 'completed',
  },
  {
    id: 5,
    date: '2026-01-14',
    day: 'Çarşamba',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'vegan',
    status: 'completed',
  },
  {
    id: 6,
    date: '2026-01-13',
    day: 'Salı',
    cafeteria: 'Mühendislik Yemekhane',
    mealType: 'normal',
    status: 'missed',
  },
  {
    id: 7,
    date: '2026-01-12',
    day: 'Pazartesi',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'normal',
    status: 'completed',
  },
  {
    id: 8,
    date: '2026-01-09',
    day: 'Cuma',
    cafeteria: 'Tıp Fakültesi Yemekhane',
    mealType: 'vegan',
    status: 'completed',
  },
  {
    id: 9,
    date: '2026-01-08',
    day: 'Perşembe',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'normal',
    status: 'completed',
  },
  {
    id: 10,
    date: '2026-01-07',
    day: 'Çarşamba',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'normal',
    status: 'completed',
  },
  {
    id: 11,
    date: '2026-01-06',
    day: 'Salı',
    cafeteria: 'Mühendislik Yemekhane',
    mealType: 'normal',
    status: 'missed',
  },
  {
    id: 12,
    date: '2026-01-05',
    day: 'Pazartesi',
    cafeteria: 'Merkez Yemekhane',
    mealType: 'vegan',
    status: 'completed',
  },
];

const ITEMS_PER_PAGE = 5;

export default function CafeteriaHistoryPage() {
  const [currentPage, setCurrentPage] = useState(1);

  const upcomingReservations = reservations.filter(r => r.status === 'upcoming');
  const pastReservations = reservations.filter(r => r.status !== 'upcoming');

  // Pagination Logic
  const totalPages = Math.ceil(pastReservations.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentPastReservations = pastReservations.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Gelecek</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Kullanıldı</Badge>;
      case 'missed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Kullanılmadı</Badge>;
      default:
        return <Badge variant="outline">Bilinmiyor</Badge>;
    }
  };

  const getMealTypeLabel = (type: string) => {
    return type === 'vegan' ? (
      <span className="flex items-center gap-1 text-green-600 font-medium text-xs">
        <span className="w-2 h-2 rounded-full bg-green-500" /> Vegan
      </span>
    ) : (
      <span className="flex items-center gap-1 text-orange-600 font-medium text-xs">
        <span className="w-2 h-2 rounded-full bg-orange-500" /> Normal
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <History className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Geçmiş Randevularım</h1>
          <p className="text-gray-600 dark:text-gray-400">Yemekhane randevu geçmişinizi ve gelecek randevularınızı görüntüleyin</p>
        </div>
      </div>

      {/* Upcoming Reservations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            Aktif Randevular
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingReservations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-500">Tarih</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-500">Yemekhane</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-500">Menü Tipi</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-500">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {upcomingReservations.map((res) => (
                    <tr key={res.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {new Date(res.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-gray-500">{res.day}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <MapPin className="h-4 w-4" />
                          {res.cafeteria}
                        </div>
                      </td>
                      <td className="py-3 px-4">{getMealTypeLabel(res.mealType)}</td>
                      <td className="py-3 px-4">{getStatusBadge(res.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Aktif randevunuz bulunmamaktadır.</p>
          )}
        </CardContent>
      </Card>

      {/* Past History with Pagination */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            Geçmiş Kayıtlar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-sm text-gray-500">Tarih</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-gray-500">Yemekhane</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-gray-500">Menü Tipi</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-gray-500">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {currentPastReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {new Date(res.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span className="text-xs text-gray-500">{res.day}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <MapPin className="h-4 w-4" />
                        {res.cafeteria}
                      </div>
                    </td>
                    <td className="py-3 px-4">{getMealTypeLabel(res.mealType)}</td>
                    <td className="py-3 px-4">{getStatusBadge(res.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pastReservations.length === 0 && (
              <p className="text-gray-500 text-center py-8">Geçmiş kayıt bulunamadı.</p>
            )}
          </div>

          {/* Pagination Controls */}
          {pastReservations.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t dark:border-gray-700">
              <div className="text-sm text-gray-500">
                Toplam {pastReservations.length} kayıttan {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, pastReservations.length)} arası gösteriliyor
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                  Sayfa {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
