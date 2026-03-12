import { useState, useMemo } from 'react';
import { StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text as RNText, View as RNView } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useMyGrades } from '@/hooks/useGrades';
import type { ActiveCourse, CompletedCourse } from '@/types/grades.types';

const gradeColorMap: Record<string, string> = {
  AA: '#16a34a', BA: '#22c55e', AB: '#22c55e', BB: '#84cc16',
  CB: '#eab308', CC: '#f59e0b', DC: '#f97316', DD: '#ef4444', FF: '#dc2626',
};

const yearColors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];

// Parse "2024-2025-fall" or "2024-2025-spring" style semester strings
function parseSemester(sem: string): { year: number; term: number; display: string } {
  const lower = sem.toLowerCase();
  // Try pattern: "2024-2025-fall" or "2024-2025-spring"
  const match = lower.match(/(\d{4})-(\d{4})-(fall|spring|guz|bahar)/);
  if (match) {
    const startYear = parseInt(match[1]);
    const isFall = match[3] === 'fall' || match[3] === 'guz';
    // Estimate academic year: fall=1st semester, spring=2nd semester
    return {
      year: startYear,
      term: isFall ? 1 : 2,
      display: `${match[1]}-${match[2]} ${isFall ? 'Guz' : 'Bahar'}`,
    };
  }
  // Try just year-term numeric: "1" "2" "3" etc
  const numMatch = lower.match(/^(\d+)$/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    return { year: Math.ceil(n / 2), term: ((n - 1) % 2) + 1, display: `${Math.ceil(n / 2)}. Sinif ${((n - 1) % 2) === 0 ? 'Guz' : 'Bahar'}` };
  }
  return { year: 1, term: 1, display: sem };
}

// Group courses by class year > semester
type SemesterGroup = {
  semester: string;
  display: string;
  term: number;
  gpa: number | null;
  courses: {
    code: string;
    name: string;
    credits: number;
    scores: Record<string, { score: number | null; is_absent: boolean }>;
    weightedAvg: number | null;
    gradePoint: string;
    isActive: boolean;
  }[];
};

type YearGroup = {
  year: number;
  semesters: SemesterGroup[];
};

function buildYearGroups(active: ActiveCourse[], completed: CompletedCourse[]): YearGroup[] {
  const semMap = new Map<string, SemesterGroup>();

  // Add completed courses
  for (const c of completed) {
    const parsed = parseSemester(c.semester);
    const key = `${parsed.year}-${parsed.term}`;
    if (!semMap.has(key)) {
      semMap.set(key, { semester: c.semester, display: parsed.display, term: parsed.term, gpa: null, courses: [] });
    }
    semMap.get(key)!.courses.push({
      code: c.course_code,
      name: c.course_name,
      credits: c.credits,
      scores: c.assessment_scores as any,
      weightedAvg: c.weighted_average,
      gradePoint: c.grade_point,
      isActive: false,
    });
  }

  // Add active courses
  for (const c of active) {
    const parsed = parseSemester(c.semester);
    const key = `${parsed.year}-${parsed.term}`;
    if (!semMap.has(key)) {
      semMap.set(key, { semester: c.semester, display: parsed.display, term: parsed.term, gpa: null, courses: [] });
    }
    // Extract midterm score if available
    const midterm = c.scores['midterm'] ?? c.scores['vize'] ?? null;
    semMap.get(key)!.courses.push({
      code: c.course_code,
      name: c.course_name,
      credits: c.credits,
      scores: c.scores as any,
      weightedAvg: null,
      gradePoint: '-',
      isActive: true,
    });
  }

  // Group by year
  const yearMap = new Map<number, YearGroup>();
  for (const [key, sem] of semMap) {
    const yearNum = parseInt(key.split('-')[0]);
    if (!yearMap.has(yearNum)) {
      yearMap.set(yearNum, { year: yearNum, semesters: [] });
    }
    yearMap.get(yearNum)!.semesters.push(sem);
  }

  // Sort
  const result = Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  for (const y of result) {
    y.semesters.sort((a, b) => a.term - b.term);
  }
  return result;
}

