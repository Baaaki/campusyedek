import { Routes, Route, Navigate } from 'react-router';
import { AdminLayout } from '@/components/layout/admin-layout';
import { StudentLayout } from '@/components/layout/student-layout';
import { TeacherLayout } from '@/components/layout/teacher-layout';
import { AuthGuard } from '@/components/auth-guard';

// Auth
import LoginPage from '@/pages/auth/login';
import ChangePasswordPage from '@/pages/auth/change-password';
import SessionsPage from '@/pages/auth/sessions';

// Admin
import DashboardPage from '@/pages/admin/dashboard';
import SettingsPage from '@/pages/admin/settings';
import AdminEnrollmentPage from '@/pages/admin/enrollment';
import StaffPage from '@/pages/admin/staff';
import StaffDetailsPage from '@/pages/admin/staff/personel-details';
import StudentsPage from '@/pages/admin/students';
import StudentPage from '@/pages/admin/students/student';
import StudentProfilePage from '@/pages/admin/students/student/profile';
import AdvisorsPage from '@/pages/admin/students/advisors';
import CatalogPage from '@/pages/admin/catalog';
import CatalogAddPage from '@/pages/admin/catalog/add';
import CatalogEditPage from '@/pages/admin/catalog/edit';
import CatalogSchedulePage from '@/pages/admin/catalog/schedule';
import SemesterCoursesPage from '@/pages/admin/semester-courses';
import SemesterCoursesListPage from '@/pages/admin/semester-courses/list';
import CafeteriasPage from '@/pages/admin/meal/cafeterias';
import MealAdminPage from '@/pages/admin/meal/admin';
import MenusPage from '@/pages/admin/meal/menus';
import MealStudentPage from '@/pages/admin/meal/student';
import TimeSettingsPage from '@/pages/admin/system/time';
import SemestersPage from '@/pages/admin/system/semesters';
import SemesterWizardPage from '@/pages/admin/system/semesters/new';
import AuditPage from '@/pages/admin/system/audit';
import AdminAttendancePage from '@/pages/admin/attendance';
import AdminAttendanceSessionPage from '@/pages/admin/attendance/sessionId';
import AdminGradesPage from '@/pages/admin/grades';

// Teacher
import TeacherAttendancePage from '@/pages/teacher/attendance';
import TeacherAttendanceCoursePage from '@/pages/teacher/attendance/courseId';
import TeacherAttendanceSessionPage from '@/pages/teacher/attendance/courseId/session/sessionId';
import TeacherEnrollmentPage from '@/pages/teacher/enrollment';
import TeacherGradesPage from '@/pages/teacher/grades';
import TeacherGradesCourseSlugPage from '@/pages/teacher/grades/courseId/slug';

// Student
import StudentDashboardPage from '@/pages/student/dashboard';
import StudentAttendancePage from '@/pages/student/attendance';
import StudentEnrollmentPage from '@/pages/student/enrollment';
import StudentEnrollmentRejectionsPage from '@/pages/student/enrollment/rejections';
import StudentGradesPage from '@/pages/student/grades';
import StudentCafeteriaPage from '@/pages/student/cafeteria';
import StudentCafeteriaMenuPage from '@/pages/student/cafeteria/menu';
import StudentCafeteriaHistoryPage from '@/pages/student/cafeteria/history';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth/login" replace />} />

      {/* Auth (public) */}
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/change-password" element={<ChangePasswordPage />} />
      <Route path="/auth/sessions" element={<SessionsPage />} />

      {/* Admin */}
      <Route element={<AuthGuard allowedRoles={['admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/enrollment" element={<AdminEnrollmentPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/staff/personel-details" element={<StaffDetailsPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/student" element={<StudentPage />} />
          <Route path="/students/student/profile" element={<StudentProfilePage />} />
          <Route path="/students/advisors" element={<AdvisorsPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/catalog/add" element={<CatalogAddPage />} />
          <Route path="/catalog/edit" element={<CatalogEditPage />} />
          <Route path="/catalog/schedule" element={<CatalogSchedulePage />} />
          <Route path="/semester-courses" element={<SemesterCoursesPage />} />
          <Route path="/semester-courses/list" element={<SemesterCoursesListPage />} />
          <Route path="/meal/cafeterias" element={<CafeteriasPage />} />
          <Route path="/meal/admin" element={<MealAdminPage />} />
          <Route path="/meal/menus" element={<MenusPage />} />
          <Route path="/meal/student" element={<MealStudentPage />} />
          <Route path="/attendance" element={<AdminAttendancePage />} />
          <Route path="/attendance/:sessionId" element={<AdminAttendanceSessionPage />} />
          <Route path="/grades" element={<AdminGradesPage />} />
          <Route path="/system/time" element={<TimeSettingsPage />} />
          <Route path="/system/semesters" element={<SemestersPage />} />
          <Route path="/system/semesters/new" element={<SemesterWizardPage />} />
          <Route path="/system/audit" element={<AuditPage />} />
        </Route>
      </Route>

      {/* Teacher */}
      <Route element={<AuthGuard allowedRoles={['teacher']} />}>
        <Route element={<TeacherLayout />}>
          <Route path="/teacher/attendance" element={<TeacherAttendancePage />} />
          <Route path="/teacher/attendance/:courseId" element={<TeacherAttendanceCoursePage />} />
          <Route path="/teacher/attendance/:courseId/session/:sessionId" element={<TeacherAttendanceSessionPage />} />
          <Route path="/teacher/enrollment" element={<TeacherEnrollmentPage />} />
          <Route path="/teacher/grades" element={<TeacherGradesPage />} />
          <Route path="/teacher/grades/:courseId/:slug" element={<TeacherGradesCourseSlugPage />} />
        </Route>
      </Route>

      {/* Student */}
      <Route element={<AuthGuard allowedRoles={['student']} />}>
        <Route element={<StudentLayout />}>
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/student/attendance" element={<StudentAttendancePage />} />
          <Route path="/student/enrollment" element={<StudentEnrollmentPage />} />
          <Route path="/student/enrollment/rejections" element={<StudentEnrollmentRejectionsPage />} />
          <Route path="/student/grades" element={<StudentGradesPage />} />
          <Route path="/student/cafeteria" element={<StudentCafeteriaPage />} />
          <Route path="/student/cafeteria/menu" element={<StudentCafeteriaMenuPage />} />
          <Route path="/student/cafeteria/history" element={<StudentCafeteriaHistoryPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}
