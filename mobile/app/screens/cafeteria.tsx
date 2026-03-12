import { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text as RNText, View as RNView } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  useCafeterias,
  useMonthlyMenu,
  useMyReservations,
  useCreateBatchReservation,
} from '@/hooks/useMeals';
import type { Cafeteria, Reservation, CreateReservationRequest } from '@/types/meal.types';

// ─── Types ───────────────────────────────────────────────────

type MealType = 'none' | 'normal' | 'vegan';
type Tab = 'select' | 'menu' | 'history';

// ─── Constants ───────────────────────────────────────────────

const MEAL_PRICE = 25;

const weekDays = [
  { key: 'monday', label: 'Pazartesi', short: 'Pzt', dow: 1 },
  { key: 'tuesday', label: 'Sali', short: 'Sal', dow: 2 },
  { key: 'wednesday', label: 'Carsamba', short: 'Car', dow: 3 },
  { key: 'thursday', label: 'Persembe', short: 'Per', dow: 4 },
  { key: 'friday', label: 'Cuma', short: 'Cum', dow: 5 },
];

const monthNames = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const fullDayNames = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'];
const shortDayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
const menuCategories = ['Corba', 'Ana Yemek', 'Yan Yemek', 'Tatli', 'Diger'];
const categoryColors: Record<string, string> = {
  Corba: '#f59e0b', 'Ana Yemek': '#ef4444', 'Yan Yemek': '#f97316', Tatli: '#8b5cf6', Diger: '#9ca3af',
};

// ─── Helpers ─────────────────────────────────────────────────

function getWeekDates() {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return weekDays.map((d, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return { ...d, date: dt, day: dt.getDate(), month: dt.getMonth(), fullDate: formatDate(dt) };
  });
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTR(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function getMonthDays(year: number, month: number) {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
}

function getWeekOfMonth(date: Date): number {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  return Math.floor((date.getDate() + firstDow - 1) / 7);
}

const dayKeyMap: Record<number, string> = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };

// ─── Fallback weekly menu (used when backend has no menu data) ──

const fallbackWeeklyMenu: Record<string, { normal: string[]; vegan: string[] }> = {
  monday: { normal: ['Mercimek Corbasi', 'Etli Nohut', 'Pirinc Pilavi', 'Ayran'], vegan: ['Mercimek Corbasi', 'Zeytinyagli Fasulye', 'Bulgur Pilavi', 'Ayran'] },
  tuesday: { normal: ['Ezogelin Corbasi', 'Tavuk Sote', 'Makarna', 'Cacik'], vegan: ['Ezogelin Corbasi', 'Sebzeli Guvec', 'Makarna', 'Cacik'] },
  wednesday: { normal: ['Domates Corbasi', 'Kofte', 'Patates Puresi', 'Salata'], vegan: ['Domates Corbasi', 'Mercimek Koftesi', 'Patates Puresi', 'Salata'] },
  thursday: { normal: ['Yayla Corbasi', 'Kuru Fasulye', 'Pirinc Pilavi', 'Tursu'], vegan: ['Yayla Corbasi', 'Barbunya Pilaki', 'Bulgur Pilavi', 'Tursu'] },
  friday: { normal: ['Tarhana Corbasi', 'Balik', 'Patates Kizartmasi', 'Salata'], vegan: ['Tarhana Corbasi', 'Ispanakli Borek', 'Patates Firin', 'Salata'] },
};

// ─── Main Component ──────────────────────────────────────────

type ColorSet = (typeof Colors)['light'];

export default function CafeteriaScreen() {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const [activeTab, setActiveTab] = useState<Tab>('select');

  const tabs: { key: Tab; label: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }[] = [
    { key: 'select', label: 'Yemek Sec', icon: 'cutlery' },
    { key: 'menu', label: 'Menu', icon: 'book' },
    { key: 'history', label: 'Gecmis', icon: 'history' },
  ];

  return (
    <RNView style={[styles.flex1, { backgroundColor: c.background }]}>
      <RNView style={[styles.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabItem, active && { borderBottomColor: c.tint, borderBottomWidth: 2 }]}>
              <FontAwesome name={tab.icon} size={16} color={active ? c.tint : c.textMuted} />
              <RNText style={[styles.tabLabel, { color: active ? c.tint : c.textMuted }]}>{tab.label}</RNText>
            </Pressable>
          );
        })}
      </RNView>

      {activeTab === 'select' && <SelectTab c={c} theme={theme} />}
      {activeTab === 'menu' && <MenuTab c={c} theme={theme} />}
      {activeTab === 'history' && <HistoryTab c={c} theme={theme} />}
    </RNView>
  );
}

