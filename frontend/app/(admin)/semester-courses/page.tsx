'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { mockFaculties } from '@/mock_data/catalog';
import { Faculty, Department, AssessmentItem, ScheduleSessionDTO, CourseCatalog } from '@/lib/types';
import {
  Plus,
  Trash2,
  CalendarPlus,
  GraduationCap,
  User,
  MapPin,
  Users,
  Clock,
  Percent,
  Save,
  AlertCircle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

// Mock courses by department
const mockCoursesByDepartment: Record<string, CourseCatalog[]> = {
  'dept-bil': [
    { id: '1', course_code: 'BIL101', name: 'Programlamaya Giriş', faculty: 'Fen Fakültesi', department: 'Bilgisayar Bilimleri', class_level: 1, credits: 4, theoretical_hours: 3, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
    { id: '2', course_code: 'BIL102', name: 'Veri Yapıları', faculty: 'Fen Fakültesi', department: 'Bilgisayar Bilimleri', class_level: 1, credits: 4, theoretical_hours: 3, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
    { id: '3', course_code: 'BIL201', name: 'Algoritmalar', faculty: 'Fen Fakültesi', department: 'Bilgisayar Bilimleri', class_level: 2, credits: 4, theoretical_hours: 3, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
    { id: '4', course_code: 'BIL202', name: 'Veritabanı Sistemleri', faculty: 'Fen Fakültesi', department: 'Bilgisayar Bilimleri', class_level: 2, credits: 3, theoretical_hours: 2, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
    { id: '5', course_code: 'BIL301', name: 'Yazılım Mühendisliği', faculty: 'Fen Fakültesi', department: 'Bilgisayar Bilimleri', class_level: 3, credits: 3, theoretical_hours: 3, practical_hours: 0, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
  ],
  'dept-matematik': [
    { id: '6', course_code: 'MAT101', name: 'Matematik I', faculty: 'Fen Fakültesi', department: 'Matematik', class_level: 1, credits: 5, theoretical_hours: 4, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
    { id: '7', course_code: 'MAT102', name: 'Matematik II', faculty: 'Fen Fakültesi', department: 'Matematik', class_level: 1, credits: 5, theoretical_hours: 4, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
    { id: '8', course_code: 'MAT201', name: 'Lineer Cebir', faculty: 'Fen Fakültesi', department: 'Matematik', class_level: 2, credits: 4, theoretical_hours: 3, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
  ],
  'dept-fizik': [
    { id: '9', course_code: 'FIZ101', name: 'Fizik I', faculty: 'Fen Fakültesi', department: 'Fizik', class_level: 1, credits: 4, theoretical_hours: 3, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
    { id: '10', course_code: 'FIZ102', name: 'Fizik II', faculty: 'Fen Fakültesi', department: 'Fizik', class_level: 1, credits: 4, theoretical_hours: 3, practical_hours: 2, course_type: 'mandatory', prerequisites: [], status: 'active', created_at: '', updated_at: '' },
  ],
};

// Mock instructors
const mockInstructors = [
  { id: 'inst-1', fullname: 'Prof. Dr. Ahmet Yılmaz', department: 'Bilgisayar Bilimleri' },
  { id: 'inst-2', fullname: 'Doç. Dr. Mehmet Kaya', department: 'Bilgisayar Bilimleri' },
  { id: 'inst-3', fullname: 'Dr. Öğr. Üyesi Ayşe Demir', department: 'Bilgisayar Bilimleri' },
  { id: 'inst-4', fullname: 'Prof. Dr. Fatma Özkan', department: 'Matematik' },
  { id: 'inst-5', fullname: 'Doç. Dr. Ali Çelik', department: 'Fizik' },
  { id: 'inst-6', fullname: 'Dr. Öğr. Üyesi Zeynep Arslan', department: 'Matematik' },
];

// Predefined assessment types
const predefinedAssessments = [
  { slug: 'midterm', name: 'Vize' },
  { slug: 'final', name: 'Final' },
  { slug: 'quiz', name: 'Quiz' },
  { slug: 'homework', name: 'Ödev' },
  { slug: 'project', name: 'Proje' },
  { slug: 'lab', name: 'Laboratuvar' },
  { slug: 'presentation', name: 'Sunum' },
  { slug: 'attendance', name: 'Devam' },
];

// Days of week
const daysOfWeek = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Salı' },
  { key: 'wednesday', label: 'Çarşamba' },
  { key: 'thursday', label: 'Perşembe' },
  { key: 'friday', label: 'Cuma' },
];

// Time slots (ders saatleri)
const timeSlots = [
  { slot: 1, time: '08:30 - 09:20' },
  { slot: 2, time: '09:30 - 10:20' },
  { slot: 3, time: '10:30 - 11:20' },
  { slot: 4, time: '11:30 - 12:20' },
  { slot: 5, time: '13:30 - 14:20' },
  { slot: 6, time: '14:30 - 15:20' },
  { slot: 7, time: '15:30 - 16:20' },
  { slot: 8, time: '16:30 - 17:20' },
  { slot: 9, time: '17:30 - 18:20' },
  { slot: 10, time: '18:30 - 19:20' },
];

interface FormData {
  faculty_id: string;
  department_id: string;
  course_id: string;
  class_level: number;
  instructor_id: string;
  instructor_fullname: string;
  classroom_location: string;
  max_capacity: number;
  assessment_schema: AssessmentItem[];
  schedule_sessions: ScheduleSessionDTO[];
}

const initialFormData: FormData = {
  faculty_id: '',
  department_id: '',
  course_id: '',
  class_level: 1,
  instructor_id: '',
  instructor_fullname: '',
  classroom_location: '',
  max_capacity: 50,
  assessment_schema: [
    { slug: 'midterm', name: 'Vize', weight: 40 },
    { slug: 'final', name: 'Final', weight: 60 },
  ],
  schedule_sessions: [],
};

export default function SemesterCoursesPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<CourseCatalog[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseCatalog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate total assessment weight
  const totalWeight = formData.assessment_schema.reduce((sum, item) => sum + item.weight, 0);
  const isWeightValid = totalWeight === 100;

  // Update departments when faculty changes
  useEffect(() => {
    if (formData.faculty_id) {
      const faculty = mockFaculties.find(f => f.id === formData.faculty_id);
      if (faculty) {
        setDepartments(faculty.departments);
        setFormData(prev => ({ ...prev, department_id: '', course_id: '' }));
        setCourses([]);
        setSelectedCourse(null);
      }
    } else {
      setDepartments([]);
      setCourses([]);
      setSelectedCourse(null);
    }
  }, [formData.faculty_id]);

  // Update courses when department changes
  useEffect(() => {
    if (formData.department_id) {
      const deptCourses = mockCoursesByDepartment[formData.department_id] || [];
      setCourses(deptCourses);
      setFormData(prev => ({ ...prev, course_id: '' }));
      setSelectedCourse(null);
    } else {
      setCourses([]);
      setSelectedCourse(null);
    }
  }, [formData.department_id]);

  // Update selected course info
  useEffect(() => {
    if (formData.course_id) {
      const course = courses.find(c => c.id === formData.course_id);
      if (course) {
        setSelectedCourse(course);
        setFormData(prev => ({ ...prev, class_level: course.class_level }));
      }
    } else {
      setSelectedCourse(null);
    }
  }, [formData.course_id, courses]);

  // Update instructor fullname when instructor is selected
  useEffect(() => {
    if (formData.instructor_id) {
      const instructor = mockInstructors.find(i => i.id === formData.instructor_id);
      if (instructor) {
        setFormData(prev => ({ ...prev, instructor_fullname: instructor.fullname }));
      }
    }
  }, [formData.instructor_id]);

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Assessment schema management
  const addAssessment = () => {
    setFormData(prev => ({
      ...prev,
      assessment_schema: [...prev.assessment_schema, { slug: '', name: '', weight: 0 }],
    }));
  };

  const updateAssessment = (index: number, field: keyof AssessmentItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      assessment_schema: prev.assessment_schema.map((item, i) => {
        if (i === index) {
          if (field === 'slug') {
            const predefined = predefinedAssessments.find(p => p.slug === value);
            return { ...item, slug: value as string, name: predefined?.name || item.name };
          }
          return { ...item, [field]: value };
        }
        return item;
      }),
    }));
  };

  const removeAssessment = (index: number) => {
    if (formData.assessment_schema.length > 1) {
      setFormData(prev => ({
        ...prev,
        assessment_schema: prev.assessment_schema.filter((_, i) => i !== index),
      }));
    }
  };

  // Schedule management
  const toggleScheduleSlot = (day: string, slot: number) => {
    setFormData(prev => {
      const existingSession = prev.schedule_sessions.find(s => s.day_of_week === day);

      if (existingSession) {
        const hasSlot = existingSession.slot_numbers.includes(slot);
        if (hasSlot) {
          // Remove slot
          const newSlots = existingSession.slot_numbers.filter(s => s !== slot);
          if (newSlots.length === 0) {
            // Remove entire session if no slots left
            return {
              ...prev,
              schedule_sessions: prev.schedule_sessions.filter(s => s.day_of_week !== day),
            };
          }
          return {
            ...prev,
            schedule_sessions: prev.schedule_sessions.map(s =>
              s.day_of_week === day ? { ...s, slot_numbers: newSlots.sort((a, b) => a - b) } : s
            ),
          };
        } else {
          // Add slot
          return {
            ...prev,
            schedule_sessions: prev.schedule_sessions.map(s =>
              s.day_of_week === day
                ? { ...s, slot_numbers: [...s.slot_numbers, slot].sort((a, b) => a - b) }
                : s
            ),
          };
        }
      } else {
        // Create new session
        return {
          ...prev,
          schedule_sessions: [...prev.schedule_sessions, { day_of_week: day, slot_numbers: [slot] }],
        };
      }
    });
  };

  const isSlotSelected = (day: string, slot: number) => {
    const session = formData.schedule_sessions.find(s => s.day_of_week === day);
    return session?.slot_numbers.includes(slot) || false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isWeightValid) {
      alert('Değerlendirme ağırlıkları toplamı %100 olmalıdır!');
      return;
    }

    if (formData.schedule_sessions.length === 0) {
      alert('En az bir ders saati seçmelisiniz!');
      return;
    }

    setIsSubmitting(true);

    // Prepare data for API
    const requestData = {
      course_code: selectedCourse?.course_code,
      class_level: formData.class_level,
      instructor_id: formData.instructor_id,
      instructor_fullname: formData.instructor_fullname,
      classroom_location: formData.classroom_location,
      max_capacity: formData.max_capacity,
      assessment_schema: formData.assessment_schema,
      schedule_sessions: formData.schedule_sessions,
    };

    console.log('Semester Course Data:', requestData);

    // TODO: API'ye gönder
    await new Promise(resolve => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    alert('Dönemlik ders başarıyla açıldı!');

    // Reset form
    setFormData(initialFormData);
    setSelectedCourse(null);
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <CalendarPlus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Dönem Ders Açılışı</h1>
          <p className="text-muted-foreground text-sm">Dönemlik açılacak dersleri tanımlayın</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fakülte, Bölüm ve Ders Seçimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Ders Seçimi
            </CardTitle>
            <CardDescription>Açılacak dersi seçin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fakülte *</Label>
                <Select
                  value={formData.faculty_id}
                  onValueChange={(value) => handleInputChange('faculty_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fakülte seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockFaculties.map((faculty) => (
                      <SelectItem key={faculty.id} value={faculty.id}>
                        {faculty.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bölüm *</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => handleInputChange('department_id', value)}
                  disabled={!formData.faculty_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.faculty_id ? "Bölüm seçin" : "Önce fakülte seçin"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ders *</Label>
                <Select
                  value={formData.course_id}
                  onValueChange={(value) => handleInputChange('course_id', value)}
                  disabled={!formData.department_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.department_id ? "Ders seçin" : "Önce bölüm seçin"} />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.course_code} - {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected Course Info */}
            {selectedCourse && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Seçilen Ders Bilgileri</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Ders Kodu:</span>
                    <p className="font-medium">{selectedCourse.course_code}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kredi:</span>
                    <p className="font-medium">{selectedCourse.credits}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sınıf:</span>
                    <p className="font-medium">{selectedCourse.class_level}. Sınıf</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tür:</span>
                    <Badge variant={selectedCourse.course_type === 'mandatory' ? 'default' : 'secondary'}>
                      {selectedCourse.course_type === 'mandatory' ? 'Zorunlu' : 'Seçmeli'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Öğretim Üyesi ve Sınıf Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Öğretim Üyesi ve Sınıf Bilgileri
            </CardTitle>
            <CardDescription>Dersi verecek öğretim üyesi ve sınıf detayları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Öğretim Üyesi *</Label>
                <Select
                  value={formData.instructor_id}
                  onValueChange={(value) => handleInputChange('instructor_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Öğretim üyesi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockInstructors.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.fullname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sınıf *</Label>
                <Select
                  value={formData.class_level.toString()}
                  onValueChange={(value) => handleInputChange('class_level', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((level) => (
                      <SelectItem key={level} value={level.toString()}>
                        {level}. Sınıf
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Derslik / Konum *
                </Label>
                <Input
                  placeholder="Örn: A Blok, Kat 2, Derslik 201"
                  value={formData.classroom_location}
                  onChange={(e) => handleInputChange('classroom_location', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Kontenjan *
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  placeholder="50"
                  value={formData.max_capacity}
                  onChange={(e) => handleInputChange('max_capacity', parseInt(e.target.value) || 50)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ders Programı */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ders Programı
            </CardTitle>
            <CardDescription>Dersin hangi gün ve saatlerde yapılacağını seçin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border dark:border-gray-700 p-2 bg-muted text-left text-sm font-medium">Saat</th>
                    {daysOfWeek.map((day) => (
                      <th key={day.key} className="border dark:border-gray-700 p-2 bg-muted text-center text-sm font-medium min-w-[100px]">
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
                            checked={isSlotSelected(day.key, slot.slot)}
                            onCheckedChange={() => toggleScheduleSlot(day.key, slot.slot)}
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
            {formData.schedule_sessions.length > 0 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Seçilen Saatler:</h4>
                <div className="flex flex-wrap gap-2">
                  {formData.schedule_sessions.map((session) => {
                    const dayLabel = daysOfWeek.find(d => d.key === session.day_of_week)?.label;
                    return session.slot_numbers.map((slot) => (
                      <Badge key={`${session.day_of_week}-${slot}`} variant="secondary">
                        {dayLabel} {slot}. Ders
                      </Badge>
                    ));
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Değerlendirme Şeması */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Değerlendirme Şeması
            </CardTitle>
            <CardDescription>
              Not değerlendirme ağırlıklarını belirleyin (Toplam %100 olmalıdır)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.assessment_schema.map((assessment, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Değerlendirme Türü</Label>
                  <Select
                    value={assessment.slug}
                    onValueChange={(value) => updateAssessment(index, 'slug', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tür seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {predefinedAssessments.map((type) => (
                        <SelectItem key={type.slug} value={type.slug}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-32 space-y-2">
                  <Label>Ağırlık (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={assessment.weight}
                    onChange={(e) => updateAssessment(index, 'weight', parseInt(e.target.value) || 0)}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAssessment(index)}
                  disabled={formData.assessment_schema.length === 1}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" size="sm" onClick={addAssessment}>
                <Plus className="h-4 w-4 mr-2" />
                Değerlendirme Ekle
              </Button>

              <div className={`flex items-center gap-2 text-sm font-medium ${isWeightValid ? 'text-green-600' : 'text-destructive'}`}>
                {isWeightValid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                Toplam: %{totalWeight}
                {!isWeightValid && <span className="text-xs">(%100 olmalı)</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFormData(initialFormData);
              setSelectedCourse(null);
            }}
          >
            Temizle
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !selectedCourse || !formData.instructor_id || !isWeightValid}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Kaydediliyor...' : 'Dersi Aç'}
          </Button>
        </div>
      </form>
    </div>
  );
}
