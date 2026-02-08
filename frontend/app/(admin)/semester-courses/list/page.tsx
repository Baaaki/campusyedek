'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockFaculties } from '@/mock_data/catalog';
import type { Department, Faculty, SemesterCourse } from '@/lib/types';
import { semesterApi } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Building2,
  GraduationCap,
  CalendarPlus,
  Trash2,
  Pencil,
  Loader2,
} from 'lucide-react';

// API Types
interface SemesterCoursesResponse {
  data: SemesterCourse[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

// API Functions
const fetchSemesterCourses = async (semester: string, department?: string): Promise<SemesterCourse[]> => {
  const searchParams: Record<string, string | number> = { limit: 100 };
  if (department) {
    searchParams.department = department;
  }
  const response = await semesterApi.get(`${semester}/courses`, { searchParams }).json<SemesterCoursesResponse>();
  return response.data || [];
};

const updateSemesterCourse = async (semester: string, courseId: string, data: Partial<SemesterCourse>) => {
  return semesterApi.put(`${semester}/courses/${courseId}`, { json: data }).json();
};

const deleteSemesterCourse = async (semester: string, courseId: string) => {
  return semesterApi.delete(`${semester}/courses/${courseId}`).json();
};

// Time slots (1-9 ders)
const timeSlots = [
  { slot: 1, time: '08:30 - 09:15' },
  { slot: 2, time: '09:25 - 10:10' },
  { slot: 3, time: '10:20 - 11:05' },
  { slot: 4, time: '11:15 - 12:00' },
  { slot: 5, time: '12:10 - 12:55' },
  { slot: 6, time: '13:00 - 13:45' },
  { slot: 7, time: '13:55 - 14:40' },
  { slot: 8, time: '14:50 - 15:35' },
  { slot: 9, time: '15:45 - 16:30' },
];

const daysOfWeek = [
  { key: 'monday', label: 'Pzt', fullName: 'Pazartesi' },
  { key: 'tuesday', label: 'Sal', fullName: 'Salı' },
  { key: 'wednesday', label: 'Çar', fullName: 'Çarşamba' },
  { key: 'thursday', label: 'Per', fullName: 'Perşembe' },
  { key: 'friday', label: 'Cum', fullName: 'Cuma' },
];

// Day mapping from English to Turkish
const dayMap: Record<string, string> = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
};

interface ScheduleSession {
  day_of_week: string;
  slot_numbers: number[];
}

// Schedule entry type
interface ScheduleEntry {
  id: string;
  course_code: string;
  course_name: string;
  instructor: string;
  classroom: string;
  color: string;
}

// Course for edit/delete
interface CourseInfo {
  id: string;
  course_code: string;
  course_name: string;
  instructor: string;
  classroom: string;
  class_level: number;
  max_capacity: number;
}

// Color palette for courses - repeating pattern
const courseColors = [
  'bg-blue-100 border-blue-300 text-blue-800',
  'bg-green-100 border-green-300 text-green-800',
  'bg-purple-100 border-purple-300 text-purple-800',
  'bg-yellow-100 border-yellow-300 text-yellow-800',
  'bg-red-100 border-red-300 text-red-800',
  'bg-indigo-100 border-indigo-300 text-indigo-800',
  'bg-teal-100 border-teal-300 text-teal-800',
  'bg-orange-100 border-orange-300 text-orange-800',
  'bg-pink-100 border-pink-300 text-pink-800',
  'bg-cyan-100 border-cyan-300 text-cyan-800',
  'bg-rose-100 border-rose-300 text-rose-800',
  'bg-violet-100 border-violet-300 text-violet-800',
  'bg-emerald-100 border-emerald-300 text-emerald-800',
  'bg-amber-100 border-amber-300 text-amber-800',
  'bg-sky-100 border-sky-300 text-sky-800',
  'bg-lime-100 border-lime-300 text-lime-800',
  'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800',
  'bg-slate-100 border-slate-300 text-slate-800',
];

export default function OpenedCoursesPage() {
  const queryClient = useQueryClient();
  const [expandedFaculties, setExpandedFaculties] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<{ dept: Department; faculty: Faculty } | null>(null);
  const [currentSemester] = useState('2024-2025-Fall'); // Current semester

  // Fetch semester courses from backend
  const { data: semesterCourses = [], isLoading, error } = useQuery({
    queryKey: ['semester-courses', currentSemester, selectedDepartment?.dept.name],
    queryFn: () => fetchSemesterCourses(currentSemester, selectedDepartment?.dept.name),
    enabled: !!selectedDepartment,
  });

  // Transform backend data into schedule grid format
  const schedules = useMemo(() => {
    const schedulesByClassLevel: Record<number, Record<string, Record<number, ScheduleEntry>>> = {
      1: {},
      2: {},
      3: {},
      4: {},
    };

    // Assign colors to courses based on course_code
    const courseColorMap = new Map<string, string>();
    let colorIndex = 0;

    semesterCourses.forEach((course) => {
      // Assign color if not already assigned
      if (!courseColorMap.has(course.course_code)) {
        courseColorMap.set(course.course_code, courseColors[colorIndex % courseColors.length]);
        colorIndex++;
      }

      const color = courseColorMap.get(course.course_code)!;
      const classLevel = course.class_level;

      // Initialize class level if needed
      if (!schedulesByClassLevel[classLevel]) {
        schedulesByClassLevel[classLevel] = {};
      }

      // Process each schedule session
      course.schedule_sessions.forEach((session) => {
        const dayKey = session.day_of_week; // 'monday', 'tuesday', etc.
        const dayName = dayMap[dayKey]; // Convert to Turkish

        if (!dayName) return; // Skip if day not found

        // Initialize day if needed
        if (!schedulesByClassLevel[classLevel][dayName]) {
          schedulesByClassLevel[classLevel][dayName] = {};
        }

        // Add course to each slot
        session.slot_numbers.forEach((slot) => {
          schedulesByClassLevel[classLevel][dayName][slot] = {
            id: course.id,
            course_code: course.course_code,
            course_name: course.course_name,
            instructor: course.instructor_fullname,
            classroom: course.classroom_location,
            color,
          };
        });
      });
    });

    return schedulesByClassLevel;
  }, [semesterCourses]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<CourseInfo | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<CourseInfo | null>(null);
  const [editForm, setEditForm] = useState({
    instructor: '',
    classroom: '',
    max_capacity: 50,
    schedule_sessions: [] as ScheduleSession[]
  });

  // Mutation for deleting a course
  const deleteMutation = useMutation({
    mutationFn: (courseId: string) => deleteSemesterCourse(currentSemester, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semester-courses', currentSemester, selectedDepartment?.dept.name] });
      setDeleteDialogOpen(false);
      setCourseToDelete(null);
      alert('Ders başarıyla kaldırıldı!');
    },
    onError: (error) => {
      console.error('Ders silinirken hata:', error);
      alert('Ders silinirken bir hata oluştu!');
    },
  });

  // Mutation for updating a course
  const updateMutation = useMutation({
    mutationFn: ({ courseId, data }: { courseId: string; data: Partial<SemesterCourse> }) =>
      updateSemesterCourse(currentSemester, courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semester-courses', currentSemester, selectedDepartment?.dept.name] });
      setEditDialogOpen(false);
      setCourseToEdit(null);
      alert('Ders başarıyla güncellendi!');
    },
    onError: (error) => {
      console.error('Ders güncellenirken hata:', error);
      alert('Ders güncellenirken bir hata oluştu!');
    },
  });

  // Toggle faculty accordion
  const toggleFaculty = (facultyId: string) => {
    setExpandedFaculties(prev =>
      prev.includes(facultyId)
        ? prev.filter(id => id !== facultyId)
        : [...prev, facultyId]
    );
  };

  const handleDepartmentClick = (dept: Department, faculty: Faculty) => {
    setSelectedDepartment({ dept, faculty });
  };

  // Toggle schedule slot for edit form
  const toggleEditScheduleSlot = (day: string, slot: number) => {
    setEditForm(prev => {
      const existingSession = prev.schedule_sessions.find(s => s.day_of_week === day);
      if (existingSession) {
        const hasSlot = existingSession.slot_numbers.includes(slot);
        if (hasSlot) {
          const newSlots = existingSession.slot_numbers.filter(s => s !== slot);
          if (newSlots.length === 0) {
            return { ...prev, schedule_sessions: prev.schedule_sessions.filter(s => s.day_of_week !== day) };
          }
          return { ...prev, schedule_sessions: prev.schedule_sessions.map(s =>
            s.day_of_week === day ? { ...s, slot_numbers: newSlots } : s
          ) };
        } else {
          return { ...prev, schedule_sessions: prev.schedule_sessions.map(s =>
            s.day_of_week === day ? { ...s, slot_numbers: [...s.slot_numbers, slot].sort((a, b) => a - b) } : s
          ) };
        }
      } else {
        return { ...prev, schedule_sessions: [...prev.schedule_sessions, { day_of_week: day, slot_numbers: [slot] }] };
      }
    });
  };

  // Check if slot is selected in edit form
  const isEditSlotSelected = (day: string, slot: number) => {
    const session = editForm.schedule_sessions.find(s => s.day_of_week === day);
    return session ? session.slot_numbers.includes(slot) : false;
  };

  // Delete course
  const handleDeleteConfirm = async () => {
    if (!courseToDelete) return;
    deleteMutation.mutate(courseToDelete.id);
  };

  // Update course
  const handleEditConfirm = async () => {
    if (!courseToEdit) return;

    const updateData: Partial<SemesterCourse> = {
      instructor_fullname: editForm.instructor,
      classroom_location: editForm.classroom,
      max_capacity: editForm.max_capacity,
      schedule_sessions: editForm.schedule_sessions.map(s => ({
        day_of_week: s.day_of_week,
        slot_numbers: s.slot_numbers,
      })),
    };

    updateMutation.mutate({ courseId: courseToEdit.id, data: updateData });
  };

  // Faculty & Department List View (Accordion)
  if (!selectedDepartment) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <CalendarPlus className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Haftalık Ders Programları</h1>
                <p className="text-gray-600 dark:text-gray-400">Bölüm seçerek haftalık ders programını görüntüleyin</p>
              </div>
            </div>

            {/* Faculty Accordion */}
            <div className="space-y-2">
              {mockFaculties.map((faculty) => {
                const isExpanded = expandedFaculties.includes(faculty.id);
                return (
                  <div key={faculty.id} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleFaculty(faculty.id)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                        <span className="font-semibold text-gray-900 dark:text-white">{faculty.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {faculty.departments.length} bölüm
                        </Badge>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800">
                        {faculty.departments.map((dept, index) => (
                          <button
                            key={dept.id}
                            onClick={() => handleDepartmentClick(dept, faculty)}
                            className={`w-full flex items-center justify-between p-3 pl-12 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left ${
                              index !== faculty.departments.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <GraduationCap className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-700 dark:text-gray-300">{dept.name}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Weekly Schedule View - 4 class levels
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-[1600px] mx-auto px-4">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <button
            onClick={() => setSelectedDepartment(null)}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Tüm Fakülteler</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedDepartment.dept.name}</h1>
              <p className="text-gray-600 dark:text-gray-400">{selectedDepartment.faculty.name} - Haftalık Ders Programları</p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Ders programları yükleniyor...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
            <p className="text-red-800 dark:text-red-200">Ders programları yüklenirken bir hata oluştu.</p>
          </div>
        )}

        {/* 4 Weekly Schedules */}
        {!isLoading && !error && (
          <div className="space-y-8">
            {[1, 2, 3, 4].map((classLevel) => (
              <div key={classLevel} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                {/* Class Level Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                  <h2 className="text-xl font-bold text-white">{classLevel}. Sınıf Haftalık Ders Programı</h2>
                </div>

                {/* Schedule Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        <th className="border dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 w-20">
                          Saat
                        </th>
                        {daysOfWeek.map((day) => (
                          <th key={day.key} className="border dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[180px]">
                            <span className="hidden sm:inline">{day.fullName}</span>
                            <span className="sm:hidden">{day.label}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.map((slot) => (
                        <tr key={slot.slot} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="border dark:border-gray-600 px-2 py-1 text-xs text-center font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                            {slot.slot}. Ders
                            <br />
                            <span className="text-[10px]">{slot.time}</span>
                          </td>
                          {daysOfWeek.map((day) => {
                            const dayName = dayMap[day.key];
                            const entry = schedules[classLevel]?.[dayName]?.[slot.slot];
                            return (
                              <td key={day.key} className="border dark:border-gray-600 p-1">
                                {entry ? (
                                  <div className={`${entry.color} border rounded-md p-2 h-full min-h-[60px] text-xs relative group`}>
                                    {/* Action buttons - appear on hover */}
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCourseToEdit({
                                            id: entry.id,
                                            course_code: entry.course_code,
                                            course_name: entry.course_name,
                                            instructor: entry.instructor,
                                            classroom: entry.classroom,
                                            class_level: classLevel,
                                            max_capacity: 50,
                                          });
                                          // Find all slots for this course
                                          const sessions: ScheduleSession[] = [];
                                          daysOfWeek.forEach(d => {
                                            const slotsForDay: number[] = [];
                                            timeSlots.forEach(s => {
                                              const dName = dayMap[d.key];
                                              if (schedules[classLevel]?.[dName]?.[s.slot]?.id === entry.id) {
                                                slotsForDay.push(s.slot);
                                              }
                                            });
                                            if (slotsForDay.length > 0) {
                                              sessions.push({ day_of_week: d.key, slot_numbers: slotsForDay });
                                            }
                                          });
                                          setEditForm({
                                            instructor: entry.instructor,
                                            classroom: entry.classroom,
                                            max_capacity: 50,
                                            schedule_sessions: sessions,
                                          });
                                          setEditDialogOpen(true);
                                        }}
                                        className="p-1 bg-white/80 hover:bg-white rounded shadow-sm"
                                        title="Düzenle"
                                      >
                                        <Pencil className="h-3 w-3 text-gray-600" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCourseToDelete({
                                            id: entry.id,
                                            course_code: entry.course_code,
                                            course_name: entry.course_name,
                                            instructor: entry.instructor,
                                            classroom: entry.classroom,
                                            class_level: classLevel,
                                            max_capacity: 50,
                                          });
                                          setDeleteDialogOpen(true);
                                        }}
                                        className="p-1 bg-red-100/80 hover:bg-red-200 rounded shadow-sm"
                                        title="Kaldır"
                                      >
                                        <Trash2 className="h-3 w-3 text-red-600" />
                                      </button>
                                    </div>
                                    <div className="font-bold">{entry.course_code}</div>
                                    <div className="text-[10px] opacity-80 truncate">{entry.course_name}</div>
                                    <div className="mt-1 text-[10px] opacity-70">{entry.instructor}</div>
                                    <div className="text-[10px] opacity-60">{entry.classroom}</div>
                                  </div>
                                ) : (
                                  <div className="h-[60px]"></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dersi Kaldırmak İstediğinize Emin Misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{courseToDelete?.course_code} - {courseToDelete?.course_name}</strong> dersini programdan kaldırmak üzeresiniz.
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-sm space-y-1">
              <p><strong>Ders:</strong> {courseToDelete?.course_code} - {courseToDelete?.course_name}</p>
              <p><strong>Öğretim Üyesi:</strong> {courseToDelete?.instructor}</p>
              <p><strong>Derslik:</strong> {courseToDelete?.classroom}</p>
              <p><strong>Sınıf:</strong> {courseToDelete?.class_level}. Sınıf</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Course Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Dersi Düzenle</DialogTitle>
            <DialogDescription>
              {courseToEdit?.course_code} - {courseToEdit?.course_name} ({courseToEdit?.class_level}. Sınıf)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instructor">Öğretim Üyesi</Label>
              <Input
                id="instructor"
                value={editForm.instructor}
                onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classroom">Derslik / Konum</Label>
                <Input
                  id="classroom"
                  value={editForm.classroom}
                  onChange={(e) => setEditForm({ ...editForm, classroom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_capacity">Kontenjan</Label>
                <Input
                  id="max_capacity"
                  type="number"
                  min="1"
                  max="500"
                  value={editForm.max_capacity}
                  onChange={(e) => setEditForm({ ...editForm, max_capacity: parseInt(e.target.value) || 50 })}
                />
              </div>
            </div>

            {/* Schedule Section - Checkbox Grid */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Ders Programı</Label>
              <p className="text-sm text-muted-foreground mb-3">Dersin hangi gün ve saatlerde yapılacağını seçin</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border dark:border-gray-700 p-2 bg-muted text-left font-medium">Saat</th>
                      {daysOfWeek.map((day) => (
                        <th key={day.key} className="border dark:border-gray-700 p-2 bg-muted text-center font-medium">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot) => (
                      <tr key={slot.slot}>
                        <td className="border dark:border-gray-700 p-2 text-xs text-muted-foreground whitespace-nowrap">
                          {slot.slot}. Ders<br />
                          <span className="text-[10px]">{slot.time}</span>
                        </td>
                        {daysOfWeek.map((day) => (
                          <td key={day.key} className="border dark:border-gray-700 p-1 text-center">
                            <Checkbox
                              checked={isEditSlotSelected(day.key, slot.slot)}
                              onCheckedChange={() => toggleEditScheduleSlot(day.key, slot.slot)}
                              className="h-5 w-5"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Selected schedule summary */}
              {editForm.schedule_sessions.length > 0 && (
                <div className="mt-3 p-2 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium">Seçilen: </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editForm.schedule_sessions.map((session) => {
                      const dayInfo = daysOfWeek.find(d => d.key === session.day_of_week);
                      return (
                        <Badge key={session.day_of_week} variant="secondary" className="text-xs">
                          {dayInfo?.fullName || session.day_of_week}: {session.slot_numbers.join(', ')}. ders
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updateMutation.isPending}>
              İptal
            </Button>
            <Button onClick={handleEditConfirm} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
