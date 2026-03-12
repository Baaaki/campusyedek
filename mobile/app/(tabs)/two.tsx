import { useState } from 'react';
import { StyleSheet, ScrollView, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text as RNText, View as RNView } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Course = {
  code: string;
  name: string;
  instructor: string;
  credits: number;
  grade: string;
  attendance: number;
  color: string;
};

type Semester = {
  semester: number;
  courses: Course[];
};

type YearData = {
  year: number;
  semesters: Semester[];
};

const curriculum: YearData[] = [
  {
    year: 1,
    semesters: [
      {
        semester: 1,
        courses: [
          { code: 'MAT101', name: 'Matematik I', instructor: 'Prof. Dr. Hasan Yildiz', credits: 5, grade: 'BB', attendance: 90, color: '#6366f1' },
          { code: 'FIZ101', name: 'Fizik I', instructor: 'Prof. Dr. Selma Arslan', credits: 4, grade: 'CB', attendance: 85, color: '#8b5cf6' },
          { code: 'BLM101', name: 'Programlamaya Giris', instructor: 'Dr. Emre Celik', credits: 4, grade: 'AA', attendance: 98, color: '#ec4899' },
          { code: 'TUR101', name: 'Turkce I', instructor: 'Ogr. Gor. Deniz Kara', credits: 2, grade: 'BA', attendance: 92, color: '#14b8a6' },
          { code: 'ATA101', name: 'Ataturk Ilkeleri I', instructor: 'Ogr. Gor. Cem Dogan', credits: 2, grade: 'AA', attendance: 95, color: '#f59e0b' },
        ],
      },
      {
        semester: 2,
        courses: [
          { code: 'MAT102', name: 'Matematik II', instructor: 'Prof. Dr. Hasan Yildiz', credits: 5, grade: 'CB', attendance: 82, color: '#6366f1' },
          { code: 'FIZ102', name: 'Fizik II', instructor: 'Prof. Dr. Selma Arslan', credits: 4, grade: 'BB', attendance: 88, color: '#8b5cf6' },
          { code: 'BLM102', name: 'Nesneye Yonelik Programlama', instructor: 'Dr. Emre Celik', credits: 4, grade: 'BA', attendance: 96, color: '#ec4899' },
          { code: 'ING102', name: 'Ingilizce II', instructor: 'Ogr. Gor. Lisa Brown', credits: 3, grade: 'AA', attendance: 90, color: '#14b8a6' },
        ],
      },
    ],
  },
  {
    year: 2,
    semesters: [
      {
        semester: 1,
        courses: [
          { code: 'BLM201', name: 'Veri Yapilari', instructor: 'Prof. Dr. Ahmet Yilmaz', credits: 4, grade: 'BA', attendance: 94, color: '#6366f1' },
          { code: 'BLM203', name: 'Sayisal Devreler', instructor: 'Doc. Dr. Burak Tekin', credits: 3, grade: 'BB', attendance: 87, color: '#8b5cf6' },
          { code: 'MAT201', name: 'Lineer Cebir', instructor: 'Prof. Dr. Zeynep Sahin', credits: 3, grade: 'CB', attendance: 78, color: '#ef4444' },
          { code: 'MAT203', name: 'Olasilik ve Istatistik', instructor: 'Doc. Dr. Kemal Oz', credits: 3, grade: 'BB', attendance: 84, color: '#f59e0b' },
        ],
      },
      {
        semester: 2,
        courses: [
          { code: 'BLM202', name: 'Algoritmalar', instructor: 'Prof. Dr. Ahmet Yilmaz', credits: 4, grade: 'AA', attendance: 96, color: '#6366f1' },
          { code: 'BLM204', name: 'Veritabani Yonetimi', instructor: 'Prof. Dr. Fatma Ozturk', credits: 4, grade: 'AB', attendance: 100, color: '#14b8a6' },
          { code: 'BLM206', name: 'Isletim Sistemleri', instructor: 'Doc. Dr. Ayse Demir', credits: 3, grade: 'BA', attendance: 88, color: '#8b5cf6' },
          { code: 'BLM208', name: 'Bilgisayar Mimarisi', instructor: 'Dr. Serkan Acar', credits: 3, grade: 'BB', attendance: 91, color: '#ec4899' },
        ],
      },
    ],
  },
  {
    year: 3,
    semesters: [
      {
        semester: 1,
        courses: [
          { code: 'BLM305', name: 'Yazilim Muhendisligi', instructor: 'Dr. Mehmet Kaya', credits: 3, grade: '-', attendance: 92, color: '#ec4899' },
          { code: 'BLM307', name: 'Bilgisayar Aglari', instructor: 'Doc. Dr. Ali Can', credits: 3, grade: '-', attendance: 85, color: '#f59e0b' },
          { code: 'BLM309', name: 'Yapay Zeka', instructor: 'Prof. Dr. Selin Korkmaz', credits: 3, grade: '-', attendance: 90, color: '#6366f1' },
          { code: 'BLM311', name: 'Mobil Programlama', instructor: 'Dr. Oguz Tan', credits: 3, grade: '-', attendance: 95, color: '#14b8a6' },
        ],
      },
      {
        semester: 2,
        courses: [],
      },
    ],
  },
];

