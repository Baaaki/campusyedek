import { gradesApiSafe, enrollmentApiSafe, mealApiSafe, catalogApiSafe, authApiSafe, attendanceApiSafe, studentApiSafe, staffApiSafe } from '@/lib/api-client';
import type {
  TimeStatus,
  ServiceTimeStatus,
  AcademicPeriod,
  SimplePeriod,
  CreatePeriodRequest,
  SimpleCreatePeriodRequest,
  UpdatePeriodRequest,
  ClosedDay,
  CreateClosedDayRequest,
  Semester,
  CreateSemesterRequest,
  AuditLogEntry,
  AuditLogListResponse,
} from '@/lib/types';

export type ServiceKey = 'grades' | 'enrollment' | 'meal' | 'catalog' | 'auth' | 'attendance' | 'student' | 'staff';

interface ServiceConfig {
  label: string;
  timePath: string;
  api: typeof gradesApiSafe;
}

const SERVICES: Record<ServiceKey, ServiceConfig> = {
  grades: { label: 'Notlar', timePath: 'admin/time', api: gradesApiSafe },
  enrollment: { label: 'Kayıt', timePath: 'admin/time', api: enrollmentApiSafe },
  meal: { label: 'Yemekhane', timePath: 'time', api: mealApiSafe },
  catalog: { label: 'Ders Kataloğu', timePath: 'admin/time', api: catalogApiSafe },
  auth: { label: 'Kimlik Doğrulama', timePath: 'admin/time', api: authApiSafe },
  attendance: { label: 'Yoklama', timePath: 'admin/time', api: attendanceApiSafe },
  student: { label: 'Öğrenci', timePath: 'admin/time', api: studentApiSafe },
  staff: { label: 'Personel', timePath: 'admin/time', api: staffApiSafe },
};

export const SERVICE_KEYS: ServiceKey[] = ['grades', 'enrollment', 'meal', 'catalog', 'auth', 'attendance', 'student', 'staff'];

export function getServiceLabel(key: ServiceKey): string {
  return SERVICES[key].label;
}

const MOCK_DELAY = () => new Promise(resolve => setTimeout(resolve, 300));

// ============================================================================
// MOCK DATA
// ============================================================================

export async function getAllTimeStatuses(): Promise<ServiceTimeStatus[]> {
  await MOCK_DELAY();
  return SERVICE_KEYS.map(key => ({
    service: key,
    label: SERVICES[key].label,
    status: { current_time: new Date().toISOString() },
    error: null,
  }));
}

export async function simulateTimeAll(time: string): Promise<{ success: string[]; failed: string[] }> {
  await MOCK_DELAY();
  return { success: SERVICE_KEYS.map(k => SERVICES[k].label), failed: [] };
}

export async function resetTimeAll(): Promise<{ success: string[]; failed: string[] }> {
  await MOCK_DELAY();
  return { success: SERVICE_KEYS.map(k => SERVICES[k].label), failed: [] };
}

// Grades Periods
export async function listGradesPeriods(semester?: string): Promise<AcademicPeriod[]> {
  await MOCK_DELAY();
  return [
    { id: 'gp1', semester: semester || '2024-2025-Fall', period_start: new Date(Date.now() - 86400000).toISOString(), period_end: new Date(Date.now() + 86400000 * 14).toISOString(), is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), course_id: 'CS101-UUID' },
    { id: 'gp2', semester: semester || '2024-2025-Fall', period_start: new Date(Date.now() - 86400000 * 5).toISOString(), period_end: new Date(Date.now() - 86400000 * 1).toISOString(), is_active: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];
}
export async function createGradesPeriod(data: CreatePeriodRequest): Promise<AcademicPeriod> { await MOCK_DELAY(); return { id: 'new', ...data, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as AcademicPeriod; }
export async function updateGradesPeriod() { await MOCK_DELAY(); return {} as AcademicPeriod; }
export async function deleteGradesPeriod() { await MOCK_DELAY(); }

// Simple Periods
export type SimplePeriodServiceKey = 'enrollment' | 'catalog';
export async function listSimplePeriods(service: SimplePeriodServiceKey, semester?: string): Promise<SimplePeriod[]> {
  await MOCK_DELAY();
  return [
    { id: 'sp1', semester: semester || '2024-2025-Fall', period_start: new Date(Date.now() - 86400000 * 10).toISOString(), period_end: new Date(Date.now() + 86400000 * 20).toISOString(), is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];
}
export async function createSimplePeriod(service: SimplePeriodServiceKey, data: SimpleCreatePeriodRequest): Promise<SimplePeriod> { await MOCK_DELAY(); return { id: 'new', ...data, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as SimplePeriod; }
export async function updateSimplePeriod() { await MOCK_DELAY(); return {} as SimplePeriod; }
export async function deleteSimplePeriod() { await MOCK_DELAY(); }

// Closed Days
export async function listClosedDays(): Promise<ClosedDay[]> {
  await MOCK_DELAY();
  return [
    { id: 'cd1', date: '2025-01-01', reason: 'Yılbaşı Tatili', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cd2', date: '2025-10-29', reason: 'Cumhuriyet Bayramı', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];
}
export async function createClosedDay(data: CreateClosedDayRequest): Promise<ClosedDay> { await MOCK_DELAY(); return { id: 'new', ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
export async function deleteClosedDay() { await MOCK_DELAY(); }

// Semesters
export async function listSemesters(): Promise<Semester[]> {
  return catalogApiSafe.get('admin/semesters').json<Semester[]>();
}

export async function createSemester(data: CreateSemesterRequest): Promise<Semester> {
  return catalogApiSafe.post('admin/semesters', { json: data }).json<Semester>();
}

export async function getActiveSemester(): Promise<Semester | null> {
  try {
    return await catalogApiSafe.get('admin/semesters/active').json<Semester>();
  } catch {
    return null;
  }
}

export async function activateSemester(id: string): Promise<Semester> {
  return catalogApiSafe.put(`admin/semesters/${id}/activate`).json<Semester>();
}

export async function completeSemester(id: string): Promise<Semester> {
  return catalogApiSafe.put(`admin/semesters/${id}/complete`).json<Semester>();
}

// Audit Log Filters
export interface AuditLogFilters {
  service?: string; action?: string; actor_id?: string; limit?: number; offset?: number;
}
export async function listAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogListResponse> {
  await MOCK_DELAY();
  const entries: AuditLogEntry[] = [
    { id: 'aud1', timestamp: new Date(Date.now() - 3600000).toISOString(), service: 'catalog', action: 'semester.activated', resource_type: 'semester', resource_id: 'sem2', actor_role: 'admin', actor_id: 'admin-123', details: { note: 'Mock data' } },
    { id: 'aud2', timestamp: new Date(Date.now() - 7200000).toISOString(), service: 'grades', action: 'period.created', resource_type: 'period', resource_id: 'gp1', actor_role: 'admin', actor_id: 'admin-123', details: { course_id: 'CS101' } },
    { id: 'aud3', timestamp: new Date(Date.now() - 86400000).toISOString(), service: 'meal', action: 'closed_day.created', resource_type: 'meal', resource_id: 'cd1', actor_role: 'admin', actor_id: 'admin-456', details: { date: '2025-01-01' } },
  ];
  return { entries, total: 3 };
}
