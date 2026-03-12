import { useState } from 'react';
import { StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text as RNText, View as RNView } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useMyAttendance, useScanQR } from '@/hooks/useAttendance';
import type { CourseAttendance, WeeklyRecord } from '@/types/attendance.types';

export default function QRAttendanceScreen() {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  const { data: attendance, isLoading, error } = useMyAttendance();
  const scanMutation = useScanQR();
  const [lastScan, setLastScan] = useState<{ course: string; message: string } | null>(null);

  // Flatten recent records across all courses, sorted by date desc
  const recentRecords: (WeeklyRecord & { courseName: string; courseCode: string })[] = [];
  if (attendance?.courses) {
    for (const course of attendance.courses) {
      for (const rec of course.weekly_records) {
        recentRecords.push({ ...rec, courseName: course.course_name, courseCode: course.course_code });
      }
    }
  }
  recentRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestRecords = recentRecords.slice(0, 6);

  // Find most relevant active course (last attended or first in list)
  const activeCourse: CourseAttendance | null = attendance?.courses?.[0] ?? null;

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: c.background }]}>
      <RNView style={[styles.container, { backgroundColor: c.background }]}>
        {/* QR Scan Area */}
        <RNView style={[styles.qrArea, { backgroundColor: c.card }]}>
          <RNView style={[styles.qrIconBox, { borderColor: c.tint }]}>
            <FontAwesome name="qrcode" size={80} color={c.tint} />
          </RNView>
          <RNText style={[styles.qrHint, { color: c.textSecondary }]}>
            Yoklama icin QR kodu tarayin
          </RNText>
          {scanMutation.isPending && (
            <ActivityIndicator style={{ marginTop: 12 }} color={c.tint} />
          )}
          {lastScan && (
            <RNView style={[styles.scanResult, { backgroundColor: '#dcfce7' }]}>
              <FontAwesome name="check-circle" size={16} color="#16a34a" />
              <RNText style={{ color: '#16a34a', fontSize: 13, flex: 1 }}>{lastScan.course} - {lastScan.message}</RNText>
            </RNView>
          )}
          {scanMutation.isError && (
            <RNView style={[styles.scanResult, { backgroundColor: '#fee2e2' }]}>
              <FontAwesome name="exclamation-circle" size={16} color="#dc2626" />
              <RNText style={{ color: '#dc2626', fontSize: 13, flex: 1 }}>Yoklama alinamadi. Tekrar deneyin.</RNText>
            </RNView>
          )}
        </RNView>

        {/* Loading state */}
        {isLoading && (
          <RNView style={styles.loadingBox}>
            <ActivityIndicator color={c.tint} size="large" />
            <RNText style={[styles.loadingText, { color: c.textMuted }]}>Yoklama verileri yukleniyor...</RNText>
          </RNView>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <RNView style={[styles.errorBanner, { backgroundColor: theme === 'dark' ? '#3b1818' : '#fef2f2', borderColor: '#fca5a5' }]}>
            <FontAwesome name="exclamation-triangle" size={14} color="#ef4444" />
            <RNText style={{ color: '#dc2626', fontSize: 13, flex: 1 }}>
              Backend baglantisi kurulamadi. Veriler yuklenemedi.
            </RNText>
          </RNView>
        )}

        {/* Active Course Info */}
        {activeCourse && (
          <RNView style={styles.section}>
            <RNText style={[styles.sectionTitle, { color: c.text }]}>Aktif Ders Devam Durumu</RNText>
            <RNView style={[styles.classCard, { backgroundColor: c.card }]}>
              <RNView style={styles.classHeader}>
                <FontAwesome name="book" size={18} color={c.tint} />
                <RNView style={{ flex: 1 }}>
                  <RNText style={[styles.className, { color: c.text }]}>{activeCourse.course_name}</RNText>
                  <RNText style={[styles.classCode, { color: c.textMuted }]}>{activeCourse.course_code}</RNText>
                </RNView>
              </RNView>

              {/* Theory stats */}
              <RNView style={[styles.statsRow, { borderTopColor: c.border }]}>
                <RNText style={[styles.statsLabel, { color: c.textSecondary }]}>Teori</RNText>
                <RNView style={styles.statsValues}>
                  <RNText style={[styles.statsPresent, { color: '#16a34a' }]}>{activeCourse.theory.present_count} katilim</RNText>
                  <RNText style={[styles.statsSep, { color: c.textMuted }]}>/</RNText>
                  <RNText style={[styles.statsTotal, { color: c.textMuted }]}>{activeCourse.theory.total_sessions} toplam</RNText>
                </RNView>
                <RNView style={[styles.passBadge, { backgroundColor: activeCourse.theory.passed ? '#dcfce7' : '#fee2e2' }]}>
                  <RNText style={{ color: activeCourse.theory.passed ? '#16a34a' : '#dc2626', fontSize: 11, fontWeight: '600' }}>
                    {activeCourse.theory.passed ? 'Gecti' : 'Risk'}
                  </RNText>
                </RNView>
              </RNView>

              {/* Lab stats */}
              {activeCourse.lab.total_sessions > 0 && (
                <RNView style={[styles.statsRow, { borderTopColor: c.border }]}>
                  <RNText style={[styles.statsLabel, { color: c.textSecondary }]}>Lab</RNText>
                  <RNView style={styles.statsValues}>
                    <RNText style={[styles.statsPresent, { color: '#16a34a' }]}>{activeCourse.lab.present_count} katilim</RNText>
                    <RNText style={[styles.statsSep, { color: c.textMuted }]}>/</RNText>
                    <RNText style={[styles.statsTotal, { color: c.textMuted }]}>{activeCourse.lab.total_sessions} toplam</RNText>
                  </RNView>
                  <RNView style={[styles.passBadge, { backgroundColor: activeCourse.lab.passed ? '#dcfce7' : '#fee2e2' }]}>
                    <RNText style={{ color: activeCourse.lab.passed ? '#16a34a' : '#dc2626', fontSize: 11, fontWeight: '600' }}>
                      {activeCourse.lab.passed ? 'Gecti' : 'Risk'}
                    </RNText>
                  </RNView>
                </RNView>
              )}

              <RNView style={styles.classDetail}>
                <FontAwesome name="user" size={14} color={c.textMuted} />
                <RNText style={[styles.classDetailText, { color: c.textSecondary }]}>{activeCourse.instructor}</RNText>
              </RNView>
            </RNView>
          </RNView>
        )}

        {/* All Courses Summary */}
        {attendance?.courses && attendance.courses.length > 1 && (
          <RNView style={styles.section}>
            <RNText style={[styles.sectionTitle, { color: c.text }]}>Tum Dersler</RNText>
            {attendance.courses.map((course) => {
              const theoryPct = course.theory.total_sessions > 0
                ? Math.round((course.theory.present_count / course.theory.total_sessions) * 100)
                : 100;
              return (
                <RNView key={course.course_id} style={[styles.courseSummaryRow, { backgroundColor: c.card }]}>
                  <RNView style={{ flex: 1 }}>
                    <RNText style={[styles.courseSummaryCode, { color: c.tint }]}>{course.course_code}</RNText>
                    <RNText style={[styles.courseSummaryName, { color: c.text }]}>{course.course_name}</RNText>
                  </RNView>
                  <RNView style={[styles.pctBadge, { backgroundColor: theoryPct >= 80 ? '#dcfce7' : theoryPct >= 60 ? '#fff7ed' : '#fee2e2' }]}>
                    <RNText style={{ color: theoryPct >= 80 ? '#16a34a' : theoryPct >= 60 ? '#ea580c' : '#dc2626', fontSize: 13, fontWeight: '700' }}>
                      %{theoryPct}
                    </RNText>
                  </RNView>
                </RNView>
              );
            })}
          </RNView>
        )}

        {/* Recent Attendance */}
        {latestRecords.length > 0 && (
          <RNView style={styles.section}>
            <RNText style={[styles.sectionTitle, { color: c.text }]}>Son Yoklamalar</RNText>
            {latestRecords.map((item, index) => (
              <RNView key={`${item.courseCode}-${item.week}-${item.session_type}-${index}`} style={[styles.attendanceRow, { backgroundColor: c.card }]}>
                <RNView style={styles.attendanceInfo}>
                  <RNText style={[styles.attendanceCourse, { color: c.text }]}>{item.courseName}</RNText>
                  <RNText style={[styles.attendanceDate, { color: c.textMuted }]}>
                    {item.date} - Hafta {item.week} ({item.session_type === 'theory' ? 'Teori' : 'Lab'})
                  </RNText>
                </RNView>
                <RNView style={[styles.statusBadge, { backgroundColor: '#dcfce7' }]}>
                  <RNText style={{ color: '#16a34a', fontSize: 11, fontWeight: '600' }}>
                    {item.marked_via === 'qr' ? 'QR' : 'Manuel'}
                  </RNText>
                </RNView>
              </RNView>
            ))}
          </RNView>
        )}
      </RNView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  container: { flex: 1, padding: 20 },
  qrArea: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  qrIconBox: {
    width: 160,
    height: 160,
    borderRadius: 20,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrHint: { fontSize: 15 },
  scanResult: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 8, width: '100%' },

  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  classCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  classHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  className: { fontSize: 17, fontWeight: '600' },
  classCode: { fontSize: 12, marginTop: 1 },
  classDetail: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  classDetailText: { fontSize: 14 },

  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  statsLabel: { fontSize: 13, fontWeight: '600', width: 40 },
  statsValues: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsPresent: { fontSize: 13, fontWeight: '600' },
  statsSep: { fontSize: 13 },
  statsTotal: { fontSize: 13 },
  passBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  courseSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  courseSummaryCode: { fontSize: 11, fontWeight: '600' },
  courseSummaryName: { fontSize: 14, fontWeight: '500', marginTop: 1 },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },

  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  attendanceInfo: { flex: 1 },
  attendanceCourse: { fontSize: 15, fontWeight: '500' },
  attendanceDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
});
