'use client';

import { useState, useRef, useEffect } from 'react';
import ky from 'ky';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cafeteria } from '@/lib/types';
import {
  Save,
  Printer,
  Download,
} from 'lucide-react';

// Autocomplete Combobox Component
interface MealAutocompleteProps {
  value: string;
  onChange: (value: string, calories: number) => void;
  placeholder: string;
  categoryFilter?: 'soup' | 'main' | 'side' | 'dessert' | 'other';
}

function MealAutocomplete({ value, onChange, placeholder, categoryFilter }: MealAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtreleme - kategori ve arama terimine göre
  const filteredMeals = mealDatabase.filter(meal => {
    const matchesSearch = meal.name.includes(searchTerm.toUpperCase());
    const matchesCategory = !categoryFilter || meal.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).slice(0, 8); // Max 8 sonuç göster

  const handleSelect = (meal: MealItem) => {
    setSearchTerm(meal.name);
    onChange(meal.name, meal.calories);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setSearchTerm(newValue);
    setIsOpen(true);
    // Manuel giriş durumunda kalori 0 olur (listeden seçilmezse)
    onChange(newValue, getMealCalories(newValue));
  };

  const handleClear = () => {
    setSearchTerm('');
    onChange('', 0);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center">
        <Input
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="h-8 text-xs text-center uppercase border-0 bg-transparent focus:bg-white dark:focus:bg-gray-800 pr-6"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-1 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            type="button"
          >
            <span className="text-xs">✕</span>
          </button>
        )}
      </div>
      {isOpen && filteredMeals.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredMeals.map((meal, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(meal)}
              className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
            >
              <span className="uppercase">{meal.name}</span>
              <span className="text-gray-400 text-[10px]">{meal.calories} kcal</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Vegan Autocomplete Combobox Component
function VeganMealAutocomplete({ value, onChange, placeholder, categoryFilter }: MealAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Vegan veritabanından filtreleme
  const filteredMeals = veganMealDatabase.filter(meal => {
    const matchesSearch = meal.name.includes(searchTerm.toUpperCase());
    const matchesCategory = !categoryFilter || meal.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).slice(0, 8);

  const handleSelect = (meal: MealItem) => {
    setSearchTerm(meal.name);
    onChange(meal.name, meal.calories);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setSearchTerm(newValue);
    setIsOpen(true);
    onChange(newValue, getVeganMealCalories(newValue));
  };

  const handleClear = () => {
    setSearchTerm('');
    onChange('', 0);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center">
        <Input
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="h-8 text-xs text-center uppercase border-0 bg-transparent focus:bg-white dark:focus:bg-gray-800 pr-6"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-1 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            type="button"
          >
            <span className="text-xs">✕</span>
          </button>
        )}
      </div>
      {isOpen && filteredMeals.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredMeals.map((meal, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(meal)}
              className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
            >
              <span className="uppercase">{meal.name}</span>
              <span className="text-gray-400 text-[10px]">{meal.calories} kcal</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Kategori index'inden kategori tipine dönüşüm
const getCategoryByIndex = (index: number): 'soup' | 'main' | 'side' | 'dessert' | 'other' => {
  const categories: ('soup' | 'main' | 'side' | 'dessert' | 'other')[] = ['soup', 'main', 'side', 'dessert', 'other'];
  return categories[index];
};

// Mock cafeterias
const mockCafeterias: Cafeteria[] = [
  { id: '1', name: 'Merkez Yemekhane', location: 'Ana Kampüs', has_vegan_menu: true, serves_dinner: true, is_active: true, created_at: '', updated_at: '' },
  { id: '2', name: 'Mühendislik Yemekhanesi', location: 'Mühendislik Fakültesi', has_vegan_menu: true, serves_dinner: false, is_active: true, created_at: '', updated_at: '' },
  { id: '3', name: 'Tınaztepe Yemekhanesi', location: 'Tınaztepe Kampüsü', has_vegan_menu: true, serves_dinner: true, is_active: true, created_at: '', updated_at: '' },
];

// Sabit 5 yemek kategorisi
const mealCategories = ['Çorba', 'Ana Yemek', 'Yan Yemek', 'Tatlı', 'Diğer'];

// Yemek veritabanı - Türk yemekhanelerinde yaygın yemekler ve kalorileri
interface MealItem {
  name: string;
  calories: number;
  category: 'soup' | 'main' | 'side' | 'dessert' | 'other';
}

const mealDatabase: MealItem[] = [
  // ÇORBALAR (soup) - ortalama 80-150 kcal
  { name: 'MERCİMEK ÇORBASI', calories: 120, category: 'soup' },
  { name: 'YEŞİL MERCİMEK ÇORBASI', calories: 125, category: 'soup' },
  { name: 'KIRMIZI MERCİMEK ÇORBASI', calories: 118, category: 'soup' },
  { name: 'EZOGELİN ÇORBASI', calories: 130, category: 'soup' },
  { name: 'DOMATES ÇORBASI', calories: 85, category: 'soup' },
  { name: 'TARHANA ÇORBASI', calories: 110, category: 'soup' },
  { name: 'YAYLA ÇORBASI', calories: 95, category: 'soup' },
  { name: 'TUTMAÇ ÇORBASI', calories: 140, category: 'soup' },
  { name: 'DÜĞÜN ÇORBASI', calories: 150, category: 'soup' },
  { name: 'ŞEHRİYE ÇORBASI', calories: 90, category: 'soup' },
  { name: 'PİRİNÇ ÇORBASI', calories: 100, category: 'soup' },
  { name: 'SEBZE ÇORBASI', calories: 75, category: 'soup' },
  { name: 'TAVUK SUYU ÇORBASI', calories: 80, category: 'soup' },
  { name: 'İŞKEMBE ÇORBASI', calories: 160, category: 'soup' },
  { name: 'PAÇA ÇORBASI', calories: 170, category: 'soup' },
  { name: 'KREMALI MANTAR ÇORBASI', calories: 145, category: 'soup' },
  { name: 'KREMALI BROKOLI ÇORBASI', calories: 130, category: 'soup' },
  { name: 'BALKABAĞI ÇORBASI', calories: 95, category: 'soup' },
  { name: 'PATATES ÇORBASI', calories: 115, category: 'soup' },
  { name: 'UN ÇORBASI', calories: 105, category: 'soup' },

  // ANA YEMEKLER (main) - ortalama 250-450 kcal
  { name: 'KURU FASULYE', calories: 280, category: 'main' },
  { name: 'NOHUT YEMEĞİ', calories: 260, category: 'main' },
  { name: 'ETLİ NOHUT', calories: 320, category: 'main' },
  { name: 'ETLİ KURU FASULYE', calories: 340, category: 'main' },
  { name: 'BARBUNYA PİLAKİ', calories: 245, category: 'main' },
  { name: 'KARNIYARIK', calories: 380, category: 'main' },
  { name: 'İMAM BAYILDI', calories: 290, category: 'main' },
  { name: 'MUSAKKA', calories: 350, category: 'main' },
  { name: 'TÜRLÜ', calories: 220, category: 'main' },
  { name: 'GÜVEÇ', calories: 310, category: 'main' },
  { name: 'ETLİ GÜVEÇ', calories: 380, category: 'main' },
  { name: 'TAVUK GÜVEÇ', calories: 340, category: 'main' },
  { name: 'TAVUK SOTE', calories: 320, category: 'main' },
  { name: 'ET SOTE', calories: 380, category: 'main' },
  { name: 'MANTARLI ET SOTE', calories: 395, category: 'main' },
  { name: 'ANKARA TAVASI', calories: 420, category: 'main' },
  { name: 'İZMİR KÖFTE', calories: 400, category: 'main' },
  { name: 'KÖFTE', calories: 350, category: 'main' },
  { name: 'KADINBUDU KÖFTE', calories: 380, category: 'main' },
  { name: 'PATATES OTURTMA', calories: 320, category: 'main' },
  { name: 'BEĞENDI', calories: 340, category: 'main' },
  { name: 'HÜNKARBEĞENDİ', calories: 420, category: 'main' },
  { name: 'ALİ NAZİK', calories: 400, category: 'main' },
  { name: 'TAVUKLU PİLAV', calories: 380, category: 'main' },
  { name: 'PİLİÇ FIRINDA', calories: 360, category: 'main' },
  { name: 'TAVUK ŞNİTZEL', calories: 420, category: 'main' },
  { name: 'ET ŞNİTZEL', calories: 450, category: 'main' },
  { name: 'BALIK TAVA', calories: 380, category: 'main' },
  { name: 'BALIK IZGARA', calories: 320, category: 'main' },
  { name: 'HAMSI TAVA', calories: 340, category: 'main' },
  { name: 'PALAMUT TAVA', calories: 360, category: 'main' },
  { name: 'SULU KÖFTE', calories: 290, category: 'main' },
  { name: 'ANA YEMEK', calories: 350, category: 'main' },
  { name: 'MANTARLI TAVUK', calories: 340, category: 'main' },
  { name: 'SEBZELI TAVUK', calories: 310, category: 'main' },
  { name: 'BAMYA YEMEĞİ', calories: 180, category: 'main' },
  { name: 'ETLİ BAMYA', calories: 280, category: 'main' },
  { name: 'PATLICAN KEBABI', calories: 390, category: 'main' },
  { name: 'ADANA KEBAP', calories: 420, category: 'main' },
  { name: 'URFA KEBAP', calories: 400, category: 'main' },
  { name: 'ÇOP ŞİŞ', calories: 380, category: 'main' },
  { name: 'TAVUK ŞİŞ', calories: 320, category: 'main' },
  { name: 'DÖNER', calories: 400, category: 'main' },
  { name: 'TAVUK DÖNER', calories: 350, category: 'main' },

  // YAN YEMEKLER / PİLAVLAR / MAKARNALAR (side) - ortalama 150-280 kcal
  { name: 'PİRİNÇ PİLAVI', calories: 200, category: 'side' },
  { name: 'BULGUR PİLAVI', calories: 180, category: 'side' },
  { name: 'ŞEHRİYELİ PİRİNÇ PİLAVI', calories: 220, category: 'side' },
  { name: 'NOHUTlu PİLAV', calories: 240, category: 'side' },
  { name: 'İÇ PİLAV', calories: 260, category: 'side' },
  { name: 'MAKARNA', calories: 220, category: 'side' },
  { name: 'SOSLU MAKARNA', calories: 280, category: 'side' },
  { name: 'DOMATES SOSLU MAKARNA', calories: 260, category: 'side' },
  { name: 'KIYMALIMAKARNA', calories: 340, category: 'side' },
  { name: 'FIRIN MAKARNA', calories: 320, category: 'side' },
  { name: 'ERİŞTE', calories: 230, category: 'side' },
  { name: 'YOĞURTLU ERİŞTE', calories: 280, category: 'side' },
  { name: 'MANTI', calories: 350, category: 'side' },
  { name: 'ISPANAK', calories: 80, category: 'side' },
  { name: 'PİRİNÇLİ ISPANAK', calories: 140, category: 'side' },
  { name: 'YEŞİL FASULYE', calories: 90, category: 'side' },
  { name: 'ZEYTİNYAĞLI YEŞİL FASULYE', calories: 120, category: 'side' },
  { name: 'BEZELYE', calories: 100, category: 'side' },
  { name: 'ETLİ BEZELYE', calories: 200, category: 'side' },
  { name: 'HAVUÇLU BEZELYE', calories: 130, category: 'side' },
  { name: 'PATATES PÜRESİ', calories: 180, category: 'side' },
  { name: 'PATATES KIZARTMASI', calories: 280, category: 'side' },
  { name: 'FIRINDA PATATES', calories: 200, category: 'side' },
  { name: 'KABAK MÜCVER', calories: 220, category: 'side' },
  { name: 'KIZARTMA', calories: 250, category: 'side' },
  { name: 'SALÇALI PATATES', calories: 190, category: 'side' },
  { name: 'ZEYTINYAĞLI PATLICAN', calories: 150, category: 'side' },
  { name: 'ZEYTINYAĞLI BİBER DOLMASI', calories: 170, category: 'side' },
  { name: 'ZEYTİNYAĞLI YAPRAK SARMASI', calories: 180, category: 'side' },
  { name: 'ETLİ YAPRAK SARMASI', calories: 280, category: 'side' },
  { name: 'LAHANA SARMASI', calories: 250, category: 'side' },

  // TATLILAR (dessert) - ortalama 150-350 kcal
  { name: 'TATLI', calories: 200, category: 'dessert' },
  { name: 'SÜTLAÇ', calories: 180, category: 'dessert' },
  { name: 'KAZANDIBI', calories: 220, category: 'dessert' },
  { name: 'TAVUK GÖĞSÜ', calories: 210, category: 'dessert' },
  { name: 'MUHALLEBI', calories: 170, category: 'dessert' },
  { name: 'PUDING', calories: 190, category: 'dessert' },
  { name: 'ÇİKOLATALI PUDING', calories: 220, category: 'dessert' },
  { name: 'KESMEBİR', calories: 200, category: 'dessert' },
  { name: 'BAKLAVA', calories: 350, category: 'dessert' },
  { name: 'KADAYIF', calories: 320, category: 'dessert' },
  { name: 'KÜNEFE', calories: 380, category: 'dessert' },
  { name: 'REVANI', calories: 280, category: 'dessert' },
  { name: 'ŞAMBALI', calories: 290, category: 'dessert' },
  { name: 'TULUMBA TATLISI', calories: 300, category: 'dessert' },
  { name: 'LOKMA TATLISI', calories: 280, category: 'dessert' },
  { name: 'KEMALPAŞA TATLISI', calories: 260, category: 'dessert' },
  { name: 'UN HELVASI', calories: 320, category: 'dessert' },
  { name: 'İRMİK HELVASI', calories: 300, category: 'dessert' },
  { name: 'AŞURE', calories: 250, category: 'dessert' },
  { name: 'GÜLLAÇ', calories: 200, category: 'dessert' },
  { name: 'KOMPOSTO', calories: 80, category: 'dessert' },
  { name: 'MEYVE', calories: 60, category: 'dessert' },
  { name: 'MEVSIM MEYVE', calories: 65, category: 'dessert' },
  { name: 'KARPUZ', calories: 45, category: 'dessert' },
  { name: 'KAVUN', calories: 50, category: 'dessert' },
  { name: 'PORTAKAL', calories: 55, category: 'dessert' },
  { name: 'ELMA', calories: 60, category: 'dessert' },
  { name: 'MUZ', calories: 90, category: 'dessert' },
  { name: 'DONDURMA', calories: 180, category: 'dessert' },
  { name: 'PASTA', calories: 350, category: 'dessert' },
  { name: 'KEK', calories: 280, category: 'dessert' },

  // DİĞER - Salatalar, içecekler, ek malzemeler (other) - ortalama 30-150 kcal
  { name: 'CACIK', calories: 80, category: 'other' },
  { name: 'YOĞURT', calories: 90, category: 'other' },
  { name: 'AYRAN', calories: 60, category: 'other' },
  { name: 'ÇOBAN SALATA', calories: 70, category: 'other' },
  { name: 'MEVSİM SALATA', calories: 50, category: 'other' },
  { name: 'KARIŞIK SALATA', calories: 60, category: 'other' },
  { name: 'AKDENIZ SALATASI', calories: 90, category: 'other' },
  { name: 'ROKA SALATA', calories: 45, category: 'other' },
  { name: 'HAVUÇ SALATA', calories: 55, category: 'other' },
  { name: 'LAHANA SALATA', calories: 40, category: 'other' },
  { name: 'TURŞU', calories: 25, category: 'other' },
  { name: 'ZEYTİN', calories: 50, category: 'other' },
  { name: 'BEYAZ PEYNİR', calories: 100, category: 'other' },
  { name: 'KAŞAR PEYNİR', calories: 120, category: 'other' },
  { name: 'HAYDARİ', calories: 110, category: 'other' },
  { name: 'ATOM', calories: 90, category: 'other' },
  { name: 'ACILI EZME', calories: 70, category: 'other' },
  { name: 'HUMUS', calories: 130, category: 'other' },
  { name: 'FAVA', calories: 120, category: 'other' },
  { name: 'PATLICAN SALATASI', calories: 100, category: 'other' },
  { name: 'KÖZLENMIŞ BİBER', calories: 40, category: 'other' },
  { name: 'SÖGÜŞ', calories: 30, category: 'other' },
  { name: 'EKMEK', calories: 136, category: 'other' },
];

// Vegan yemek veritabanı
const veganMealDatabase: MealItem[] = [
  // VEGAN ÇORBALAR
  { name: 'MERCİMEK ÇORBASI', calories: 120, category: 'soup' },
  { name: 'SEBZE ÇORBASI', calories: 75, category: 'soup' },
  { name: 'DOMATES ÇORBASI', calories: 85, category: 'soup' },
  { name: 'EZOGELİN ÇORBASI', calories: 130, category: 'soup' },
  { name: 'TARHANA ÇORBASI (VEGAN)', calories: 100, category: 'soup' },
  { name: 'BALKABAGI ÇORBASI', calories: 95, category: 'soup' },
  { name: 'BROKOLI ÇORBASI', calories: 80, category: 'soup' },
  { name: 'ISPANAK ÇORBASI', calories: 70, category: 'soup' },
  { name: 'KARNABAHAR ÇORBASI', calories: 65, category: 'soup' },
  { name: 'PATATES ÇORBASI', calories: 115, category: 'soup' },
  { name: 'HAVUÇ ÇORBASI', calories: 60, category: 'soup' },
  { name: 'MANTAR ÇORBASI (VEGAN)', calories: 90, category: 'soup' },
  // VEGAN ANA YEMEKLER
  { name: 'NOHUT YEMEĞİ', calories: 260, category: 'main' },
  { name: 'KURU FASULYE', calories: 280, category: 'main' },
  { name: 'BARBUNYA PİLAKİ', calories: 245, category: 'main' },
  { name: 'MERCİMEK KÖFTE', calories: 180, category: 'main' },
  { name: 'ZEYTİNYAĞLI FASULYE', calories: 150, category: 'main' },
  { name: 'ZEYTİNYAĞLI ENGINAR', calories: 140, category: 'main' },
  { name: 'ZEYTİNYAĞLI BAKLA', calories: 160, category: 'main' },
  { name: 'ZEYTİNYAĞLI PAZI', calories: 100, category: 'main' },
  { name: 'İMAM BAYILDI', calories: 290, category: 'main' },
  { name: 'TÜRLÜ', calories: 220, category: 'main' },
  { name: 'SEBZE GÜVEÇ', calories: 180, category: 'main' },
  { name: 'PATLICAN MUSAKKA (VEGAN)', calories: 200, category: 'main' },
  { name: 'KABAK DOLMASI', calories: 170, category: 'main' },
  { name: 'BİBER DOLMASI', calories: 180, category: 'main' },
  { name: 'YAPRAK SARMASI', calories: 190, category: 'main' },
  { name: 'MANTARLI SEBZE SOTE', calories: 150, category: 'main' },
  { name: 'SEBZELI NOHUT', calories: 240, category: 'main' },
  { name: 'VEGAN KÖFTE', calories: 200, category: 'main' },
  // VEGAN YAN YEMEKLER
  { name: 'PİRİNÇ PİLAVI', calories: 200, category: 'side' },
  { name: 'BULGUR PİLAVI', calories: 180, category: 'side' },
  { name: 'SOSLU MAKARNA', calories: 240, category: 'side' },
  { name: 'ISPANAK', calories: 80, category: 'side' },
  { name: 'ZEYTİNYAĞLI YEŞİL FASULYE', calories: 120, category: 'side' },
  { name: 'HAVUÇLU BEZELYE', calories: 130, category: 'side' },
  { name: 'PATATES PÜRESİ (VEGAN)', calories: 160, category: 'side' },
  { name: 'FIRINDA PATATES', calories: 200, category: 'side' },
  { name: 'KABAK MÜCVER (VEGAN)', calories: 180, category: 'side' },
  { name: 'ZEYTİNYAĞLI PATLICAN', calories: 150, category: 'side' },
  { name: 'KINOA SALATASI', calories: 170, category: 'side' },
  // VEGAN TATLILAR
  { name: 'MEYVE', calories: 60, category: 'dessert' },
  { name: 'MEVSİM MEYVE', calories: 65, category: 'dessert' },
  { name: 'KOMPOSTO', calories: 80, category: 'dessert' },
  { name: 'AŞURE', calories: 250, category: 'dessert' },
  { name: 'KABAK TATLISI', calories: 180, category: 'dessert' },
  { name: 'AYVA TATLISI', calories: 160, category: 'dessert' },
  { name: 'İNCİR TATLISI', calories: 170, category: 'dessert' },
  { name: 'HURMA', calories: 100, category: 'dessert' },
  { name: 'CEVİZLİ İNCİR', calories: 150, category: 'dessert' },
  { name: 'MEYVE SALATASI', calories: 90, category: 'dessert' },
  // VEGAN DİĞER
  { name: 'ÇOBAN SALATA', calories: 70, category: 'other' },
  { name: 'MEVSİM SALATA', calories: 50, category: 'other' },
  { name: 'AKDENIZ SALATASI', calories: 90, category: 'other' },
  { name: 'ROKA SALATA', calories: 45, category: 'other' },
  { name: 'HUMUS', calories: 130, category: 'other' },
  { name: 'FAVA', calories: 120, category: 'other' },
  { name: 'TURŞU', calories: 25, category: 'other' },
  { name: 'ZEYTİN', calories: 50, category: 'other' },
  { name: 'ACILI EZME', calories: 70, category: 'other' },
  { name: 'PATLICAN SALATASI', calories: 100, category: 'other' },
  { name: 'EKMEK', calories: 136, category: 'other' },
];

// Yemek adından kalori bul
const getMealCalories = (mealName: string): number => {
  const meal = mealDatabase.find(m => m.name === mealName.toUpperCase());
  return meal?.calories || 0;
};

// Vegan yemek adından kalori bul
const getVeganMealCalories = (mealName: string): number => {
  const meal = veganMealDatabase.find(m => m.name === mealName.toUpperCase());
  return meal?.calories || 0;
};

interface DayMenu {
  items: [string, string, string, string, string]; // 5 sabit alan
  calories: number;
}

interface WeeklyMenu {
  [key: string]: DayMenu;
}

const dayNames = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Salı' },
  { key: 'wednesday', label: 'Çarşamba' },
  { key: 'thursday', label: 'Perşembe' },
  { key: 'friday', label: 'Cuma' },
];

const getEmptyWeeklyMenu = (): WeeklyMenu => ({
  monday: { items: ['', '', '', '', ''], calories: 0 },
  tuesday: { items: ['', '', '', '', ''], calories: 0 },
  wednesday: { items: ['', '', '', '', ''], calories: 0 },
  thursday: { items: ['', '', '', '', ''], calories: 0 },
  friday: { items: ['', '', '', '', ''], calories: 0 },
});

// Kalori hesaplama helper - örnek veri için
const calcCalories = (items: string[]): number => {
  return items.reduce((total, item) => total + getMealCalories(item), 0);
};

const calcVeganCalories = (items: string[]): number => {
  return items.reduce((total, item) => total + getVeganMealCalories(item), 0);
};

// Örnek veri - DEU formatında (kaloriler otomatik hesaplanır)
const sampleMenuItems = {
  monday: ['YEŞİL MERCİMEK ÇORBASI', 'KURU FASULYE', 'PİRİNÇ PİLAVI', 'SÜTLAÇ', 'TURŞU'] as [string, string, string, string, string],
  tuesday: ['DOMATES ÇORBASI', 'PATATES OTURTMA', 'MAKARNA', 'MEYVE', 'HAYDARİ'] as [string, string, string, string, string],
  wednesday: ['TUTMAÇ ÇORBASI', 'ANKARA TAVASI', 'PİRİNÇLİ ISPANAK', 'REVANI', 'YOĞURT'] as [string, string, string, string, string],
  thursday: ['', '', '', '', ''] as [string, string, string, string, string],
  friday: ['EZOGELİN ÇORBASI', 'MANTARLI ET SOTE', 'BULGUR PİLAVI', 'KOMPOSTO', 'ÇOBAN SALATA'] as [string, string, string, string, string],
};

const sampleWeeklyMenu: WeeklyMenu = {
  monday: { items: sampleMenuItems.monday, calories: calcCalories(sampleMenuItems.monday) },
  tuesday: { items: sampleMenuItems.tuesday, calories: calcCalories(sampleMenuItems.tuesday) },
  wednesday: { items: sampleMenuItems.wednesday, calories: calcCalories(sampleMenuItems.wednesday) },
  thursday: { items: sampleMenuItems.thursday, calories: calcCalories(sampleMenuItems.thursday) },
  friday: { items: sampleMenuItems.friday, calories: calcCalories(sampleMenuItems.friday) },
};

// Vegan örnek menü
const sampleVeganMenuItems = {
  monday: ['MERCİMEK ÇORBASI', 'NOHUT YEMEĞİ', 'BULGUR PİLAVI', 'MEYVE', 'HUMUS'] as [string, string, string, string, string],
  tuesday: ['SEBZE ÇORBASI', 'ZEYTİNYAĞLI FASULYE', 'PİRİNÇ PİLAVI', 'KOMPOSTO', 'ÇOBAN SALATA'] as [string, string, string, string, string],
  wednesday: ['DOMATES ÇORBASI', 'İMAM BAYILDI', 'SOSLU MAKARNA', 'KABAK TATLISI', 'TURŞU'] as [string, string, string, string, string],
  thursday: ['', '', '', '', ''] as [string, string, string, string, string],
  friday: ['EZOGELİN ÇORBASI', 'SEBZE GÜVEÇ', 'ZEYTİNYAĞLI YEŞİL FASULYE', 'MEVSİM MEYVE', 'FAVA'] as [string, string, string, string, string],
};

const sampleVeganWeeklyMenu: WeeklyMenu = {
  monday: { items: sampleVeganMenuItems.monday, calories: calcVeganCalories(sampleVeganMenuItems.monday) },
  tuesday: { items: sampleVeganMenuItems.tuesday, calories: calcVeganCalories(sampleVeganMenuItems.tuesday) },
  wednesday: { items: sampleVeganMenuItems.wednesday, calories: calcVeganCalories(sampleVeganMenuItems.wednesday) },
  thursday: { items: sampleVeganMenuItems.thursday, calories: calcVeganCalories(sampleVeganMenuItems.thursday) },
  friday: { items: sampleVeganMenuItems.friday, calories: calcVeganCalories(sampleVeganMenuItems.friday) },
};

export default function MenusPage() {
  const [activeTab, setActiveTab] = useState<string>('normal');
  const [selectedCafeteria, setSelectedCafeteria] = useState<string>('1');
  const [selectedMonth, setSelectedMonth] = useState<string>('01');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([
    sampleWeeklyMenu,
    getEmptyWeeklyMenu(),
    getEmptyWeeklyMenu(),
    getEmptyWeeklyMenu(),
    getEmptyWeeklyMenu(),
  ]);
  const [veganWeeklyMenus, setVeganWeeklyMenus] = useState<WeeklyMenu[]>([
    sampleVeganWeeklyMenu,
    getEmptyWeeklyMenu(),
    getEmptyWeeklyMenu(),
    getEmptyWeeklyMenu(),
    getEmptyWeeklyMenu(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ay ve yıl seçenekleri
  const months = [
    { value: '01', label: 'Ocak' },
    { value: '02', label: 'Şubat' },
    { value: '03', label: 'Mart' },
    { value: '04', label: 'Nisan' },
    { value: '05', label: 'Mayıs' },
    { value: '06', label: 'Haziran' },
    { value: '07', label: 'Temmuz' },
    { value: '08', label: 'Ağustos' },
    { value: '09', label: 'Eylül' },
    { value: '10', label: 'Ekim' },
    { value: '11', label: 'Kasım' },
    { value: '12', label: 'Aralık' },
  ];

  const years = ['2025', '2026', '2027'];

  // Haftanın tarihlerini hesapla
  const getWeekDates = (weekIndex: number) => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth) - 1;
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay();
    const startOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const weekStart = new Date(year, month, 1 + startOffset + (weekIndex * 7));

    return dayNames.map((_, idx) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + idx);
      return `${date.getDate()} ${months[date.getMonth()]?.label || ''} ${date.getFullYear()}`;
    });
  };

  // Günün toplam kalorisini hesapla
  const calculateDayCalories = (items: string[], isVegan = false): number => {
    return items.reduce((total, item) => {
      if (!item) return total;
      return total + (isVegan ? getVeganMealCalories(item) : getMealCalories(item));
    }, 0);
  };

  // Menü öğesi güncelle ve kaloriyi otomatik hesapla
  const updateMenuItem = (weekIndex: number, day: string, itemIndex: number, value: string) => {
    setWeeklyMenus(prev => {
      const updated = [...prev];
      const newItems = [...updated[weekIndex][day].items] as [string, string, string, string, string];
      newItems[itemIndex] = value.toUpperCase();

      // Otomatik kalori hesapla
      const totalCalories = calculateDayCalories(newItems);

      updated[weekIndex] = {
        ...updated[weekIndex],
        [day]: {
          ...updated[weekIndex][day],
          items: newItems,
          calories: totalCalories,
        },
      };
      return updated;
    });
  };

  // Vegan menü öğesi güncelle
  const updateVeganMenuItem = (weekIndex: number, day: string, itemIndex: number, value: string) => {
    setVeganWeeklyMenus(prev => {
      const updated = [...prev];
      const newItems = [...updated[weekIndex][day].items] as [string, string, string, string, string];
      newItems[itemIndex] = value.toUpperCase();

      // Otomatik kalori hesapla
      const totalCalories = calculateDayCalories(newItems, true);

      updated[weekIndex] = {
        ...updated[weekIndex],
        [day]: {
          ...updated[weekIndex][day],
          items: newItems,
          calories: totalCalories,
        },
      };
      return updated;
    });
  };

  // Kaydet
  const handleSave = async () => {
    setIsSubmitting(true);
    
    const payload = {
      cafeteria_id: selectedCafeteria,
      month: selectedMonth,
      year: selectedYear,
      normalMenus: weeklyMenus,
      veganMenus: veganWeeklyMenus,
    };

    try {
      // Mock API URL'ye POST isteği
      await ky.post('https://jsonplaceholder.typicode.com/posts', {
        json: payload,
      }).json();
      
      console.log('Menü başarıyla gönderildi:', payload);
      alert('Menü başarıyla kaydedildi!');
    } catch (error) {
      console.error('Menü kaydedilirken hata oluştu:', error);
      alert('Menü kaydedilirken bir hata oluştu!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMonthLabel = months.find(m => m.value === selectedMonth)?.label || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Aylık Menü Oluştur</h1>
          <p className="text-muted-foreground">Haftalık yemek listesini düzenleyin</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Yazdır
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            PDF İndir
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      {/* Filtreler */}
      <Card className="dark:bg-gray-900 dark:border-gray-800">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Yemekhane</Label>
              <Select value={selectedCafeteria} onValueChange={setSelectedCafeteria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mockCafeterias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ay</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Yıl</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Normal and Vegan Menu */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="normal" className="text-base">
            🍖 Normal Menü
          </TabsTrigger>
          <TabsTrigger value="vegan" className="text-base">
            🥗 Vegan Menü
          </TabsTrigger>
        </TabsList>

        {/* Normal Menü Tab */}
        <TabsContent value="normal">
          <Card className="dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            <CardHeader className="bg-blue-900 text-white text-center py-4">
              <div className="flex items-center justify-center gap-4">
                <img src="/deu-logo.png" alt="DEU" className="h-12 w-12 hidden" />
                <div>
                  <h2 className="text-lg font-bold">DOKUZ EYLÜL ÜNİVERSİTESİ</h2>
                  <h3 className="text-sm">SAĞLIK KÜLTÜR VE SPOR DAİRE BAŞKANLIĞI</h3>
                  <h4 className="text-base font-semibold mt-1">
                    {selectedYear} {selectedMonthLabel.toUpperCase()} AYI - YEMEK LİSTESİ
                  </h4>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {weeklyMenus.map((weekMenu, weekIndex) => {
                const weekDates = getWeekDates(weekIndex);
                return (
                  <div key={weekIndex} className="border-b dark:border-gray-700 last:border-b-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-yellow-100 dark:bg-yellow-900/30">
                            {dayNames.map((day, idx) => (
                              <th
                                key={day.key}
                                className="border border-gray-300 dark:border-gray-600 p-2 text-center text-sm font-semibold text-blue-900 dark:text-blue-300 min-w-[180px]"
                              >
                                <div>{weekDates[idx]}</div>
                                <div className="text-xs font-normal text-gray-600 dark:text-gray-400">
                                  {day.label}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mealCategories.map((category, rowIdx) => (
                            <tr key={rowIdx}>
                              {dayNames.map(day => (
                                <td
                                  key={day.key}
                                  className="border border-gray-300 dark:border-gray-600 p-1"
                                >
                                  <MealAutocomplete
                                    value={weekMenu[day.key]?.items[rowIdx] || ''}
                                    onChange={(value) => updateMenuItem(weekIndex, day.key, rowIdx, value)}
                                    placeholder={category}
                                    categoryFilter={getCategoryByIndex(rowIdx)}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            {dayNames.map(day => (
                              <td
                                key={day.key}
                                className="border border-gray-300 dark:border-gray-600 p-2 text-center"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                    {weekMenu[day.key]?.calories || 0}
                                  </span>
                                  <span className="text-xs text-gray-500">kcal</span>
                                </div>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vegan Menü Tab */}
        <TabsContent value="vegan">
          <Card className="dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            <CardHeader className="bg-green-800 text-white text-center py-4">
              <div className="flex items-center justify-center gap-4">
                <img src="/deu-logo.png" alt="DEU" className="h-12 w-12 hidden" />
                <div>
                  <h2 className="text-lg font-bold">DOKUZ EYLÜL ÜNİVERSİTESİ</h2>
                  <h3 className="text-sm">SAĞLIK KÜLTÜR VE SPOR DAİRE BAŞKANLIĞI</h3>
                  <h4 className="text-base font-semibold mt-1">
                    {selectedYear} {selectedMonthLabel.toUpperCase()} AYI - VEGAN MENÜ
                  </h4>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {veganWeeklyMenus.map((weekMenu, weekIndex) => {
                const weekDates = getWeekDates(weekIndex);
                return (
                  <div key={weekIndex} className="border-b dark:border-gray-700 last:border-b-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-green-100 dark:bg-green-900/30">
                            {dayNames.map((day, idx) => (
                              <th
                                key={day.key}
                                className="border border-gray-300 dark:border-gray-600 p-2 text-center text-sm font-semibold text-green-900 dark:text-green-300 min-w-[180px]"
                              >
                                <div>{weekDates[idx]}</div>
                                <div className="text-xs font-normal text-gray-600 dark:text-gray-400">
                                  {day.label}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mealCategories.map((category, rowIdx) => (
                            <tr key={rowIdx}>
                              {dayNames.map(day => (
                                <td
                                  key={day.key}
                                  className="border border-gray-300 dark:border-gray-600 p-1"
                                >
                                  <VeganMealAutocomplete
                                    value={weekMenu[day.key]?.items[rowIdx] || ''}
                                    onChange={(value) => updateVeganMenuItem(weekIndex, day.key, rowIdx, value)}
                                    placeholder={category}
                                    categoryFilter={getCategoryByIndex(rowIdx)}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            {dayNames.map(day => (
                              <td
                                key={day.key}
                                className="border border-gray-300 dark:border-gray-600 p-2 text-center"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                    {weekMenu[day.key]?.calories || 0}
                                  </span>
                                  <span className="text-xs text-gray-500">kcal</span>
                                </div>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notlar */}
      <Card className="dark:bg-gray-900 dark:border-gray-800">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            *Mücbir sebepler haricinde kesinlikle menü değişimi yapılmayacaktır.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            *Yukarıda belirtilen 1 öğünlük toplam kalori değerlerine, 50 gr ekmeğin değeri olan 136 kalori ilave edilmiştir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
