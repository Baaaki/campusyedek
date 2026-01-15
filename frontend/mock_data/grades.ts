import { MyGradesResponse, TranscriptResponse } from '@/lib/types';

// Mock My Grades Response (from grades-service)
export const mockMyGradesResponse: MyGradesResponse = {
  student_id: '550e8400-e29b-41d4-a716-446655440005',
  student_number: '20210101001',
  active_courses: [
    {
      course_code: 'BİL 3001-1',
      course_name: 'Veri Yapıları ve Algoritmalar',
      semester: '2025-fall',
      credits: 4,
      scores: {
        midterm1: { score: 75, is_absent: false },
        midterm2: { score: 82, is_absent: false },
        final: { score: null, is_absent: false }, // Not yet taken
        project: { score: 90, is_absent: false },
      },
    },
    {
      course_code: 'BİL 3002-1',
      course_name: 'Veritabanı Sistemleri',
      semester: '2025-fall',
      credits: 4,
      scores: {
        midterm: { score: 80, is_absent: false },
        final: { score: null, is_absent: false },
        homework: { score: 95, is_absent: false },
      },
    },
    {
      course_code: 'BİL 3003-1',
      course_name: 'İşletim Sistemleri',
      semester: '2025-fall',
      credits: 4,
      scores: {
        midterm: { score: 70, is_absent: false },
        final: { score: null, is_absent: false },
        lab: { score: 85, is_absent: false },
      },
    },
  ],
  completed_courses: [
    {
      course_code: 'BİL 2001',
      course_name: 'Nesne Yönelimli Programlama',
      semester: '2024-spring',
      credits: 4,
      weighted_average: 88.1,
      grade_point: 'BA',
    },
    {
      course_code: 'MAT 2001',
      course_name: 'Diferansiyel Denklemler',
      semester: '2024-spring',
      credits: 4,
      weighted_average: 75.5,
      grade_point: 'BB',
    },
    {
      course_code: 'BİL 1001',
      course_name: 'Programlama Temelleri',
      semester: '2023-fall',
      credits: 4,
      weighted_average: 92.6,
      grade_point: 'AA',
    },
    {
      course_code: 'MAT 1001',
      course_name: 'Matematik I',
      semester: '2023-fall',
      credits: 4,
      weighted_average: 78.0,
      grade_point: 'BB',
    },
    {
      course_code: 'FİZ 1001',
      course_name: 'Fizik I',
      semester: '2023-fall',
      credits: 4,
      weighted_average: 82.5,
      grade_point: 'BA',
    },
  ],
  cumulative_gpa: 3.42,
  total_credits: 32, // 8 completed courses * 4 credits
};

// Mock Transcript Response (from grades-service)
export const mockTranscriptResponse: TranscriptResponse = {
  student: {
    student_number: '20210101001',
    first_name: 'Ali',
    last_name: 'Çelik',
    department: 'Bilgisayar Mühendisliği',
    enrollment_year: 2021,
  },
  semesters: [
    {
      semester: '2023-fall',
      semester_display: '2023-2024 Güz',
      courses: [
        {
          course_code: 'BİL 1001',
          course_name: 'Programlama Temelleri',
          credits: 4,
          grade_point: 'AA',
        },
        {
          course_code: 'MAT 1001',
          course_name: 'Matematik I',
          credits: 4,
          grade_point: 'BB',
        },
        {
          course_code: 'FİZ 1001',
          course_name: 'Fizik I',
          credits: 4,
          grade_point: 'BA',
        },
        {
          course_code: 'ING 1001',
          course_name: 'İngilizce I',
          credits: 3,
          grade_point: 'AA',
        },
      ],
      semester_credits: 15,
      semester_gpa: 3.62,
    },
    {
      semester: '2024-spring',
      semester_display: '2023-2024 Bahar',
      courses: [
        {
          course_code: 'BİL 2001',
          course_name: 'Nesne Yönelimli Programlama',
          credits: 4,
          grade_point: 'BA',
        },
        {
          course_code: 'MAT 2001',
          course_name: 'Diferansiyel Denklemler',
          credits: 4,
          grade_point: 'BB',
        },
        {
          course_code: 'FİZ 2001',
          course_name: 'Fizik II',
          credits: 4,
          grade_point: 'BA',
        },
        {
          course_code: 'ING 2001',
          course_name: 'İngilizce II',
          credits: 3,
          grade_point: 'AA',
        },
      ],
      semester_credits: 15,
      semester_gpa: 3.37,
    },
    {
      semester: '2024-fall',
      semester_display: '2024-2025 Güz',
      courses: [
        {
          course_code: 'BİL 2101',
          course_name: 'Discrete Mathematics',
          credits: 4,
          grade_point: 'BB',
        },
        {
          course_code: 'BİL 2102',
          course_name: 'Digital Logic Design',
          credits: 4,
          grade_point: 'BA',
        },
      ],
      semester_credits: 8,
      semester_gpa: 3.25,
    },
  ],
  summary: {
    total_credits: 38,
    cumulative_gpa: 3.42,
  },
  generated_at: new Date().toISOString(),
};

// Letter grade mapping helper
export const letterGradeMap: Record<string, { min: number; max: number; points: number }> = {
  'AA': { min: 90, max: 100, points: 4.0 },
  'BA': { min: 85, max: 89, points: 3.5 },
  'BB': { min: 75, max: 84, points: 3.0 },
  'CB': { min: 70, max: 74, points: 2.5 },
  'CC': { min: 60, max: 69, points: 2.0 },
  'DC': { min: 55, max: 59, points: 1.5 },
  'DD': { min: 50, max: 54, points: 1.0 },
  'FD': { min: 40, max: 49, points: 0.5 },
  'FF': { min: 0, max: 39, points: 0.0 },
};
