'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { mockFaculties, mockCourseCatalog } from '@/mock_data/catalog';
import { Faculty, Department, WeeklyTopic, CourseCoordinator, CourseCatalog } from '@/lib/types';
import {
  ArrowLeft,
  Plus,
  Trash2,
  BookOpen,
  GraduationCap,
  User,
  Calendar,
  Library,
  Save,
  ChevronDown,
  ChevronRight,
  Building2,
  Search,
  Edit3,
} from 'lucide-react';

interface FormData {
  id: string;
  faculty_id: string;
  department_id: string;
  course_code: string;
  name: string;
  offering_unit: string;
  semester: number;
  class_level: number;
  credits: number;
  theoretical_hours: number;
  practical_hours: number;
  lab_hours: number;
  ects: number;
  course_type: 'Zorunlu' | 'Seçmeli' | 'mandatory' | 'elective';
  education_level: string;
  teaching_type: string;
  language: string;
  coordinator: CourseCoordinator;
  purpose: string;
  learning_outcomes: string[];
  weekly_topics: WeeklyTopic[];
  recommended_sources: string[];
  description: string;
}

const initialFormData: FormData = {
  id: '',
  faculty_id: '',
  department_id: '',
  course_code: '',
  name: '',
  offering_unit: '',
  semester: 1,
  class_level: 1,
  credits: 0,
  theoretical_hours: 0,
  practical_hours: 0,
  lab_hours: 0,
  ects: 0,
  course_type: 'Zorunlu',
  education_level: 'Lisans',
  teaching_type: 'Örgün Öğretim',
  language: 'Türkçe',
  coordinator: {
    title: '',
    name: '',
    email: '',
    phone: '',
    office: '',
  },
  purpose: '',
  learning_outcomes: [''],
  weekly_topics: [{ week: 1, topic: '', description: '' }],
  recommended_sources: [''],
  description: '',
};