// ─── Tab 1: Yemek Sec ───────────────────────────────────────

function SelectTab({ c, theme }: { c: ColorSet; theme: string }) {
  const { data: cafeteriaData, isLoading: loadingCafeterias } = useCafeterias();
  const batchMutation = useCreateBatchReservation();

  const cafeterias = cafeteriaData?.cafeterias?.filter((c) => c.is_active) ?? [];

  const [selectedCafeteria, setSelectedCafeteria] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, MealType>>({
    monday: 'none', tuesday: 'none', wednesday: 'none', thursday: 'none', friday: 'none',
  });
  const [showPayment, setShowPayment] = useState(false);
  const weekDates = getWeekDates();

  const selectedCount = Object.values(selections).filter((v) => v !== 'none').length;
  const totalPrice = selectedCount * MEAL_PRICE;

  const setMeal = (day: string, type: MealType) => {
    setSelections((prev) => ({ ...prev, [day]: type }));
  };

  const handleConfirm = async () => {
    if (!selectedCafeteria) return;

    const reservations: CreateReservationRequest[] = weekDates
      .filter((day) => selections[day.key] !== 'none')
      .map((day) => ({
        cafeteria_id: selectedCafeteria,
        date: day.fullDate,
        meal_time: 'lunch' as const,
        menu_type: selections[day.key] as 'normal' | 'vegan',
      }));

    try {
      const response = await batchMutation.mutateAsync({ reservations });
      setShowPayment(false);
      Alert.alert('Basarili', `Rezervasyonunuz olusturuldu. ${response.payment_url ? 'Odeme sayfasina yonlendirileceksiniz.' : ''}`);
      setSelections({ monday: 'none', tuesday: 'none', wednesday: 'none', thursday: 'none', friday: 'none' });
    } catch (err) {
      Alert.alert('Hata', 'Rezervasyon olusturulurken bir hata olustu.');
    }
  };

  const getMenuItems = (dayKey: string, type: MealType) => {
    if (type === 'none') return fallbackWeeklyMenu[dayKey]?.normal ?? [];
    return type === 'vegan' ? (fallbackWeeklyMenu[dayKey]?.vegan ?? []) : (fallbackWeeklyMenu[dayKey]?.normal ?? []);
  };

  return (
    <>
      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
        <RNText style={[styles.sectionTitle, { color: c.text }]}>Yemekhane Secimi</RNText>

        {loadingCafeterias ? (
          <ActivityIndicator color={c.tint} style={{ marginVertical: 20 }} />
        ) : cafeterias.length === 0 ? (
          <RNView style={[styles.errorBanner, { backgroundColor: theme === 'dark' ? '#3b2e18' : '#fffbeb', borderColor: '#fcd34d' }]}>
            <FontAwesome name="info-circle" size={14} color="#d97706" />
            <RNText style={{ color: '#92400e', fontSize: 13, flex: 1 }}>Yemekhane verisi yuklenemedi.</RNText>
          </RNView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cafeteriaScroll}>
            {cafeterias.map((cafe) => {
              const active = selectedCafeteria === cafe.id;
              return (
                <Pressable key={cafe.id} onPress={() => setSelectedCafeteria(cafe.id)}
                  style={[styles.cafeteriaChip, { backgroundColor: active ? c.tint : c.card, borderColor: active ? c.tint : c.border }]}>
                  <FontAwesome name="map-marker" size={12} color={active ? '#fff' : c.textMuted} />
                  <RNView>
                    <RNText style={[styles.cafeteriaName, { color: active ? '#fff' : c.text }]}>{cafe.name}</RNText>
                    <RNText style={[styles.cafeteriaLoc, { color: active ? '#ffffffcc' : c.textMuted }]}>{cafe.location}</RNText>
                  </RNView>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {selectedCafeteria && (
          <>
            <RNView style={styles.legendRow}>
              <RNView style={styles.legendItem}><RNView style={[styles.legendDot, { backgroundColor: '#9ca3af' }]} /><RNText style={[styles.legendText, { color: c.textMuted }]}>Secilmedi</RNText></RNView>
              <RNView style={styles.legendItem}><RNView style={[styles.legendDot, { backgroundColor: '#f97316' }]} /><RNText style={[styles.legendText, { color: c.textMuted }]}>Normal</RNText></RNView>
              <RNView style={styles.legendItem}><RNView style={[styles.legendDot, { backgroundColor: '#22c55e' }]} /><RNText style={[styles.legendText, { color: c.textMuted }]}>Vegan</RNText></RNView>
            </RNView>

            {weekDates.map((day) => {
              const sel = selections[day.key];
              const items = getMenuItems(day.key, sel);
              const borderColor = sel === 'normal' ? '#f97316' : sel === 'vegan' ? '#22c55e' : c.border;
              return (
                <RNView key={day.key} style={[styles.dayCard, { backgroundColor: c.card, borderColor }]}>
                  <RNView style={styles.dayHeader}>
                    <RNView>
                      <RNText style={[styles.dayLabel, { color: c.text }]}>{day.label}</RNText>
                      <RNText style={[styles.dayDate, { color: c.textMuted }]}>{day.day} {monthNames[day.month]}</RNText>
                    </RNView>
                    {sel !== 'none' && (
                      <Pressable onPress={() => setMeal(day.key, 'none')} style={styles.cancelBtn}>
                        <FontAwesome name="times" size={14} color="#ef4444" />
                      </Pressable>
                    )}
                  </RNView>
                  <RNView style={[styles.dayMenuItems, { opacity: sel === 'none' ? 0.4 : 1 }]}>
                    {items.map((item, idx) => (
                      <RNView key={idx} style={styles.dayMenuItem}>
                        <RNView style={[styles.dayMenuDot, { backgroundColor: sel === 'vegan' ? '#22c55e' : sel === 'normal' ? '#f97316' : '#d1d5db' }]} />
                        <RNText style={[styles.dayMenuText, { color: c.text }]}>{item}</RNText>
                      </RNView>
                    ))}
                  </RNView>
                  <RNView style={styles.mealTypeRow}>
                    <Pressable onPress={() => setMeal(day.key, 'normal')}
                      style={[styles.mealTypeBtn, { backgroundColor: sel === 'normal' ? '#f97316' : c.background, borderColor: sel === 'normal' ? '#f97316' : c.border }]}>
                      <RNText style={[styles.mealTypeBtnText, { color: sel === 'normal' ? '#fff' : c.textSecondary }]}>Normal</RNText>
                    </Pressable>
                    <Pressable onPress={() => setMeal(day.key, 'vegan')}
                      style={[styles.mealTypeBtn, { backgroundColor: sel === 'vegan' ? '#22c55e' : c.background, borderColor: sel === 'vegan' ? '#22c55e' : c.border }]}>
                      <RNText style={[styles.mealTypeBtnText, { color: sel === 'vegan' ? '#fff' : c.textSecondary }]}>Vegan</RNText>
                    </Pressable>
                  </RNView>
                </RNView>
              );
            })}
            <RNView style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      {selectedCafeteria && (
        <RNView style={[styles.bottomBar, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <RNView>
            <RNText style={[styles.bottomLabel, { color: c.textMuted }]}>{selectedCount} ogun secildi</RNText>
            <RNText style={[styles.bottomPrice, { color: c.tint }]}>{totalPrice.toFixed(2)} TL</RNText>
          </RNView>
          <Pressable onPress={() => setShowPayment(true)} disabled={selectedCount === 0}
            style={[styles.payBtn, { backgroundColor: selectedCount > 0 ? '#10b981' : c.border }]}>
            <FontAwesome name="credit-card" size={16} color="#fff" />
            <RNText style={styles.payBtnText}>Odeme Yap</RNText>
          </Pressable>
        </RNView>
      )}

      <Modal visible={showPayment} transparent animationType="slide">
        <RNView style={styles.modalOverlay}>
          <RNView style={[styles.modalContent, { backgroundColor: c.card }]}>
            <RNText style={[styles.modalTitle, { color: c.text }]}>Odeme Onayi</RNText>
            <RNText style={[styles.modalDesc, { color: c.textSecondary }]}>Secilen yemekleri kontrol edin</RNText>
            <RNView style={[styles.modalSummary, { backgroundColor: c.background }]}>
              {weekDates.map((day) => {
                const sel = selections[day.key];
                if (sel === 'none') return null;
                return (
                  <RNView key={day.key} style={styles.modalRow}>
                    <RNText style={[styles.modalRowDay, { color: c.text }]}>{day.label}</RNText>
                    <RNView style={[styles.modalBadge, { backgroundColor: sel === 'vegan' ? '#dcfce7' : '#fff7ed' }]}>
                      <RNText style={{ color: sel === 'vegan' ? '#16a34a' : '#ea580c', fontSize: 12, fontWeight: '600' }}>{sel === 'vegan' ? 'Vegan' : 'Normal'}</RNText>
                    </RNView>
                  </RNView>
                );
              })}
            </RNView>
            <RNView style={[styles.modalTotal, { backgroundColor: '#ecfdf5' }]}>
              <RNText style={{ color: '#065f46', fontWeight: '500' }}>Toplam Tutar</RNText>
              <RNText style={{ color: '#059669', fontSize: 20, fontWeight: '700' }}>{totalPrice.toFixed(2)} TL</RNText>
            </RNView>
            <RNView style={styles.modalBtns}>
              <Pressable onPress={() => setShowPayment(false)} style={[styles.modalCancelBtn, { borderColor: c.border }]}>
                <RNText style={{ color: c.text }}>Iptal</RNText>
              </Pressable>
              <Pressable onPress={handleConfirm} disabled={batchMutation.isPending} style={styles.modalConfirmBtn}>
                {batchMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <FontAwesome name="credit-card" size={14} color="#fff" />
                    <RNText style={styles.modalConfirmText}>Odemeyi Onayla</RNText>
                  </>
                )}
              </Pressable>
            </RNView>
          </RNView>
        </RNView>
      </Modal>
    </>
  );
}

// ─── Tab 2: Menu ─────────────────────────────────────────────

function MenuTab({ c, theme }: { c: ColorSet; theme: string }) {
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now);
  const flatListRef = useRef<FlatList>(null);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;
  const { data: menuResponse, isLoading, error } = useMonthlyMenu(year, month);

  const menuData = menuResponse?.data?.menu_data ?? null;
  const monthDays = useMemo(() => getMonthDays(now.getFullYear(), now.getMonth()), []);

  const dow = selectedDate.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const dayKey = dayKeyMap[dow];
  const weekIdx = getWeekOfMonth(selectedDate);

  // Extract items from backend menu data
  let normalItems: string[] | null = null;
  let veganItems: string[] | null = null;
  if (!isWeekend && dayKey && menuData) {
    try {
      const nWeek = menuData.normalMenus?.[weekIdx];
      const vWeek = menuData.veganMenus?.[weekIdx];
      if (nWeek?.[dayKey]?.items) normalItems = nWeek[dayKey].items;
      if (vWeek?.[dayKey]?.items) veganItems = vWeek[dayKey].items;
    } catch {}
  }

  const isToday = (d: Date) => d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const isSel = (d: Date) => d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth();

  return (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
      <RNView style={styles.menuMonthRow}>
        <FontAwesome name="calendar" size={16} color={c.tint} />
        <RNText style={[styles.menuMonthText, { color: c.text }]}>{monthNames[now.getMonth()]} {now.getFullYear()} - Aylik Menu</RNText>
      </RNView>

      <FlatList
        ref={flatListRef} data={monthDays} horizontal showsHorizontalScrollIndicator={false}
        keyExtractor={(d) => d.toISOString()} initialScrollIndex={Math.max(0, now.getDate() - 3)}
        getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
        style={styles.dateCarousel}
        renderItem={({ item: d }) => {
          const dWknd = d.getDay() === 0 || d.getDay() === 6;
          const sel = isSel(d);
          const today = isToday(d);
          return (
            <Pressable onPress={() => setSelectedDate(d)}
              style={[styles.dateChip, { backgroundColor: sel ? c.tint : dWknd ? (theme === 'dark' ? '#1e293b' : '#f1f5f9') : c.card, borderColor: sel ? c.tint : c.border }]}>
              <RNText style={[styles.dateChipDay, { color: sel ? '#fff' : dWknd ? c.textMuted : c.textSecondary }]}>{shortDayNames[d.getDay()]}</RNText>
              <RNText style={[styles.dateChipNum, { color: sel ? '#fff' : dWknd ? c.textMuted : c.text }]}>{d.getDate()}</RNText>
              {today && <RNView style={[styles.todayDot, { backgroundColor: sel ? '#fff' : c.tint }]} />}
            </Pressable>
          );
        }}
      />

      {isLoading && <ActivityIndicator color={c.tint} style={{ marginVertical: 20 }} />}

      {error && !isLoading && (
        <RNView style={[styles.errorBanner, { backgroundColor: theme === 'dark' ? '#3b2e18' : '#fffbeb', borderColor: '#fcd34d' }]}>
          <FontAwesome name="info-circle" size={14} color="#d97706" />
          <RNText style={{ color: '#92400e', fontSize: 13, flex: 1 }}>Bu ay icin henuz menu olusturulmamis veya backend'e baglanilmadi.</RNText>
        </RNView>
      )}

      {isWeekend && (
        <RNView style={[styles.warningBanner, { backgroundColor: theme === 'dark' ? '#1e3a5f' : '#eff6ff', borderColor: '#93c5fd' }]}>
          <FontAwesome name="info-circle" size={14} color="#3b82f6" />
          <RNText style={{ color: '#1d4ed8', fontSize: 13, flex: 1 }}>Hafta sonlari yemek servisi bulunmamaktadir.</RNText>
        </RNView>
      )}

      <RNText style={[styles.selectedDateLabel, { color: c.textSecondary }]}>
        {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}, {fullDayNames[selectedDate.getDay()]}
      </RNText>

      {/* Normal Menu Card */}
      <RNView style={[styles.menuCard, { backgroundColor: c.card, borderLeftColor: '#3b82f6' }]}>
        <RNView style={[styles.menuCardHeader, { backgroundColor: theme === 'dark' ? '#1e3a5f' : '#eff6ff' }]}>
          <FontAwesome name="cutlery" size={16} color="#3b82f6" />
          <RNText style={[styles.menuCardTitle, { color: '#1e40af' }]}>Standart Menu</RNText>
        </RNView>
        {normalItems && normalItems.some((i) => i && i.trim()) ? (
          <RNView style={styles.menuCardBody}>
            {menuCategories.map((cat, idx) => (
              <RNView key={cat} style={[styles.menuCatRow, idx < menuCategories.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <RNText style={[styles.menuCatLabel, { color: categoryColors[cat] || c.textMuted }]}>{cat}</RNText>
                <RNText style={[styles.menuCatValue, { color: c.text }]}>{normalItems![idx] || '-'}</RNText>
              </RNView>
            ))}
          </RNView>
        ) : (
          <RNView style={styles.menuEmpty}>
            <FontAwesome name="cutlery" size={24} color={c.textMuted} style={{ opacity: 0.4 }} />
            <RNText style={[styles.menuEmptyText, { color: c.textMuted }]}>Bu gun icin menu bulunmuyor</RNText>
          </RNView>
        )}
      </RNView>

      {/* Vegan Menu Card */}
      <RNView style={[styles.menuCard, { backgroundColor: c.card, borderLeftColor: '#22c55e' }]}>
        <RNView style={[styles.menuCardHeader, { backgroundColor: theme === 'dark' ? '#14332a' : '#f0fdf4' }]}>
          <FontAwesome name="leaf" size={16} color="#22c55e" />
          <RNText style={[styles.menuCardTitle, { color: '#166534' }]}>Vegan Menu</RNText>
        </RNView>
        {veganItems && veganItems.some((i) => i && i.trim()) ? (
          <RNView style={styles.menuCardBody}>
            {menuCategories.map((cat, idx) => (
              <RNView key={cat} style={[styles.menuCatRow, idx < menuCategories.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <RNText style={[styles.menuCatLabel, { color: categoryColors[cat] || c.textMuted }]}>{cat}</RNText>
                <RNText style={[styles.menuCatValue, { color: c.text }]}>{veganItems![idx] || '-'}</RNText>
              </RNView>
            ))}
          </RNView>
        ) : (
          <RNView style={styles.menuEmpty}>
            <FontAwesome name="leaf" size={24} color={c.textMuted} style={{ opacity: 0.4 }} />
            <RNText style={[styles.menuEmptyText, { color: c.textMuted }]}>Bu gun icin menu bulunmuyor</RNText>
          </RNView>
        )}
      </RNView>

      <RNView style={[styles.footnote, { backgroundColor: c.card }]}>
        <RNText style={[styles.footnoteText, { color: c.textMuted }]}>*Mucbir sebepler haricinde kesinlikle menu degisimi yapilmayacaktir.</RNText>
      </RNView>
    </ScrollView>
  );
}

// ─── Tab 3: Gecmis ──────────────────────────────────────────

function HistoryTab({ c, theme }: { c: ColorSet; theme: string }) {
  const now = new Date();
  const todayStr = formatDate(now);

  // Active: from today forward
  const { data: activeData, isLoading: loadingActive } = useMyReservations({ from_date: todayStr });
  // Past: before today
  const { data: pastData, isLoading: loadingPast } = useMyReservations({ to_date: todayStr, limit: 20 });

  const activeRes = activeData?.reservations?.filter((r) => r.status === 'confirmed' && !r.is_used) ?? [];
  const pastRes = pastData?.reservations ?? [];

  const renderReservation = (res: Reservation, isPast: boolean) => (
    <RNView key={res.id} style={[styles.historyCard, { backgroundColor: c.card }]}>
      <RNView style={styles.historyCardTop}>
        <RNView>
          <RNText style={[styles.historyDate, { color: c.text }]}>{formatDateTR(res.date)}</RNText>
          <RNText style={[styles.historyDay, { color: c.textMuted }]}>
            {fullDayNames[new Date(res.date).getDay()]} - {res.meal_time === 'lunch' ? 'Ogle' : 'Aksam'}
          </RNText>
        </RNView>
        <RNView style={[styles.historyBadge, {
          backgroundColor: isPast ? (res.is_used ? '#dcfce7' : '#fee2e2') : '#fff7ed',
        }]}>
          <RNText style={{
            color: isPast ? (res.is_used ? '#16a34a' : '#dc2626') : '#ea580c',
            fontSize: 11, fontWeight: '600',
          }}>
            {isPast ? (res.is_used ? 'Kullanildi' : 'Kullanilmadi') : 'Aktif'}
          </RNText>
        </RNView>
      </RNView>
      <RNView style={[styles.historyCardBottom, { borderTopColor: c.border }]}>
        <RNView style={styles.historyMeta}>
          <FontAwesome name="map-marker" size={12} color={c.textMuted} />
          <RNText style={[styles.historyMetaText, { color: c.textSecondary }]}>{res.cafeteria_name || res.cafeteria?.name || '-'}</RNText>
        </RNView>
        <RNView style={styles.historyMeta}>
          <RNView style={[styles.menuTypeDot, { backgroundColor: res.menu_type === 'vegan' ? '#22c55e' : '#f97316' }]} />
          <RNText style={[styles.historyMetaText, { color: res.menu_type === 'vegan' ? '#16a34a' : '#ea580c' }]}>
            {res.menu_type === 'vegan' ? 'Vegan' : 'Normal'}
          </RNText>
        </RNView>
      </RNView>
    </RNView>
  );

  return (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
      {/* Active Reservations */}
      <RNView style={styles.historySection}>
        <RNView style={styles.historySectionHeader}>
          <FontAwesome name="calendar-check-o" size={16} color="#10b981" />
          <RNText style={[styles.sectionTitle, { color: c.text, marginBottom: 0 }]}>Aktif Randevular</RNText>
          {loadingActive && <ActivityIndicator color={c.tint} size="small" style={{ marginLeft: 8 }} />}
        </RNView>
        {!loadingActive && activeRes.length === 0 && (
          <RNText style={[styles.emptyText, { color: c.textMuted }]}>Aktif randevunuz bulunmamaktadir.</RNText>
        )}
        {activeRes.map((r) => renderReservation(r, false))}
      </RNView>

      {/* Past Records */}
      <RNView style={styles.historySection}>
        <RNView style={styles.historySectionHeader}>
          <FontAwesome name="history" size={16} color={c.textMuted} />
          <RNText style={[styles.sectionTitle, { color: c.text, marginBottom: 0 }]}>Gecmis Kayitlar</RNText>
          {loadingPast && <ActivityIndicator color={c.tint} size="small" style={{ marginLeft: 8 }} />}
        </RNView>
        {!loadingPast && pastRes.length === 0 && (
          <RNText style={[styles.emptyText, { color: c.textMuted }]}>Gecmis kayit bulunamadi.</RNText>
        )}
        {pastRes.map((r) => renderReservation(r, true))}

        {pastData?.pagination && pastData.pagination.total_pages > 1 && (
          <RNText style={[styles.paginationHint, { color: c.textMuted }]}>
            Toplam {pastData.pagination.total_items} kayit ({pastData.pagination.page}/{pastData.pagination.total_pages} sayfa)
          </RNText>
        )}
      </RNView>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },

  // Select tab
  cafeteriaScroll: { marginBottom: 16 },
  cafeteriaChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginRight: 10 },
  cafeteriaName: { fontSize: 13, fontWeight: '600' },
  cafeteriaLoc: { fontSize: 11 },

  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },

  dayCard: { borderRadius: 14, borderWidth: 2, padding: 14, marginBottom: 12 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayLabel: { fontSize: 15, fontWeight: '600' },
  dayDate: { fontSize: 12, marginTop: 1 },
  cancelBtn: { padding: 6 },
  dayMenuItems: { marginBottom: 10 },
  dayMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  dayMenuDot: { width: 5, height: 5, borderRadius: 3 },
  dayMenuText: { fontSize: 13 },
  mealTypeRow: { flexDirection: 'row', gap: 8 },
  mealTypeBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  mealTypeBtnText: { fontSize: 13, fontWeight: '600' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
  bottomLabel: { fontSize: 13 },
  bottomPrice: { fontSize: 22, fontWeight: '700' },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  payBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalDesc: { fontSize: 14, marginTop: 4, marginBottom: 16 },
  modalSummary: { borderRadius: 12, padding: 14, marginBottom: 12 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  modalRowDay: { fontSize: 14, fontWeight: '500' },
  modalBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  modalTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 16, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  modalConfirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#10b981' },
  modalConfirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Menu tab
  menuMonthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  menuMonthText: { fontSize: 17, fontWeight: '600' },
  dateCarousel: { marginBottom: 16 },
  dateChip: { width: 56, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginRight: 8 },
  dateChipDay: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  dateChipNum: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  todayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12 },
  selectedDateLabel: { fontSize: 13, marginBottom: 12 },
  menuCard: { borderRadius: 14, borderLeftWidth: 4, marginBottom: 16, overflow: 'hidden' },
  menuCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  menuCardTitle: { fontSize: 16, fontWeight: '700' },
  menuCardBody: { padding: 12 },
  menuCatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  menuCatLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  menuCatValue: { fontSize: 14, fontWeight: '500' },
  menuEmpty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  menuEmptyText: { fontSize: 13 },
  footnote: { borderRadius: 10, padding: 12, marginTop: 4 },
  footnoteText: { fontSize: 11 },

  // History tab
  historySection: { marginBottom: 24 },
  historySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  historyCard: { borderRadius: 12, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  historyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  historyDate: { fontSize: 14, fontWeight: '600' },
  historyDay: { fontSize: 12, marginTop: 2 },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  historyCardBottom: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyMetaText: { fontSize: 12 },
  menuTypeDot: { width: 7, height: 7, borderRadius: 4 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  paginationHint: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});
