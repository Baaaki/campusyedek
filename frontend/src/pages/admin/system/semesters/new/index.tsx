import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  AlertCircle,
  BookOpen,
  ExternalLink,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Toast from '@/components/enrollment/Toast';

import type { Semester, SemesterPeriods, SemesterCourse } from '@/lib/types';
import { semesterApi } from '@/lib/api-client';
import { createSemester, activateSemester } from '@/lib/services/system-service';

const STEPS = [
  { label: 'Dönem Bilgileri', icon: CalendarRange },
  { label: 'Servis Tarihleri', icon: Clock },
  { label: 'Ders Ekleme', icon: BookOpen },
  { label: 'Önizleme', icon: CheckCircle2 },
];

const PERIOD_SERVICES = [
  { key: 'catalog' as const, label: 'Ders Açma (Katalog)', description: 'Dönemlik ders açılış dönemi' },
  { key: 'enrollment' as const, label: 'Ders Kayıt', description: 'Öğrenci ders kayıt dönemi' },
  { key: 'grading' as const, label: 'Not Giriş', description: 'Hoca not giriş dönemi' },
  { key: 'attendance' as const, label: 'Yoklama', description: 'Yoklama alma dönemi' },
];

const dayToTurkish: Record<string, string> = {
  monday: 'Pzt', tuesday: 'Sal', wednesday: 'Çar',
  thursday: 'Per', friday: 'Cum',
};

interface SemesterCoursesResponse {
  data: SemesterCourse[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

// Wizard executes 3 separate API calls (not one atomic call):
// 1. POST /semesters — create semester + distribute periods
// 2. POST /semesters/:s/courses — add each course (existing page handles this)
// 3. PUT /semesters/:id/activate — activate semester
//
// Why separate calls instead of one atomic endpoint?
// Future extensibility: when department_head role is added,
// step 2 will be done by department heads (not admin).
// See: docs/semester-wizard-plan.md "Gelecek Uyumluluk"

export default function SemesterWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1: Semester info
  const [semesterName, setSemesterName] = useState('');
  const [hardDeadline, setHardDeadline] = useState('');

  // Step 2: Periods
  const [periods, setPeriods] = useState<{
    catalog: { start: string; end: string };
    enrollment: { start: string; end: string };
    grading: { start: string; end: string };
    attendance: { start: string; end: string };
  }>({
    catalog: { start: '', end: '' },
    enrollment: { start: '', end: '' },
    grading: { start: '', end: '' },
    attendance: { start: '', end: '' },
  });

  // Step 3: Courses (fetched from API after semester creation)
  const [courses, setCourses] = useState<SemesterCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Created semester reference
  const [createdSemester, setCreatedSemester] = useState<Semester | null>(null);

  // Loading & UI state
  const [loading, setLoading] = useState(false);
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'error' | 'warning' | 'success' | 'info';
    isVisible: boolean;
  }>({ message: '', type: 'info', isVisible: false });

  const showToast = useCallback((message: string, type: 'error' | 'warning' | 'success' | 'info') => {
    setToast({ message, type, isVisible: true });
  }, []);

  // Semester name suggestions
  const year = new Date().getFullYear();
  const suggestions = [
    `${year - 1}-${year}-Spring`,
    `${year}-${year + 1}-Fall`,
    `${year}-${year + 1}-Spring`,
  ];

  // Validation
  const isStep1Valid = useMemo(() => {
    return /^\d{4}-\d{4}-(Fall|Spring)$/.test(semesterName) && hardDeadline !== '';
  }, [semesterName, hardDeadline]);

  const isStep2Valid = useMemo(() => {
    const deadline = hardDeadline ? new Date(hardDeadline) : null;
    if (!deadline) return false;

    for (const svc of PERIOD_SERVICES) {
      const p = periods[svc.key];
      if (!p.start || !p.end) return false;
      if (new Date(p.start) >= new Date(p.end)) return false;
      if (new Date(p.end) > deadline) return false;
    }
    return true;
  }, [periods, hardDeadline]);

  // Fetch courses for the created semester
  const fetchCourses = useCallback(async () => {
    if (!createdSemester) return;
    setCoursesLoading(true);
    try {
      const response = await semesterApi
        .get(`${createdSemester.name}/courses`, { searchParams: { limit: 200 } })
        .json<SemesterCoursesResponse>();
      setCourses(response.data || []);
    } catch {
      showToast('Ders listesi yüklenemedi', 'error');
    } finally {
      setCoursesLoading(false);
    }
  }, [createdSemester, showToast]);

