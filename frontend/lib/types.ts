// Common types used across the application

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  department?: string;
}

export interface AuthResponse {
  access_token: string;
  expires_in: number;
  user: User;
  force_password_change: boolean;
  message?: string;
}

export interface Session {
  id: string;
  device_info?: string;
  ip_address?: string;
  created_at: string;
  last_used_at: string;
  is_current: boolean;
}

// Staff types
export interface Staff {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  faculty?: string;
  department?: string;
  phone?: string;
  office_location?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Student types
export interface Student {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  email: string;
  faculty: string;
  department: string;
  enrollment_year: number;
  class_level: number;
  advisor_id?: string | null;
  advisor?: AdvisorInfo;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AdvisorInfo {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

// Course Catalog types
export interface WeeklyTopic {
  week: number;
  topic: string;
  description?: string;
}

export interface CourseCoordinator {
  title: string;
  name: string;
  email?: string;
  phone?: string;
  office?: string;
}

export interface CourseCatalog {
  id: string;
  course_code: string;
  name: string;
  faculty: string;
  department: string;
  offering_unit?: string; // Dersi veren birim
  class_level: number;
  semester?: number;
  credits: number;
  theoretical_hours: number;
  practical_hours: number;
  lab_hours?: number;
  ects?: number;
  course_type: string;
  education_level?: string; // Lisans, Yüksek Lisans, vb.
  teaching_type?: string; // Örgün Öğretim, Uzaktan Öğretim, vb.
  language?: string; // Türkçe, İngilizce, vb.
  coordinator?: CourseCoordinator;
  purpose?: string; // Dersin amacı
  learning_outcomes_list?: string[]; // Öğrenme kazanımları listesi
  weekly_topics?: WeeklyTopic[]; // Haftalık konular
  recommended_sources?: string[]; // Önerilen kaynaklar
  prerequisites: Prerequisite[];
  description?: string;
  learning_outcomes?: string;
  syllabus?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Faculty type
export interface Faculty {
  id: string;
  name: string;
  code: string;
  departments: Department[];
}

// Department type
export interface Department {
  id: string;
  name: string;
  facultyId: string;
  code: string;
  description?: string;
}

export interface Prerequisite {
  id: string;
  course_code: string;
  course_name: string;
}

export interface ScheduleSession {
  day: number;
  slot: number;
}

export interface AvailableCourse {
  id: string;
  course_code: string;
  course_name: string;
  credits: number;
  schedule_sessions: ScheduleSession[];
  max_capacity: number;
  current_enrollment: number;
  available_seats: number;
  instructor: string;
}

export interface CourseBasic {
  id: string;
  course_code: string;
  course_name: string;
  credits: number;
}

// Enrollment types
export interface EnrollmentProgram {
  id: string;
  student_id: string;
  semester: string;
  status: string;
  courses: CourseBasic[];
  created_at: string;
}

export interface RejectedCourseDetail {
  course_id: string;
  course_code: string;
  course_name: string;
  credits: number;
  instructor: string;
}

export interface RejectedCoursesData {
  courses: RejectedCourseDetail[];
  total_credits: number;
  submitted_at: string;
}

export interface RejectionDetail {
  id: string;
  advisor_id: string;
  advisor_fullname: string;
  rejection_reason: string;
  rejected_courses: RejectedCoursesData;
  rejected_at: string;
}

// Attendance types
export interface QRPayload {
  sid: string;
  ts: number;
  sig: string;
}

export interface SessionListItem {
  session_id?: string;
  week_number: number;
  session_date?: string;
  present_count?: number;
  absent_count?: number;
  is_active?: boolean;
  status?: string;
}

export interface WeeklyAttendanceRecord {
  week: number;
  date: string;
  is_present: boolean;
  marked_via: string;
  note?: string;
}

export interface CourseAttendanceDetail {
  course_id: string;
  course_code: string;
  course_name: string;
  instructor: string;
  total_weeks: number;
  completed_weeks: number;
  present_count: number;
  absent_count: number;
  absent_weeks: number[];
  weekly_records: WeeklyAttendanceRecord[];
}

export interface MyAttendanceResponse {
  student_id: string;
  student_number: string;
  semester: string;
  courses: CourseAttendanceDetail[];
}

// Grades types
export interface ScoreDetail {
  score: number | null;
  is_absent: boolean;
}

export interface ActiveCourse {
  course_code: string;
  course_name: string;
  semester: string;
  credits: number;
  scores: Record<string, ScoreDetail>;
}

export interface CompletedCourse {
  course_code: string;
  course_name: string;
  semester: string;
  credits: number;
  weighted_average: number;
  grade_point: string;
}

export interface MyGradesResponse {
  student_id: string;
  student_number: string;
  active_courses: ActiveCourse[];
  completed_courses: CompletedCourse[];
  cumulative_gpa: number;
  total_credits: number;
}

export interface StudentInfo {
  student_number: string;
  first_name: string;
  last_name: string;
  department: string;
  enrollment_year: number;
}

export interface CourseGrade {
  course_code: string;
  course_name: string;
  credits: number;
  grade_point: string;
}

export interface SemesterGrades {
  semester: string;
  semester_display: string;
  courses: CourseGrade[];
  semester_credits: number;
  semester_gpa: number;
}

export interface TranscriptSummary {
  total_credits: number;
  cumulative_gpa: number;
}

export interface TranscriptResponse {
  student: StudentInfo;
  semesters: SemesterGrades[];
  summary: TranscriptSummary;
  generated_at: string;
}

// Meal service types
export interface Cafeteria {
  id: string;
  name: string;
  location: string;
  has_vegan_menu: boolean;
  serves_dinner: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CafeteriaInfo {
  id: string;
  name: string;
  location: string;
}

export interface ReservationResponse {
  id: string;
  date: string;
  meal_time: string;
  menu_type: string;
  cafeteria_name: string;
  cafeteria?: CafeteriaInfo;
  status: string;
  is_used: boolean;
  created_at: string;
}

export interface ReservationSummary {
  total: number;
  confirmed: number;
  pending: number;
  used: number;
  cancelled: number;
}

export interface MyReservationsResponse {
  reservations: ReservationResponse[];
  summary: ReservationSummary;
}

export interface ValidTimeWindow {
  start: string;
  end: string;
}

export interface QRResponse {
  cafeteria_id: string;
  cafeteria_name: string;
  date: string;
  meal_time: string;
  qr_payload: string;
  valid_time_window: ValidTimeWindow;
}

// Menu types
export interface MenuItem {
  name: string;
  calories?: number;
}

export interface DailyMenu {
  id: string;
  cafeteria_id: string;
  cafeteria_name?: string;
  date: string;
  meal_time: 'lunch' | 'dinner';
  menu_type: 'normal' | 'vegan' | 'diet';
  items: MenuItem[];
  created_at: string;
  updated_at: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Semester Course types (Dönemlik Açılan Dersler)
export interface ScheduleSessionDTO {
  day_of_week: string; // 'monday', 'tuesday', etc.
  slot_numbers: number[]; // [1, 2] for 1st and 2nd slots
}

export interface AssessmentItem {
  slug: string; // 'midterm', 'final', 'quiz', 'homework', 'project', etc.
  name: string; // 'Vize', 'Final', 'Quiz', 'Ödev', 'Proje', etc.
  weight: number; // 0-100
}

export interface CreateSemesterCourseRequest {
  course_code: string;
  class_level: number;
  instructor_id: string;
  instructor_fullname: string;
  classroom_location: string;
  max_capacity: number;
  assessment_schema: AssessmentItem[];
  schedule_sessions: ScheduleSessionDTO[];
}

export interface SemesterCourse {
  id: string;
  semester: string;
  course_code: string;
  course_name: string;
  credits: number;
  class_level: number;
  instructor_id: string;
  instructor_fullname: string;
  classroom_location: string;
  max_capacity: number;
  assessment_schema: AssessmentItem[];
  schedule_sessions: ScheduleSessionDTO[];
  prerequisites?: Prerequisite[];
  created_at: string;
  updated_at: string;
}