function getGradeColor(grade: string) {
  if (grade === 'AA' || grade === 'BA' || grade === 'AB') return '#22c55e';
  if (grade === 'BB') return '#6366f1';
  if (grade === 'CB' || grade === 'CC') return '#f59e0b';
  return '#9ca3af';
}

function getAttendanceColor(pct: number) {
  if (pct >= 90) return '#22c55e';
  if (pct >= 80) return '#f59e0b';
  return '#ef4444';
}

const yearColors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function CoursesScreen() {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  const [openYears, setOpenYears] = useState<Set<number>>(new Set());
  const [openSemesters, setOpenSemesters] = useState<Set<string>>(new Set());

  const toggleYear = (year: number) => {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleSemester = (key: string) => {
    setOpenSemesters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allCourses = curriculum.flatMap((y) => y.semesters.flatMap((s) => s.courses));
  const totalCredits = allCourses.reduce((sum, cr) => sum + cr.credits, 0);

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: c.background }]}>
      <RNView style={[styles.container, { backgroundColor: c.background }]}>
        {/* Summary */}
        <RNView style={styles.summaryCard}>
          <RNView style={styles.summaryItem}>
            <RNText style={styles.summaryValue}>{allCourses.length}</RNText>
            <RNText style={styles.summaryLabel}>Ders</RNText>
          </RNView>
          <RNView style={styles.divider} />
          <RNView style={styles.summaryItem}>
            <RNText style={styles.summaryValue}>{totalCredits}</RNText>
            <RNText style={styles.summaryLabel}>Kredi</RNText>
          </RNView>
          <RNView style={styles.divider} />
          <RNView style={styles.summaryItem}>
            <RNText style={styles.summaryValue}>3. Sinif</RNText>
            <RNText style={styles.summaryLabel}>Guz</RNText>
          </RNView>
        </RNView>

        {/* Year > Semester > Courses */}
        {curriculum.map((yearData) => {
          const yearOpen = openYears.has(yearData.year);
          const yColor = yearColors[yearData.year - 1];
          const totalYearCourses = yearData.semesters.reduce((s, sem) => s + sem.courses.length, 0);

          return (
            <RNView key={yearData.year} style={[styles.yearBox, { backgroundColor: c.card, borderColor: c.border }]}>
              {/* Year Header — Pressable */}
              <Pressable
                onPress={() => toggleYear(yearData.year)}
                style={[styles.yearHeader, { backgroundColor: yColor + '15' }]}
              >
                <FontAwesome name="graduation-cap" size={16} color={yColor} />
                <RNText style={[styles.yearTitle, { color: yColor }]}>
                  {yearData.year}. Sinif
                </RNText>
                <RNText style={[styles.yearCount, { color: yColor }]}>{totalYearCourses} ders</RNText>
                <FontAwesome
                  name={yearOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={yColor}
                />
              </Pressable>

              {/* Semesters — only when year is open */}
              {yearOpen && yearData.semesters.map((sem) => {
                const semKey = `${yearData.year}-${sem.semester}`;
                const semOpen = openSemesters.has(semKey);

                return (
                  <RNView key={sem.semester} style={styles.semesterBox}>
                    {/* Semester Header — Pressable */}
                    <Pressable
                      onPress={() => toggleSemester(semKey)}
                      style={[styles.semesterHeader, { borderBottomColor: c.border }]}
                    >
                      <RNView style={[styles.semesterDot, { backgroundColor: yColor }]} />
                      <RNText style={[styles.semesterTitle, { color: c.text }]}>
                        {sem.semester}. Donem {sem.semester === 1 ? '(Guz)' : '(Bahar)'}
                      </RNText>
                      <RNText style={[styles.semesterCount, { color: c.textMuted }]}>
                        {sem.courses.length} ders
                      </RNText>
                      <FontAwesome
                        name={semOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={c.textMuted}
                      />
                    </Pressable>

                    {/* Courses — only when semester is open */}
                    {semOpen && (
                      sem.courses.length === 0 ? (
                        <RNView style={styles.emptyState}>
                          <FontAwesome name="clock-o" size={16} color={c.textMuted} />
                          <RNText style={[styles.emptyText, { color: c.textMuted }]}>Henuz ders eklenmedi</RNText>
                        </RNView>
                      ) : (
                        sem.courses.map((course) => (
                          <RNView key={course.code} style={[styles.courseCard, { backgroundColor: c.background }]}>
                            <RNView style={styles.courseHeader}>
                              <RNView style={[styles.colorBar, { backgroundColor: course.color }]} />
                              <RNView style={styles.courseHeaderInfo}>
                                <RNText style={[styles.courseCode, { color: c.textSecondary }]}>{course.code}</RNText>
                                <RNText style={[styles.courseName, { color: c.text }]}>{course.name}</RNText>
                                <RNText style={[styles.instructor, { color: c.textMuted }]}>
                                  <FontAwesome name="user" size={11} color={c.textMuted} /> {course.instructor}
                                </RNText>
                              </RNView>
                              <RNView style={[styles.creditsBadge, { backgroundColor: c.border }]}>
                                <RNText style={[styles.creditsText, { color: c.textSecondary }]}>{course.credits} KR</RNText>
                              </RNView>
                            </RNView>

                            <RNView style={[styles.courseFooter, { borderTopColor: c.border }]}>
                              <RNView style={styles.footerItem}>
                                <RNText style={[styles.footerLabel, { color: c.textMuted }]}>Not</RNText>
                                <RNText style={[styles.footerValue, { color: getGradeColor(course.grade) }]}>
                                  {course.grade}
                                </RNText>
                              </RNView>
                              <RNView style={styles.footerItem}>
                                <RNText style={[styles.footerLabel, { color: c.textMuted }]}>Devam</RNText>
                                <RNText style={[styles.footerValue, { color: getAttendanceColor(course.attendance) }]}>
                                  %{course.attendance}
                                </RNText>
                              </RNView>
                            </RNView>
                          </RNView>
                        ))
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
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  summaryLabel: { fontSize: 12, color: '#c7d2fe', marginTop: 4 },
  divider: { width: 1, height: 32, backgroundColor: '#818cf8' },

  // Year box
  yearBox: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  yearTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  yearCount: { fontSize: 12, fontWeight: '500', marginRight: 4 },

  // Semester
  semesterBox: { paddingHorizontal: 12, paddingBottom: 4 },
  semesterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  semesterDot: { width: 8, height: 8, borderRadius: 4 },
  semesterTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  semesterCount: { fontSize: 12 },

  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  emptyText: { fontSize: 13 },

  // Course card
  courseCard: {
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  colorBar: { width: 4, height: 40, borderRadius: 2, marginRight: 10 },
  courseHeaderInfo: { flex: 1 },
  courseCode: { fontSize: 11, fontWeight: '600' },
  courseName: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  instructor: { fontSize: 11, marginTop: 3 },
  creditsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  creditsText: { fontSize: 11, fontWeight: '600' },
  courseFooter: { flexDirection: 'row', borderTopWidth: 1 },
  footerItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  footerLabel: { fontSize: 11 },
  footerValue: { fontSize: 13, fontWeight: '700' },
});