export default function EditCoursePage() {
  const router = useRouter();

  // Ders seçimi state'leri
  const [expandedFaculties, setExpandedFaculties] = useState<string[]>([]);
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseCatalog | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state'leri
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fakülte toggle
  const toggleFaculty = (facultyId: string) => {
    setExpandedFaculties(prev =>
      prev.includes(facultyId)
        ? prev.filter(id => id !== facultyId)
        : [...prev, facultyId]
    );
  };

  // Bölüm toggle
  const toggleDepartment = (deptId: string) => {
    setExpandedDepartments(prev =>
      prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  // Bölüme ait dersleri getir
  const getDepartmentCourses = (departmentName: string) => {
    return mockCourseCatalog.filter(course =>
      course.department === departmentName &&
      (searchTerm === '' ||
       course.course_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
       course.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  // Ders seçildiğinde formu doldur
  const handleCourseSelect = (course: CourseCatalog) => {
    setSelectedCourse(course);

    // Fakülte ve bölüm ID'lerini bul
    let facultyId = '';
    let departmentId = '';

    for (const faculty of mockFaculties) {
      const dept = faculty.departments.find(d => d.name === course.department);
      if (dept) {
        facultyId = faculty.id;
        departmentId = dept.id;
        setDepartments(faculty.departments);
        break;
      }
    }

    // Course type'ı Türkçe'ye çevir
    const courseType = course.course_type === 'mandatory' ? 'Zorunlu' :
                       course.course_type === 'elective' ? 'Seçmeli' :
                       course.course_type as 'Zorunlu' | 'Seçmeli';

    setFormData({
      id: course.id,
      faculty_id: facultyId,
      department_id: departmentId,
      course_code: course.course_code,
      name: course.name,
      offering_unit: course.offering_unit || '',
      semester: course.semester || 1,
      class_level: course.class_level,
      credits: course.credits,
      theoretical_hours: course.theoretical_hours,
      practical_hours: course.practical_hours,
      lab_hours: course.lab_hours || 0,
      ects: course.ects || course.credits,
      course_type: courseType,
      education_level: course.education_level || 'Lisans',
      teaching_type: course.teaching_type || 'Örgün Öğretim',
      language: course.language || 'Türkçe',
      coordinator: course.coordinator || { title: '', name: '', email: '', phone: '', office: '' },
      purpose: course.purpose || '',
      learning_outcomes: course.learning_outcomes_list?.length ? course.learning_outcomes_list : [''],
      weekly_topics: course.weekly_topics?.length ? course.weekly_topics : [{ week: 1, topic: '', description: '' }],
      recommended_sources: course.recommended_sources?.length ? course.recommended_sources : [''],
      description: course.description || '',
    });
  };

  // Fakülte değiştiğinde bölümleri güncelle
  useEffect(() => {
    if (formData.faculty_id) {
      const faculty = mockFaculties.find(f => f.id === formData.faculty_id);
      if (faculty) {
        setDepartments(faculty.departments);
      }
    }
  }, [formData.faculty_id]);

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCoordinatorChange = (field: keyof CourseCoordinator, value: string) => {
    setFormData(prev => ({
      ...prev,
      coordinator: { ...prev.coordinator, [field]: value },
    }));
  };

  // Öğrenme kazanımları yönetimi
  const addLearningOutcome = () => {
    setFormData(prev => ({
      ...prev,
      learning_outcomes: [...prev.learning_outcomes, ''],
    }));
  };

  const updateLearningOutcome = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      learning_outcomes: prev.learning_outcomes.map((item, i) =>
        i === index ? value : item
      ),
    }));
  };

  const removeLearningOutcome = (index: number) => {
    if (formData.learning_outcomes.length > 1) {
      setFormData(prev => ({
        ...prev,
        learning_outcomes: prev.learning_outcomes.filter((_, i) => i !== index),
      }));
    }
  };

  // Haftalık konular yönetimi
  const addWeeklyTopic = () => {
    const nextWeek = formData.weekly_topics.length + 1;
    setFormData(prev => ({
      ...prev,
      weekly_topics: [...prev.weekly_topics, { week: nextWeek, topic: '', description: '' }],
    }));
  };

  const updateWeeklyTopic = (index: number, field: keyof WeeklyTopic, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      weekly_topics: prev.weekly_topics.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeWeeklyTopic = (index: number) => {
    if (formData.weekly_topics.length > 1) {
      setFormData(prev => ({
        ...prev,
        weekly_topics: prev.weekly_topics
          .filter((_, i) => i !== index)
          .map((item, i) => ({ ...item, week: i + 1 })),
      }));
    }
  };

  // Kaynaklar yönetimi
  const addSource = () => {
    setFormData(prev => ({
      ...prev,
      recommended_sources: [...prev.recommended_sources, ''],
    }));
  };

  const updateSource = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      recommended_sources: prev.recommended_sources.map((item, i) =>
        i === index ? value : item
      ),
    }));
  };

  const removeSource = (index: number) => {
    if (formData.recommended_sources.length > 1) {
      setFormData(prev => ({
        ...prev,
        recommended_sources: prev.recommended_sources.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simüle edilmiş güncelleme
    console.log('Güncellenen Form Data:', formData);

    // TODO: API'ye gönder
    await new Promise(resolve => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    alert('Ders başarıyla güncellendi!');
    router.push('/catalog');
  };

  // Ders seçimi yapılmadıysa accordion göster
  if (!selectedCourse) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/catalog')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Button>
          <div>
            <h1 className="text-2xl font-bold dark:text-white">Ders Güncelle</h1>
            <p className="text-muted-foreground text-sm">Güncellemek istediğiniz dersi seçin</p>
          </div>
        </div>

        {/* Arama */}
        <Card className="mb-6 dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Ders kodu veya adı ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Fakülte > Bölüm > Ders Accordion */}
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Edit3 className="h-5 w-5" />
              Ders Seçin
            </CardTitle>
            <CardDescription>Fakülte ve bölümü genişleterek dersi seçin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {mockFaculties.map((faculty) => {
                const isExpanded = expandedFaculties.includes(faculty.id);
                const hasCourses = faculty.departments.some(dept =>
                  getDepartmentCourses(dept.name).length > 0
                );

                // Arama varsa ve bu fakültede sonuç yoksa gösterme
                if (searchTerm && !hasCourses) return null;

                return (
                  <div key={faculty.id} className="border rounded-lg overflow-hidden dark:border-gray-700">
                    {/* Fakülte Header */}
                    <button
                      onClick={() => toggleFaculty(faculty.id)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-medium text-gray-900 dark:text-white text-sm">{faculty.name}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>

                    {/* Bölümler */}
                    {isExpanded && (
                      <div className="border-t dark:border-gray-700">
                        {faculty.departments.map((dept) => {
                          const courses = getDepartmentCourses(dept.name);
                          const isDeptExpanded = expandedDepartments.includes(dept.id);

                          // Arama varsa ve bu bölümde sonuç yoksa gösterme
                          if (searchTerm && courses.length === 0) return null;

                          return (
                            <div key={dept.id} className="border-b last:border-b-0 dark:border-gray-700">
                              {/* Bölüm Header */}
                              <button
                                onClick={() => toggleDepartment(dept.id)}
                                className="w-full flex items-center justify-between p-3 pl-8 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <GraduationCap className="h-4 w-4 text-gray-400" />
                                  <span className="text-gray-700 dark:text-gray-300 text-sm">{dept.name}</span>
                                  {courses.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {courses.length} ders
                                    </Badge>
                                  )}
                                </div>
                                {isDeptExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                              </button>

                              {/* Dersler */}
                              {isDeptExpanded && courses.length > 0 && (
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-2 space-y-1">
                                  {courses.map((course) => (
                                    <button
                                      key={course.id}
                                      onClick={() => handleCourseSelect(course)}
                                      className="w-full flex items-center justify-between p-2 pl-12 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors text-left group"
                                    >
                                      <div className="flex items-center gap-3">
                                        <BookOpen className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
                                        <div>
                                          <span className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">
                                            {course.course_code}
                                          </span>
                                          <span className="text-gray-600 dark:text-gray-400 text-sm ml-2">
                                            {course.name}
                                          </span>
                                        </div>
                                      </div>
                                      <Badge variant="secondary" className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                        Seç
                                      </Badge>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {isDeptExpanded && courses.length === 0 && (
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic p-3 pl-12">
                                  Bu bölümde ders bulunamadı
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ders seçildiyse formu göster
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedCourse(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Ders Seçimine Dön
          </Button>
          <div>
            <h1 className="text-2xl font-bold dark:text-white">Ders Güncelle</h1>
            <p className="text-muted-foreground text-sm">
              {selectedCourse.course_code} - {selectedCourse.name}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          Düzenleme Modu
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fakülte ve Bölüm Seçimi */}
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <GraduationCap className="h-5 w-5" />
              Fakülte ve Bölüm
            </CardTitle>
            <CardDescription>Dersin ait olduğu fakülte ve bölümü değiştirebilirsiniz</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="faculty">Fakülte *</Label>
              <Select
                value={formData.faculty_id}
                onValueChange={(value) => {
                  handleInputChange('faculty_id', value);
                  handleInputChange('department_id', '');
                }}
              >
                <SelectTrigger className="w-full">
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
              <Label htmlFor="department">Bölüm *</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => handleInputChange('department_id', value)}
                disabled={!formData.faculty_id}
              >
                <SelectTrigger className="w-full">
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
          </CardContent>
        </Card>

        {/* Temel Ders Bilgileri */}
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <BookOpen className="h-5 w-5" />
              Temel Ders Bilgileri
            </CardTitle>
            <CardDescription>Dersin temel bilgilerini düzenleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course_code">Ders Kodu *</Label>
                <Input
                  id="course_code"
                  placeholder="Örn: ATA 1001"
                  value={formData.course_code}
                  onChange={(e) => handleInputChange('course_code', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Ders Adı *</Label>
                <Input
                  id="name"
                  placeholder="Örn: Atatürk İlkeleri ve İnkılap Tarihi I"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="offering_unit">Dersi Veren Birim</Label>
              <Input
                id="offering_unit"
                placeholder="Örn: Atatürk İlkeleri ve İnkılap Tarihi Bölümü"
                value={formData.offering_unit}
                onChange={(e) => handleInputChange('offering_unit', e.target.value)}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="semester">Dönem</Label>
                <Select
                  value={formData.semester.toString()}
                  onValueChange={(value) => handleInputChange('semester', parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <SelectItem key={sem} value={sem.toString()}>
                        {sem}. Dönem
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class_level">Sınıf</Label>
                <Select
                  value={formData.class_level.toString()}
                  onValueChange={(value) => handleInputChange('class_level', parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((level) => (
                      <SelectItem key={level} value={level.toString()}>
                        {level}. Sınıf
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="course_type">Ders Türü</Label>
                <Select
                  value={formData.course_type}
                  onValueChange={(value) => handleInputChange('course_type', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Zorunlu">Zorunlu</SelectItem>
                    <SelectItem value="Seçmeli">Seçmeli</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Dil</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => handleInputChange('language', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Türkçe">Türkçe</SelectItem>
                    <SelectItem value="İngilizce">İngilizce</SelectItem>
                    <SelectItem value="Almanca">Almanca</SelectItem>
                    <SelectItem value="Fransızca">Fransızca</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="theoretical_hours">Teorik (Saat)</Label>
                <Input
                  id="theoretical_hours"
                  type="number"
                  min="0"
                  value={formData.theoretical_hours}
                  onChange={(e) => handleInputChange('theoretical_hours', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="practical_hours">Uygulama (Saat)</Label>
                <Input
                  id="practical_hours"
                  type="number"
                  min="0"
                  value={formData.practical_hours}
                  onChange={(e) => handleInputChange('practical_hours', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lab_hours">Lab (Saat)</Label>
                <Input
                  id="lab_hours"
                  type="number"
                  min="0"
                  value={formData.lab_hours}
                  onChange={(e) => handleInputChange('lab_hours', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits">Kredi</Label>
                <Input
                  id="credits"
                  type="number"
                  min="0"
                  value={formData.credits}
                  onChange={(e) => handleInputChange('credits', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ects">AKTS</Label>
                <Input
                  id="ects"
                  type="number"
                  min="0"
                  value={formData.ects}
                  onChange={(e) => handleInputChange('ects', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="education_level">Eğitim Seviyesi</Label>
                <Select
                  value={formData.education_level}
                  onValueChange={(value) => handleInputChange('education_level', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lisans">Lisans</SelectItem>
                    <SelectItem value="Yüksek Lisans">Yüksek Lisans</SelectItem>
                    <SelectItem value="Doktora">Doktora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teaching_type">Öğretim Türü</Label>
                <Select
                  value={formData.teaching_type}
                  onValueChange={(value) => handleInputChange('teaching_type', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Örgün Öğretim">Örgün Öğretim</SelectItem>
                    <SelectItem value="İkinci Öğretim">İkinci Öğretim</SelectItem>
                    <SelectItem value="Uzaktan Öğretim">Uzaktan Öğretim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ders Koordinatörü */}
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <User className="h-5 w-5" />
              Ders Koordinatörü
            </CardTitle>
            <CardDescription>Dersin koordinatör bilgilerini düzenleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coordinator_title">Unvan</Label>
                <Select
                  value={formData.coordinator.title}
                  onValueChange={(value) => handleCoordinatorChange('title', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unvan seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Prof. Dr.">Prof. Dr.</SelectItem>
                    <SelectItem value="Doç. Dr.">Doç. Dr.</SelectItem>
                    <SelectItem value="Dr. Öğr. Üyesi">Dr. Öğr. Üyesi</SelectItem>
                    <SelectItem value="Öğr. Gör.">Öğr. Gör.</SelectItem>
                    <SelectItem value="Arş. Gör.">Arş. Gör.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coordinator_name">Ad Soyad</Label>
                <Input
                  id="coordinator_name"
                  placeholder="Örn: Mehmet Yılmaz"
                  value={formData.coordinator.name}
                  onChange={(e) => handleCoordinatorChange('name', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coordinator_email">E-posta</Label>
                <Input
                  id="coordinator_email"
                  type="email"
                  placeholder="ornek@deu.edu.tr"
                  value={formData.coordinator.email}
                  onChange={(e) => handleCoordinatorChange('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coordinator_phone">Telefon</Label>
                <Input
                  id="coordinator_phone"
                  placeholder="0232 XXX XX XX"
                  value={formData.coordinator.phone}
                  onChange={(e) => handleCoordinatorChange('phone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coordinator_office">Ofis</Label>
                <Input
                  id="coordinator_office"
                  placeholder="Örn: A Blok, Kat 3, Oda 301"
                  value={formData.coordinator.office}
                  onChange={(e) => handleCoordinatorChange('office', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ders İçeriği */}
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <BookOpen className="h-5 w-5" />
              Ders İçeriği
            </CardTitle>
            <CardDescription>Dersin amacı ve açıklaması</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="purpose">Dersin Amacı</Label>
              <Textarea
                id="purpose"
                placeholder="Bu dersin amacı..."
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Ders Açıklaması</Label>
              <Textarea
                id="description"
                placeholder="Ders hakkında genel bilgi..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Öğrenme Kazanımları */}
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <GraduationCap className="h-5 w-5" />
              Öğrenme Kazanımları
            </CardTitle>
            <CardDescription>Bu dersi başarıyla tamamlayan öğrenci neler yapabilecek?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.learning_outcomes.map((outcome, index) => (
              <div key={index} className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-8 h-9 flex items-center justify-center bg-muted rounded text-sm font-medium">
                  {index + 1}
                </span>
                <Input
                  placeholder={`${index + 1}. kazanım...`}
                  value={outcome}
                  onChange={(e) => updateLearningOutcome(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLearningOutcome(index)}
                  disabled={formData.learning_outcomes.length === 1}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLearningOutcome}>
              <Plus className="h-4 w-4 mr-2" />
              Kazanım Ekle
            </Button>
          </CardContent>
        </Card>

        {/* Haftalık Konular */}
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Calendar className="h-5 w-5" />
              Haftalık Konular
            </CardTitle>
            <CardDescription>14 haftalık ders planı</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.weekly_topics.map((topic, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm dark:text-white">Hafta {topic.week}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWeeklyTopic(index)}
                    disabled={formData.weekly_topics.length === 1}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Konu</Label>
                  <Input
                    placeholder="Haftalık konu başlığı"
                    value={topic.topic}
                    onChange={(e) => updateWeeklyTopic(index, 'topic', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Açıklama (Opsiyonel)</Label>
                  <Textarea
                    placeholder="Konu hakkında ek açıklama..."
                    value={topic.description || ''}
                    onChange={(e) => updateWeeklyTopic(index, 'description', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addWeeklyTopic}>
              <Plus className="h-4 w-4 mr-2" />
              Hafta Ekle
            </Button>
          </CardContent>
        </Card>

        {/* Önerilen Kaynaklar */}
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Library className="h-5 w-5" />
              Önerilen Kaynaklar
            </CardTitle>
            <CardDescription>Ders için önerilen kitap ve kaynaklar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.recommended_sources.map((source, index) => (
              <div key={index} className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-8 h-9 flex items-center justify-center bg-muted rounded text-sm font-medium">
                  {index + 1}
                </span>
                <Input
                  placeholder="Kaynak adı, yazar, yayınevi..."
                  value={source}
                  onChange={(e) => updateSource(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSource(index)}
                  disabled={formData.recommended_sources.length === 1}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSource}>
              <Plus className="h-4 w-4 mr-2" />
              Kaynak Ekle
            </Button>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSelectedCourse(null)}
          >
            İptal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </Button>
        </div>
      </form>
    </div>
  );
}