export default function MyGradesScreen() {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  const { data, isLoading, error } = useMyGrades();

  const [openYears, setOpenYears] = useState<Set<number>>(new Set());
  const [openSemesters, setOpenSemesters] = useState<Set<string>>(new Set());

  const toggleYear = (year: number) => {
    setOpenYears((prev) => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  };

  const toggleSemester = (key: string) => {
    setOpenSemesters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const yearGroups = useMemo(() => {
    if (!data) return [];
    return buildYearGroups(data.active_courses || [], data.completed_courses || []);
  }, [data]);

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: c.background }]}>
      <RNView style={[styles.container, { backgroundColor: c.background }]}>
        {/* Loading */}
        {isLoading && (
          <RNView style={styles.loadingBox}>
            <ActivityIndicator color={c.tint} size="large" />
            <RNText style={[styles.loadingText, { color: c.textMuted }]}>Notlar yukleniyor...</RNText>
          </RNView>
        )}

        {/* Error */}
        {error && !isLoading && (
          <RNView style={[styles.errorBanner, { backgroundColor: theme === 'dark' ? '#3b1818' : '#fef2f2', borderColor: '#fca5a5' }]}>
            <FontAwesome name="exclamation-triangle" size={14} color="#ef4444" />
            <RNText style={{ color: '#dc2626', fontSize: 13, flex: 1 }}>Backend baglantisi kurulamadi.</RNText>
          </RNView>
        )}

        {/* GPA Card */}
        {data && (
          <RNView style={[styles.gpaCard, { backgroundColor: c.card }]}>
            <RNView style={styles.gpaMain}>
              <RNText style={[styles.gpaLabel, { color: c.textSecondary }]}>Genel GPA</RNText>
              <RNText style={[styles.gpaValue, { color: c.tint }]}>{data.cumulative_gpa?.toFixed(2) ?? '-'}</RNText>
            </RNView>
            <RNView style={[styles.gpaDivider, { backgroundColor: c.border }]} />
            <RNView style={styles.gpaMain}>
              <RNText style={[styles.gpaLabel, { color: c.textSecondary }]}>Tamamlanan</RNText>
              <RNText style={[styles.gpaCumulative, { color: c.text }]}>{data.total_credits ?? 0} KR</RNText>
            </RNView>
          </RNView>
        )}

        {/* Year > Semester > Grades (Accordion) */}
        {yearGroups.map((yearData) => {
          const yearOpen = openYears.has(yearData.year);
          const yColor = yearColors[(yearData.year - 1) % yearColors.length];
          const totalCourses = yearData.semesters.reduce((s, sem) => s + sem.courses.length, 0);

          return (
            <RNView key={yearData.year} style={[styles.yearBox, { backgroundColor: c.card, borderColor: c.border }]}>
              <Pressable onPress={() => toggleYear(yearData.year)} style={[styles.yearHeader, { backgroundColor: yColor + '15' }]}>
                <FontAwesome name="graduation-cap" size={16} color={yColor} />
                <RNText style={[styles.yearTitle, { color: yColor }]}>{yearData.year}. Sinif</RNText>
                <RNText style={[styles.yearCount, { color: yColor }]}>{totalCourses} ders</RNText>
                <FontAwesome name={yearOpen ? 'chevron-up' : 'chevron-down'} size={14} color={yColor} />
              </Pressable>

              {yearOpen && yearData.semesters.map((sem) => {
                const semKey = `${yearData.year}-${sem.term}`;
                const semOpen = openSemesters.has(semKey);

                return (
                  <RNView key={sem.term} style={styles.semesterBox}>
                    <Pressable onPress={() => toggleSemester(semKey)} style={[styles.semesterHeader, { borderBottomColor: c.border }]}>
                      <RNView style={[styles.semesterDot, { backgroundColor: yColor }]} />
                      <RNText style={[styles.semesterTitle, { color: c.text }]}>
                        {sem.term}. Donem {sem.term === 1 ? '(Guz)' : '(Bahar)'}
                      </RNText>
                      {sem.gpa !== null && (
                        <RNView style={[styles.semGpaBadge, { backgroundColor: yColor + '15' }]}>
                          <RNText style={[styles.semGpaText, { color: yColor }]}>GPA {sem.gpa.toFixed(2)}</RNText>
                        </RNView>
                      )}
                      <FontAwesome name={semOpen ? 'chevron-up' : 'chevron-down'} size={12} color={c.textMuted} />
                    </Pressable>

                    {semOpen && (
                      sem.courses.length === 0 ? (
                        <RNView style={styles.emptyState}>
                          <FontAwesome name="clock-o" size={16} color={c.textMuted} />
                          <RNText style={[styles.emptyText, { color: c.textMuted }]}>Henuz not girilmedi</RNText>
                        </RNView>
                      ) : (
                        <>
                          <RNView style={[styles.tableHeader, { borderBottomColor: c.border }]}>
                            <RNText style={[styles.headerCell, styles.cellWide, { color: c.textMuted }]}>Ders</RNText>
                            <RNText style={[styles.headerCell, styles.cellNarrow, { color: c.textMuted }]}>KR</RNText>
                            <RNText style={[styles.headerCell, styles.cellNarrow, { color: c.textMuted }]}>Ort.</RNText>
                            <RNText style={[styles.headerCell, styles.cellNarrow, { color: c.textMuted }]}>Not</RNText>
                          </RNView>
                          {sem.courses.map((course) => (
                            <RNView key={course.code} style={[styles.tableRow, { backgroundColor: c.background, borderBottomColor: c.border }]}>
                              <RNView style={styles.cellWide}>
                                <RNText style={[styles.courseCode, { color: c.tint }]}>{course.code}</RNText>
                                <RNText style={[styles.courseName, { color: c.text }]} numberOfLines={1}>{course.name}</RNText>
                              </RNView>
                              <RNText style={[styles.cellNarrow, styles.cellText, { color: c.textSecondary }]}>
                                {course.credits}
                              </RNText>
                              <RNText style={[styles.cellNarrow, styles.cellText, { color: c.text, fontWeight: '600' }]}>
                                {course.weightedAvg !== null ? course.weightedAvg.toFixed(0) : '-'}
                              </RNText>
                              <RNView style={styles.cellNarrow}>
                                <RNView style={[styles.gradeBadge, { backgroundColor: (gradeColorMap[course.gradePoint] || c.tint) + '20' }]}>
                                  <RNText style={[styles.gradeText, { color: gradeColorMap[course.gradePoint] || c.textMuted }]}>
                                    {course.gradePoint}
                                  </RNText>
                                </RNView>
                              </RNView>
                            </RNView>
                          ))}
                        </>
                      )
                    )}
                  </RNView>
                );
              })}
            </RNView>
          );
        })}
      </RNView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  container: { flex: 1, padding: 20 },

  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },

  gpaCard: {
    flexDirection: 'row', borderRadius: 16, padding: 24, marginBottom: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  gpaMain: { flex: 1, alignItems: 'center' },
  gpaLabel: { fontSize: 14, marginBottom: 4 },
  gpaValue: { fontSize: 40, fontWeight: 'bold' },
  gpaCumulative: { fontSize: 32, fontWeight: 'bold' },
  gpaDivider: { width: 1, height: 60 },

  yearBox: { borderRadius: 16, marginBottom: 16, borderWidth: 1, overflow: 'hidden' },
  yearHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  yearTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  yearCount: { fontSize: 12, fontWeight: '500', marginRight: 4 },

  semesterBox: { paddingHorizontal: 12, paddingBottom: 4 },
  semesterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  semesterDot: { width: 8, height: 8, borderRadius: 4 },
  semesterTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  semGpaBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  semGpaText: { fontSize: 12, fontWeight: '700' },

  emptyState: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  emptyText: { fontSize: 13 },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, marginTop: 8, borderBottomWidth: 1 },
  headerCell: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 8, marginVertical: 1 },
  cellWide: { flex: 2 },
  cellNarrow: { flex: 1, alignItems: 'center' as const },
  cellText: { fontSize: 13, textAlign: 'center' },
  courseCode: { fontSize: 10, fontWeight: '600' },
  courseName: { fontSize: 12, marginTop: 1 },
  gradeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  gradeText: { fontSize: 12, fontWeight: '700' },
});
