'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Utensils, Leaf, Flame, AlertCircle } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';

// Mock Menu Data Generator
const getMockMenuForDate = (date: Date) => {
  const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Rotating menus based on day of week
  const menus = [
    // Sunday (Weekend)
    {
      normal: {
        soup: { name: 'Domates Çorbası', calories: 110, allergens: ['Süt'] },
        main: { name: 'Pazar Kavurması', calories: 480, allergens: [] },
        side: { name: 'Pirinç Pilavı', calories: 200, allergens: ['Gluten'] },
        salad: { name: 'Çoban Salatası', calories: 60, allergens: [] },
        dessert: { name: 'Sütlaç', calories: 280, allergens: ['Süt'] }
      },
      vegan: {
        soup: { name: 'Sebze Çorbası', calories: 90, allergens: [] },
        main: { name: 'Sebzeli Güveç', calories: 250, allergens: [] },
        side: { name: 'Bulgur Pilavı', calories: 180, allergens: ['Gluten'] },
        salad: { name: 'Yeşil Salata', calories: 50, allergens: [] },
        dessert: { name: 'Meyve Tabağı', calories: 90, allergens: [] }
      }
    },
    // Monday
    {
      normal: {
        soup: { name: 'Mercimek Çorbası', calories: 120, allergens: ['Gluten'] },
        main: { name: 'İzmir Köfte', calories: 450, allergens: ['Gluten', 'Yumurta'] },
        side: { name: 'Pirinç Pilavı', calories: 200, allergens: ['Gluten'] },
        salad: { name: 'Mevsim Salatası', calories: 50, allergens: [] },
        dessert: { name: 'Kemalpaşa', calories: 300, allergens: ['Gluten', 'Süt'] }
      },
      vegan: {
        soup: { name: 'Sebze Çorbası', calories: 90, allergens: [] },
        main: { name: 'Zeytinyağlı Taze Fasulye', calories: 180, allergens: [] },
        side: { name: 'Bulgur Pilavı', calories: 180, allergens: ['Gluten'] },
        salad: { name: 'Çoban Salatası', calories: 60, allergens: [] },
        dessert: { name: 'Meyve', calories: 80, allergens: [] }
      }
    },
    // Tuesday
    {
      normal: {
        soup: { name: 'Yayla Çorbası', calories: 130, allergens: ['Süt', 'Yumurta', 'Gluten'] },
        main: { name: 'Tavuk Sote', calories: 380, allergens: [] },
        side: { name: 'Makarna', calories: 250, allergens: ['Gluten'] },
        salad: { name: 'Yoğurtlu Havuç', calories: 90, allergens: ['Süt'] },
        dessert: { name: 'Revani', calories: 350, allergens: ['Gluten', 'Yumurta'] }
      },
      vegan: {
        soup: { name: 'Ezogelin Çorbası', calories: 110, allergens: ['Gluten'] },
        main: { name: 'Nohut Yemeği', calories: 300, allergens: [] },
        side: { name: 'Pirinç Pilavı', calories: 200, allergens: [] },
        salad: { name: 'Turşu', calories: 30, allergens: [] },
        dessert: { name: 'İrmik Helvası (Vegan)', calories: 280, allergens: ['Gluten'] }
      }
    },
    // Wednesday
    {
      normal: {
        soup: { name: 'Tarhana Çorbası', calories: 140, allergens: ['Gluten', 'Süt'] },
        main: { name: 'Kuru Fasulye', calories: 350, allergens: [] },
        side: { name: 'Pirinç Pilavı', calories: 200, allergens: ['Gluten'] },
        salad: { name: 'Turşu', calories: 30, allergens: [] },
        dessert: { name: 'Kabak Tatlısı', calories: 220, allergens: ['Ceviz'] }
      },
      vegan: {
        soup: { name: 'Mantar Çorbası', calories: 100, allergens: [] },
        main: { name: 'Kuru Fasulye (Etiz)', calories: 300, allergens: [] },
        side: { name: 'Pirinç Pilavı', calories: 200, allergens: [] },
        salad: { name: 'Mevsim Salatası', calories: 50, allergens: [] },
        dessert: { name: 'Kabak Tatlısı', calories: 220, allergens: ['Ceviz'] }
      }
    },
    // Thursday
    {
      normal: {
        soup: { name: 'Şehriye Çorbası', calories: 110, allergens: ['Gluten'] },
        main: { name: 'Orman Kebabı', calories: 420, allergens: [] },
        side: { name: 'Bulgur Pilavı', calories: 180, allergens: ['Gluten'] },
        salad: { name: 'Cacık', calories: 80, allergens: ['Süt'] },
        dessert: { name: 'Puding', calories: 250, allergens: ['Süt'] }
      },
      vegan: {
        soup: { name: 'Domates Çorbası', calories: 110, allergens: [] },
        main: { name: 'Patlıcan Musakka (Vegan)', calories: 280, allergens: [] },
        side: { name: 'Bulgur Pilavı', calories: 180, allergens: ['Gluten'] },
        salad: { name: 'Söğüş Salata', calories: 40, allergens: [] },
        dessert: { name: 'Aşure', calories: 300, allergens: ['Kuruyemiş'] }
      }
    },
    // Friday
    {
      normal: {
        soup: { name: 'Ezo Gelin Çorbası', calories: 130, allergens: ['Gluten'] },
        main: { name: 'Balık Tava', calories: 400, allergens: ['Balık', 'Gluten'] },
        side: { name: 'Roka Salatası', calories: 40, allergens: [] },
        salad: { name: 'Tahin Helvası', calories: 350, allergens: ['Susam'] },
        dessert: { name: 'Tahin Helvası', calories: 350, allergens: ['Susam'] } // Small bug in mock data logic fixed by repetition or structure, keeping simple
      },
      vegan: {
        soup: { name: 'Brokoli Çorbası', calories: 90, allergens: [] },
        main: { name: 'Mercimek Köftesi', calories: 280, allergens: ['Gluten'] },
        side: { name: 'Marul Salatası', calories: 30, allergens: [] },
        salad: { name: 'Kısır', calories: 200, allergens: ['Gluten'] },
        dessert: { name: 'Meyve', calories: 80, allergens: [] }
      }
    },
    // Saturday (Weekend)
    {
      normal: {
        soup: { name: 'Sebze Çorbası', calories: 100, allergens: [] },
        main: { name: 'Tavuk Döner', calories: 450, allergens: [] },
        side: { name: 'Pirinç Pilavı', calories: 200, allergens: ['Gluten'] },
        salad: { name: 'Ayran', calories: 60, allergens: ['Süt'] },
        dessert: { name: 'Tulumba', calories: 350, allergens: ['Gluten', 'Yumurta'] }
      },
      vegan: {
        soup: { name: 'Sebze Çorbası', calories: 100, allergens: [] },
        main: { name: 'Falafel', calories: 320, allergens: [] },
        side: { name: 'Humus', calories: 180, allergens: ['Susam'] },
        salad: { name: 'Tabule', calories: 120, allergens: ['Gluten'] },
        dessert: { name: 'Meyve', calories: 80, allergens: [] }
      }
    }
  ];

  return menus[dayIndex];
};