  // Handle semester creation (after Step 2)
  const handleCreateSemester = async () => {
    setLoading(true);
    try {
      const periodsPayload: SemesterPeriods = {};
      for (const svc of PERIOD_SERVICES) {
        const p = periods[svc.key];
        if (p.start && p.end) {
          periodsPayload[svc.key] = {
            start: new Date(p.start).toISOString(),
            end: new Date(p.end).toISOString(),
          };
        }
      }

      const semester = await createSemester({
        name: semesterName,
        hard_deadline: new Date(hardDeadline).toISOString(),
        periods: periodsPayload,
      });

      setCreatedSemester(semester);
      showToast('Dönem ve servis tarihleri başarıyla oluşturuldu', 'success');
      setStep(2);
    } catch (err: any) {
      let message = 'Dönem oluşturulamadı';
      try {
        const body = await err.response?.json();
        if (body?.error) message = body.error;
      } catch { /* ignore */ }
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle activation (Step 4)
  // INVARIANT: Only one semester can be active at any given time.
  // Backend returns ACTIVE_SEMESTER_EXISTS (409) if another semester is already active.
  // The error message is displayed to the user via showToast.
  const handleActivate = async () => {
    if (!createdSemester) return;
    setLoading(true);
    try {
      await activateSemester(createdSemester.id);
      showToast('Dönem başarıyla aktifleştirildi!', 'success');
      setTimeout(() => navigate('/system/semesters'), 1500);
    } catch (err: any) {
      let message = 'Dönem aktifleştirilemedi';
      try {
        const body = await err.response?.json();
        if (body?.error) message = body.error;
      } catch { /* ignore */ }
      showToast(message, 'error');
    } finally {
      setLoading(false);
      setActivateConfirmOpen(false);
    }
  };

  // Navigation
  const canGoNext = () => {
    if (step === 0) return isStep1Valid;
    if (step === 1) return isStep2Valid;
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !createdSemester) {
      handleCreateSemester();
      return;
    }
    if (step === 2) {
      fetchCourses();
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/system/semesters')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Geri
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Yeni Dönem Wizard'ı</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Dönem oluşturma, tarih belirleme ve ders açılışını tek akışta yapın
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isCompleted = i < step;
          return (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-300 dark:border-indigo-700'
                    : isCompleted
                      ? 'bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-700'
                      : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <div className="hidden md:block">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {step === 0 && (
        <StepSemesterInfo
          semesterName={semesterName}
          setSemesterName={setSemesterName}
          hardDeadline={hardDeadline}
          setHardDeadline={setHardDeadline}
          suggestions={suggestions}
        />
      )}

      {step === 1 && (
        <StepPeriods
          periods={periods}
          setPeriods={setPeriods}
          hardDeadline={hardDeadline}
        />
      )}

      {step === 2 && (
        <StepCourses
          semesterName={createdSemester?.name || semesterName}
          courses={courses}
          loading={coursesLoading}
          onRefresh={fetchCourses}
        />
      )}

      {step === 3 && (
        <StepPreview
          semesterName={semesterName}
          hardDeadline={hardDeadline}
          periods={periods}
          courses={courses}
          coursesLoading={coursesLoading}
          onRefreshCourses={fetchCourses}
        />
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0 || loading}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>

        <div className="flex gap-2">
          {step === 3 ? (
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/system/semesters')}
              >
                Daha Sonra Aktifleştir
              </Button>
              <Button
                onClick={() => setActivateConfirmOpen(true)}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <Play className="h-4 w-4 mr-2" />
                Dönemi Aktifleştir
              </Button>
            </>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canGoNext() || loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {step === 1 && !createdSemester ? 'Dönemi Oluştur ve Devam Et' : 'Devam Et'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Activate Confirmation */}
      <AlertDialog open={activateConfirmOpen} onOpenChange={setActivateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dönemi Aktifleştir</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{semesterName}</strong> dönemini aktifleştirmek istediğinize emin misiniz?
              <span className="block mt-2 text-amber-600 font-medium">
                Aktifleştirmeden sonra dönemlik ders yapısı donar. Ders ekleme/silme/değiştirme yapılamaz.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActivate}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Aktifleştir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
        duration={5000}
      />
    </div>
  );
}

// ============================================================================
// Step 1: Semester Info
// ============================================================================

function StepSemesterInfo({
  semesterName,
  setSemesterName,
  hardDeadline,
  setHardDeadline,
  suggestions,
}: {
  semesterName: string;
  setSemesterName: (v: string) => void;
  hardDeadline: string;
  setHardDeadline: (v: string) => void;
  suggestions: string[];
}) {
  const isNameValid = /^\d{4}-\d{4}-(Fall|Spring)$/.test(semesterName);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5" />
          Dönem Bilgileri
        </CardTitle>
        <CardDescription>
          Yeni dönemin adını ve son geçerlilik tarihini belirleyin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Dönem Adı *</Label>
          <Input
            placeholder="2025-2026-Fall"
            value={semesterName}
            onChange={(e) => setSemesterName(e.target.value)}
          />
          <div className="flex gap-1 flex-wrap">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSemesterName(s)}
                className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              >
                {s}
              </button>
            ))}
          </div>
          {semesterName && !isNameValid && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Format: YYYY-YYYY-Fall veya YYYY-YYYY-Spring
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Hard Deadline (Son Geçerlilik) *</Label>
          <Input
            type="datetime-local"
            value={hardDeadline}
            onChange={(e) => setHardDeadline(e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bu tarihten sonra dönem otomatik olarak kilitlenir. Kimse (admin dahil) veri değiştiremez.
          </p>
        </div>

        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Hard deadline, dönemin mutlak kilit tarihidir. Bu tarihten sonra not, yoklama, kayıt dahil hiçbir veri değiştirilemez.
            Admin bile müdahale edemez.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Step 2: Service Periods
// ============================================================================

function StepPeriods({
  periods,
  setPeriods,
  hardDeadline,
}: {
  periods: Record<string, { start: string; end: string }>;
  setPeriods: (v: any) => void;
  hardDeadline: string;
}) {
  const deadline = hardDeadline ? new Date(hardDeadline) : null;

  const updatePeriod = (key: string, field: 'start' | 'end', value: string) => {
    setPeriods((prev: any) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Servis Tarih Aralıkları
        </CardTitle>
        <CardDescription>
          Her servisin çalışma dönemini belirleyin. Bitiş tarihleri hard deadline'ı ({deadline ? format(deadline, 'dd MMM yyyy', { locale: tr }) : '—'}) aşamaz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PERIOD_SERVICES.map((svc) => {
          const p = periods[svc.key];
          const endExceedsDeadline = deadline && p.end && new Date(p.end) > deadline;
          const startAfterEnd = p.start && p.end && new Date(p.start) >= new Date(p.end);

          return (
            <div
              key={svc.key}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">{svc.label}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{svc.description}</p>
                </div>
                {p.start && p.end && !endExceedsDeadline && !startAfterEnd && (
                  <Badge variant="outline" className="border-green-500 text-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Geçerli
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Başlangıç</Label>
                  <Input
                    type="datetime-local"
                    value={p.start}
                    onChange={(e) => updatePeriod(svc.key, 'start', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bitiş</Label>
                  <Input
                    type="datetime-local"
                    value={p.end}
                    onChange={(e) => updatePeriod(svc.key, 'end', e.target.value)}
                  />
                </div>
              </div>
              {endExceedsDeadline && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Bitiş tarihi hard deadline'ı aşamaz
                </p>
              )}
              {startAfterEnd && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Başlangıç tarihi bitiş tarihinden önce olmalıdır
                </p>
              )}
            </div>
          );
        })}

        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            "Devam Et" butonuna basıldığında dönem ve tüm period'lar oluşturulacaktır.
            Oluşturulduktan sonra dönem adı ve hard deadline değiştirilemez.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Step 3: Course Addition (delegates to existing page)
// ============================================================================

function StepCourses({
  semesterName,
  courses,
  loading,
  onRefresh,
}: {
  semesterName: string;
  courses: SemesterCourse[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Dönemlik Ders Ekleme
            </CardTitle>
            <CardDescription>
              <strong>{semesterName}</strong> dönemine ders ekleyin
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              asChild
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <a href="/semester-courses" target="_blank" rel="noopener noreferrer">
                <Plus className="h-4 w-4 mr-2" />
                Ders Ekle
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 mb-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            "Ders Ekle" butonuna tıklayarak mevcut ders açma sayfasında derslerinizi ekleyin.
            Ders ekledikten sonra bu sayfada "Yenile" butonuna basarak listeyi güncelleyin.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Henüz ders eklenmemiş</p>
            <p className="text-sm mt-1">Yukarıdaki "Ders Ekle" butonunu kullanarak ders ekleyin</p>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <Badge variant="outline" className="text-indigo-600 border-indigo-300">
                {courses.length} ders eklendi
              </Badge>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ders Kodu</TableHead>
                    <TableHead>Ders Adı</TableHead>
                    <TableHead>Öğretim Üyesi</TableHead>
                    <TableHead>Derslik</TableHead>
                    <TableHead className="text-center">Kontenjan</TableHead>
                    <TableHead>Program</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.course_code}</TableCell>
                      <TableCell>{course.course_name}</TableCell>
                      <TableCell>{course.instructor_fullname}</TableCell>
                      <TableCell>{course.classroom_location}</TableCell>
                      <TableCell className="text-center">{course.max_capacity}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {course.schedule_sessions?.map((session) =>
                            session.slot_numbers.map((slot) => (
                              <Badge
                                key={`${session.day_of_week}-${slot}`}
                                variant="secondary"
                                className={`text-[10px] ${
                                  session.session_type === 'lab'
                                    ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                    : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200'
                                }`}
                              >
                                {dayToTurkish[session.day_of_week] || session.day_of_week} {slot}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Step 4: Preview & Activate
// ============================================================================

function StepPreview({
  semesterName,
  hardDeadline,
  periods,
  courses,
  coursesLoading,
  onRefreshCourses,
}: {
  semesterName: string;
  hardDeadline: string;
  periods: Record<string, { start: string; end: string }>;
  courses: SemesterCourse[];
  coursesLoading: boolean;
  onRefreshCourses: () => void;
}) {
  const deadline = new Date(hardDeadline);

  return (
    <div className="space-y-4">
      {/* Semester Info Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarRange className="h-5 w-5" />
            Dönem Özeti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Dönem Adı</span>
              <p className="font-medium text-lg">{semesterName}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Hard Deadline</span>
              <p className="font-medium text-lg">
                {format(deadline, 'dd MMMM yyyy HH:mm', { locale: tr })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Periods Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Servis Tarih Aralıkları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servis</TableHead>
                  <TableHead>Başlangıç</TableHead>
                  <TableHead>Bitiş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERIOD_SERVICES.map((svc) => {
                  const p = periods[svc.key];
                  return (
                    <TableRow key={svc.key}>
                      <TableCell className="font-medium">{svc.label}</TableCell>
                      <TableCell>
                        {p.start ? format(new Date(p.start), 'dd MMM yyyy HH:mm', { locale: tr }) : '—'}
                      </TableCell>
                      <TableCell>
                        {p.end ? format(new Date(p.end), 'dd MMM yyyy HH:mm', { locale: tr }) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Courses Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5" />
              Açılan Dersler ({courses.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onRefreshCourses} disabled={coursesLoading}>
              <RefreshCw className={`h-4 w-4 ${coursesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {coursesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <p>Henüz ders eklenmemiş. Dönemi ders eklemeden de aktifleştirebilirsiniz.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ders Kodu</TableHead>
                    <TableHead>Ders Adı</TableHead>
                    <TableHead>Öğretim Üyesi</TableHead>
                    <TableHead>Derslik</TableHead>
                    <TableHead className="text-center">Kontenjan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.course_code}</TableCell>
                      <TableCell>{course.course_name}</TableCell>
                      <TableCell>{course.instructor_fullname}</TableCell>
                      <TableCell>{course.classroom_location}</TableCell>
                      <TableCell className="text-center">{course.max_capacity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-300">Aktifleştirme Uyarısı</h4>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Dönemi aktifleştirdiğinizde ders yapısı (ders ekleme, silme, hoca değişikliği vb.) tamamen donar.
              Aktifleştirmeden önce tüm derslerin eklendiğinden emin olun.
              Aktifleştirmek istemiyorsanız "Daha Sonra Aktifleştir" butonunu kullanabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