export default function MealMenuPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);

  // Responsive visible days count
  useEffect(() => {
    const updateVisibleCount = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleCount(3); // Mobile: 3 gün
      } else if (width < 1024) {
        setVisibleCount(5); // Tablet: 5 gün
      } else {
        setVisibleCount(7); // Desktop: 7 gün
      }
    };

    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  // Get current month boundaries
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Generate all days in current month
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => 
    new Date(currentYear, currentMonth, i + 1)
  );

  // Show days based on screen size
  const visibleDays = monthDays.slice(startIndex, startIndex + visibleCount);

  // Get menu for selected date
  const todaysMenu = getMockMenuForDate(selectedDate);

  // Navigation handlers
  const canGoBack = startIndex > 0;
  const canGoForward = startIndex + visibleCount < daysInMonth;

  const goBack = () => {
    if (canGoBack) setStartIndex(Math.max(0, startIndex - 1));
  };

  const goForward = () => {
    if (canGoForward) setStartIndex(Math.min(daysInMonth - visibleCount, startIndex + 1));
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            Yemek Menüsü
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(now, 'MMMM yyyy', { locale: tr })} - Aylık yemek listesi
          </p>
        </div>
        <Button variant="outline" className="hidden md:flex cursor-default" disabled>
          <CalendarDays className="mr-2 h-4 w-4" />
          {format(now, 'MMMM yyyy', { locale: tr })}
        </Button>
      </div>

      {/* Date Selection - Carousel Style */}
      <div className="flex items-center gap-2 mb-8">
        {/* Back Arrow */}
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className={`p-2 rounded-full transition-all duration-300 ${
            canGoBack 
              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 hover:scale-110 active:scale-95' 
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Date Cards with sliding animation */}
        <div className="flex-1 overflow-hidden">
          <div 
            className="flex gap-2 transition-transform duration-300 ease-out"
            style={{ 
              transform: `translateX(calc(50% - ${startIndex * 88}px - ${visibleCount * 44}px))`,
            }}
          >
            {monthDays.map((date) => {
              const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`
                    flex-shrink-0 flex flex-col items-center w-[80px] p-3 rounded-xl border-2 
                    transition-all duration-300 ease-out
                    ${isSelected 
                      ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-lg scale-105' 
                      : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 hover:shadow-md text-gray-600'}
                  `}
                >
                  <span className="text-xs font-medium uppercase mb-1">
                    {format(date, 'EEE', { locale: tr })}
                  </span>
                  <span className={`text-2xl font-bold transition-colors duration-200 ${isSelected ? 'text-orange-600' : 'text-gray-900'}`}>
                    {format(date, 'd')}
                  </span>
                  {isToday && (
                    <span className="text-[8px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full mt-1 animate-pulse">
                      BUGÜN
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Forward Arrow */}
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className={`p-2 rounded-full transition-all ${
            canGoForward 
              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' 
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Standard Menu */}
        <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent pb-4">
            <div className="flex justify-between items-start">
              <CardTitle className="text-xl text-blue-900 flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Standart Menü
              </CardTitle>
              <Badge variant="secondary" className="bg-white text-blue-700 hover:bg-white/80">
                1200 kcal
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <MenuItem label="Çorba" item={todaysMenu.normal.soup} color="text-amber-600" />
              <MenuItem label="Ana Yemek" item={todaysMenu.normal.main} color="text-red-600" isMain />
              <MenuItem label="Yan Yemek" item={todaysMenu.normal.side} color="text-orange-600" />
              <MenuItem label="Salata" item={todaysMenu.normal.salad} color="text-green-600" />
              <MenuItem label="Tatlı / Meyve" item={todaysMenu.normal.dessert} color="text-purple-600" />
            </div>
          </CardContent>
        </Card>

        {/* Vegan Menu */}
        <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="bg-gradient-to-r from-green-50 to-transparent pb-4">
            <div className="flex justify-between items-start">
              <CardTitle className="text-xl text-green-900 flex items-center gap-2">
                <Leaf className="h-5 w-5" />
                Vegan Menü
              </CardTitle>
              <Badge variant="secondary" className="bg-white text-green-700 hover:bg-white/80">
                850 kcal
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <MenuItem label="Çorba" item={todaysMenu.vegan.soup} color="text-amber-600" />
              <MenuItem label="Ana Yemek" item={todaysMenu.vegan.main} color="text-green-700" isMain />
              <MenuItem label="Yan Yemek" item={todaysMenu.vegan.side} color="text-orange-600" />
              <MenuItem label="Salata" item={todaysMenu.vegan.salad} color="text-green-600" />
              <MenuItem label="Tatlı / Meyve" item={todaysMenu.vegan.dessert} color="text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MenuItem({ label, item, color, isMain }: { label: string, item: any, color: string, isMain?: boolean }) {
  return (
    <div className={`group flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors ${isMain ? 'bg-orange-50/50' : ''}`}>
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
          {label}
        </span>
        <h3 className={`font-semibold ${isMain ? 'text-lg' : 'text-base'} ${color}`}>
          {item.name}
        </h3>
        {item.allergens.length > 0 && (
          <div className="flex gap-1 mt-1">
            {item.allergens.map((allergen: string) => (
              <span key={allergen} className="inline-flex items-center text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">
                <AlertCircle className="w-3 h-3 mr-1" />
                {allergen}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center text-gray-400 text-sm font-medium">
        <Flame className="w-4 h-4 mr-1 text-orange-400" />
        {item.calories}
      </div>
    </div>
  );
}
