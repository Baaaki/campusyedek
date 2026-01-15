'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Phone,
  Plus,
  Trash2,
  Save,
  Printer,
  GraduationCap,
  FileText,
  Award,
  Briefcase,
  BookOpen,
  User,
  Camera,
} from 'lucide-react';

// Eğitim bilgisi interface
interface EducationInfo {
  id: string;
  degree: string;
  institution: string;
  department: string;
  year: number;
}

// Makale interface
interface Article {
  id: string;
  title: string;
  journal: string;
  year: number;
  authors: string;
  doi?: string;
  journalType?: string; // SCI, SCI-Expanded, SSCI, etc.
  domesticInternational?: string; // Yurtiçi/Yurtdışı
  publishingMonth?: string;
  issuePageYear?: string; // Volume/Issue/Page info
  language?: string;
  articleType?: string; // Research article, Review, etc.
}

// Bildiri interface
interface Bulletin {
  id: string;
  title: string;
  conference: string;
  year: number;
  location: string;
}

// Proje interface
interface Project {
  id: string;
  title: string;
  role: string;
  funder: string;
  startYear: number;
  endYear?: number;
  status: 'ongoing' | 'completed';
}

// Ödül interface
interface AwardItem {
  id: string;
  title: string;
  institution: string;
  year: number;
}

// Burs interface
interface Scholarship {
  id: string;
  title: string;
  institution: string;
  year: number;
}

// İdari görev interface
interface AdminAssignment {
  id: string;
  title: string;
  institution: string;
  startYear: number;
  endYear?: number;
}

// Mock profile data
const initialProfile = {
  title: 'Prof. Dr.',
  firstName: 'Ayşe',
  lastName: 'Yıldırım',
  faculty: 'FEN FAKÜLTESİ',
  department: 'BİLGİSAYAR BİLİMLERİ BÖLÜMÜ',
  email: 'ayse.yildirim@deu.edu.tr',
  phone: '+90 232 - 3019514 - 19514',
  profileImage: 'https://i.pravatar.cc/150?img=47', // Mock profil resmi (kadın akademisyen)
  education: [
    { id: '1', degree: 'Ön Lisans', institution: 'Ege Üniversitesi Ege Meslek Yüksekokulu Bilgisayar Programcılığı', department: '', year: 1996 },
    { id: '2', degree: 'Lisans', institution: 'Ege Üniversitesi Fen Fakültesi Matematik (Bilgisayar Bilim.Ağır.Mate.Prog.', department: '', year: 2003 },
    { id: '3', degree: 'Yüksek Lisans', institution: 'Ege Üniversitesi Fen Bilimleri Enstitüsü Matematik Anabilim Dalı', department: '', year: 2006 },
    { id: '4', degree: 'Doktora', institution: 'Ege Üniversitesi Fen Bilimleri Enstitüsü Matematik Anabilim Dalı', department: '', year: 2009 },
    { id: '5', degree: 'Yardımcı Doçent', institution: 'Dokuz Eylül Üniversitesi Fen Fakültesi', department: '', year: 2011 },
    { id: '6', degree: 'Doçent', institution: 'Dokuz Eylül Üniversitesi Fen Fakültesi Matematik', department: '', year: 2017 },
    { id: '7', degree: 'Profesör', institution: 'Dokuz Eylül Üniversitesi Fen Fakültesi', department: '', year: 2023 },
  ] as EducationInfo[],
  articles: [
    {
      id: '1',
      title: 'Graph Theory Applications in Computer Networks',
      journal: 'JOURNAL OF COMPUTER SCIENCE',
      year: 2023,
      authors: 'Yıldırım A., Kaya M.',
      doi: '10.1234/jcs.2023.001',
      journalType: 'SCI-Expanded (Science Citation Index-Expanded)',
      domesticInternational: 'YURTDIŞI',
      publishingMonth: '3/2023',
      issuePageYear: 'Volume 45 / Issue 2 / Page 123-145 / 2023',
      language: 'English',
      articleType: 'Research article'
    },
    {
      id: '2',
      title: 'Machine Learning Approaches for Data Analysis',
      journal: 'INTERNATIONAL JOURNAL OF ARTIFICIAL INTELLIGENCE',
      year: 2022,
      authors: 'Yıldırım A., Demir B., Çelik O.',
      doi: '10.1234/ijai.2022.015',
      journalType: 'SCI (Science Citation Index)',
      domesticInternational: 'YURTDIŞI',
      publishingMonth: '6/2022',
      issuePageYear: 'Volume 38 / Issue 4 / Page 567-589 / 2022',
      language: 'English',
      articleType: 'Research article'
    },
    {
      id: '3',
      title: 'Optimization Algorithms in Software Engineering',
      journal: 'SOFTWARE ENGINEERING REVIEW',
      year: 2021,
      authors: 'Yıldırım A.',
      doi: '10.1234/ser.2021.042',
      journalType: 'ESCI (Emerging Sources Citation Index)',
      domesticInternational: 'YURTDIŞI',
      publishingMonth: '9/2021',
      issuePageYear: 'Volume 22 / Issue 3 / Page 201-220 / 2021',
      language: 'English',
      articleType: 'Review article'
    },
    {
      id: '4',
      title: 'Türkiye\'de Yapay Zeka Uygulamaları',
      journal: 'TÜRKİYE BİLİŞİM DERGİSİ',
      year: 2022,
      authors: 'Yıldırım A., Öztürk E.',
      doi: '10.5678/tbd.2022.008',
      journalType: 'TR Dizin',
      domesticInternational: 'YURTİÇİ',
      publishingMonth: '12/2022',
      issuePageYear: 'Cilt 15 / Sayı 2 / Sayfa 45-67 / 2022',
      language: 'Türkçe',
      articleType: 'Araştırma makalesi'
    },
    {
      id: '5',
      title: 'Leverage centrality analysis of infrastructure networks',
      journal: 'NUMERICAL METHODS FOR PARTIAL DIFFERENTIAL EQUATIONS',
      year: 2021,
      authors: 'Yıldırım A., Berberler M.E.',
      doi: '10.1002/num.22767',
      journalType: 'SCI-Expanded (Science Citation Index-Expanded)',
      domesticInternational: 'YURTDIŞI',
      publishingMonth: '1/2021',
      issuePageYear: 'Volume 37 / Issue 1 / Page 767-781 / 2021',
      language: 'English',
      articleType: 'Research article'
    },
  ] as Article[],
  bulletins: [
    { id: '1', title: 'Deep Learning for Image Recognition', conference: 'IEEE International Conference on AI', year: 2023, location: 'İstanbul, Türkiye' },
    { id: '2', title: 'Blockchain Technology in Education', conference: 'European Conference on Technology', year: 2022, location: 'Berlin, Germany' },
  ] as Bulletin[],
  projects: [
    { id: '1', title: 'Yapay Zeka Destekli Eğitim Sistemi', role: 'Proje Yürütücüsü', funder: 'TÜBİTAK', startYear: 2022, status: 'ongoing' as const },
    { id: '2', title: 'Akıllı Şehir Uygulamaları', role: 'Araştırmacı', funder: 'BAP', startYear: 2020, endYear: 2022, status: 'completed' as const },
  ] as Project[],
  awards: [
    { id: '1', title: 'En İyi Makale Ödülü', institution: 'IEEE Turkey Section', year: 2023 },
    { id: '2', title: 'Bilim Teşvik Ödülü', institution: 'TÜBİTAK', year: 2021 },
  ] as AwardItem[],
  scholarships: [
    { id: '1', title: 'Doktora Sonrası Araştırma Bursu', institution: 'Fulbright', year: 2015 },
  ] as Scholarship[],
  adminAssignments: [
    { id: '1', title: 'Bölüm Başkan Yardımcısı', institution: 'DEÜ Fen Fakültesi Bilgisayar Bilimleri', startYear: 2020 },
    { id: '2', title: 'Erasmus Koordinatörü', institution: 'DEÜ Fen Fakültesi', startYear: 2018, endYear: 2020 },
  ] as AdminAssignment[],
};

export default function StaffProfilePage() {
  const [profile, setProfile] = useState(initialProfile);
  const [activeTab, setActiveTab] = useState('education');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Basic info handlers
  const handleBasicInfoChange = (field: string, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // Education handlers
  const addEducation = () => {
    const newEdu: EducationInfo = {
      id: Date.now().toString(),
      degree: '',
      institution: '',
      department: '',
      year: new Date().getFullYear(),
    };
    setProfile(prev => ({ ...prev, education: [...prev.education, newEdu] }));
  };

  const updateEducation = (id: string, field: keyof EducationInfo, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      education: prev.education.map(edu =>
        edu.id === id ? { ...edu, [field]: value } : edu
      ),
    }));
  };

  const removeEducation = (id: string) => {
    setProfile(prev => ({
      ...prev,
      education: prev.education.filter(edu => edu.id !== id),
    }));
  };

  // Article handlers
  const addArticle = () => {
    const newArticle: Article = {
      id: Date.now().toString(),
      title: '',
      journal: '',
      year: new Date().getFullYear(),
      authors: '',
    };
    setProfile(prev => ({ ...prev, articles: [...prev.articles, newArticle] }));
  };

  const updateArticle = (id: string, field: keyof Article, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      articles: prev.articles.map(art =>
        art.id === id ? { ...art, [field]: value } : art
      ),
    }));
  };

  const removeArticle = (id: string) => {
    setProfile(prev => ({
      ...prev,
      articles: prev.articles.filter(art => art.id !== id),
    }));
  };

  // Bulletin handlers
  const addBulletin = () => {
    const newBulletin: Bulletin = {
      id: Date.now().toString(),
      title: '',
      conference: '',
      year: new Date().getFullYear(),
      location: '',
    };
    setProfile(prev => ({ ...prev, bulletins: [...prev.bulletins, newBulletin] }));
  };

  const updateBulletin = (id: string, field: keyof Bulletin, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      bulletins: prev.bulletins.map(bul =>
        bul.id === id ? { ...bul, [field]: value } : bul
      ),
    }));
  };

  const removeBulletin = (id: string) => {
    setProfile(prev => ({
      ...prev,
      bulletins: prev.bulletins.filter(bul => bul.id !== id),
    }));
  };

  // Project handlers
  const addProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      title: '',
      role: '',
      funder: '',
      startYear: new Date().getFullYear(),
      status: 'ongoing',
    };
    setProfile(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
  };

  const updateProject = (id: string, field: keyof Project, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === id ? { ...proj, [field]: value } : proj
      ),
    }));
  };

  const removeProject = (id: string) => {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.filter(proj => proj.id !== id),
    }));
  };

  // Award handlers
  const addAward = () => {
    const newAward: AwardItem = {
      id: Date.now().toString(),
      title: '',
      institution: '',
      year: new Date().getFullYear(),
    };
    setProfile(prev => ({ ...prev, awards: [...prev.awards, newAward] }));
  };

  const updateAward = (id: string, field: keyof AwardItem, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      awards: prev.awards.map(aw =>
        aw.id === id ? { ...aw, [field]: value } : aw
      ),
    }));
  };

  const removeAward = (id: string) => {
    setProfile(prev => ({
      ...prev,
      awards: prev.awards.filter(aw => aw.id !== id),
    }));
  };

  // Scholarship handlers
  const addScholarship = () => {
    const newScholarship: Scholarship = {
      id: Date.now().toString(),
      title: '',
      institution: '',
      year: new Date().getFullYear(),
    };
    setProfile(prev => ({ ...prev, scholarships: [...prev.scholarships, newScholarship] }));
  };

  const updateScholarship = (id: string, field: keyof Scholarship, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      scholarships: prev.scholarships.map(sch =>
        sch.id === id ? { ...sch, [field]: value } : sch
      ),
    }));
  };

  const removeScholarship = (id: string) => {
    setProfile(prev => ({
      ...prev,
      scholarships: prev.scholarships.filter(sch => sch.id !== id),
    }));
  };

  // Admin assignment handlers
  const addAdminAssignment = () => {
    const newAssignment: AdminAssignment = {
      id: Date.now().toString(),
      title: '',
      institution: '',
      startYear: new Date().getFullYear(),
    };
    setProfile(prev => ({ ...prev, adminAssignments: [...prev.adminAssignments, newAssignment] }));
  };

  const updateAdminAssignment = (id: string, field: keyof AdminAssignment, value: string | number | undefined) => {
    setProfile(prev => ({
      ...prev,
      adminAssignments: prev.adminAssignments.map(assign =>
        assign.id === id ? { ...assign, [field]: value } : assign
      ),
    }));
  };

  const removeAdminAssignment = (id: string) => {
    setProfile(prev => ({
      ...prev,
      adminAssignments: prev.adminAssignments.filter(assign => assign.id !== id),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: API'ye gönder
    console.log('Profile Data:', profile);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setIsEditing(false);
    alert('Profil başarıyla kaydedildi!');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header - DEU Style */}
      <div className="bg-[#005a87] text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Profil Resmi */}
              <div className="relative group">
                <div className="w-28 h-28 rounded-lg overflow-hidden border-4 border-white/30 shadow-lg bg-white/10">
                  {profile.profileImage ? (
                    <img
                      src={profile.profileImage}
                      alt={`${profile.firstName} ${profile.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-16 h-16 text-white/60" />
                    </div>
                  )}
                </div>
                {isEditing && (
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                    onClick={() => {
                      const url = prompt('Profil resmi URL\'si girin:', profile.profileImage);
                      if (url !== null) {
                        handleBasicInfoChange('profileImage', url);
                      }
                    }}
                  >
                    <Camera className="w-8 h-8 text-white" />
                  </button>
                )}
              </div>
              {/* Bilgiler */}
              <div>
                <h1 className="text-2xl font-bold">
                  {profile.title} {profile.firstName.toUpperCase()} {profile.lastName.toUpperCase()}
                </h1>
                <p className="text-sm mt-1 text-blue-100 italic">
                  {profile.faculty} {profile.department}
                </p>
                <div className="flex items-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{profile.phone}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Printer className="h-4 w-4 mr-2" />
                Yazdır
              </Button>
              {!isEditing ? (
                <Button size="sm" onClick={() => setIsEditing(true)} className="bg-white text-[#005a87] hover:bg-gray-100">
                  Düzenle
                </Button>
              ) : (
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Basic Info Edit (when editing) */}
      {isEditing && (
        <div className="container mx-auto px-4 py-4">
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-4">Temel Bilgiler</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Unvan</Label>
                  <Select value={profile.title} onValueChange={(v) => handleBasicInfoChange('title', v)}>
                    <SelectTrigger>
                      <SelectValue />
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
                  <Label>Ad</Label>
                  <Input value={profile.firstName} onChange={(e) => handleBasicInfoChange('firstName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Soyad</Label>
                  <Input value={profile.lastName} onChange={(e) => handleBasicInfoChange('lastName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input value={profile.email} onChange={(e) => handleBasicInfoChange('email', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={profile.phone} onChange={(e) => handleBasicInfoChange('phone', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Fakülte</Label>
                  <Input value={profile.faculty} onChange={(e) => handleBasicInfoChange('faculty', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Bölüm</Label>
                  <Input value={profile.department} onChange={(e) => handleBasicInfoChange('department', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white dark:bg-gray-900 border mb-6 flex-wrap h-auto p-1">
            <TabsTrigger value="education" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              EĞİTİM
            </TabsTrigger>
            <TabsTrigger value="articles" className="gap-2">
              <FileText className="h-4 w-4" />
              MAKALELER
            </TabsTrigger>
            <TabsTrigger value="bulletins" className="gap-2">
              <BookOpen className="h-4 w-4" />
              BİLDİRİLER
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <Briefcase className="h-4 w-4" />
              PROJELER
            </TabsTrigger>
            <TabsTrigger value="awards" className="gap-2">
              <Award className="h-4 w-4" />
              ÖDÜLLER
            </TabsTrigger>
            <TabsTrigger value="scholarships">BURSLAR</TabsTrigger>
            <TabsTrigger value="admin">AKADEMİK & İDARİ GÖREVLER</TabsTrigger>
          </TabsList>

          {/* Education Tab */}
          <TabsContent value="education">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Eğitim / Akademik Bilgileri</h3>
                  {isEditing && (
                    <Button size="sm" variant="outline" onClick={addEducation}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ekle
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Derece</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Kurum</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Yıl</th>
                        {isEditing && <th className="w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {profile.education.map((edu) => (
                        <tr key={edu.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <Input
                                value={edu.degree}
                                onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              edu.degree
                            )}
                          </td>
                          <td className="py-3 px-4 text-blue-600 dark:text-blue-400">
                            {isEditing ? (
                              <Input
                                value={edu.institution}
                                onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              edu.institution
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={edu.year}
                                onChange={(e) => updateEducation(edu.id, 'year', parseInt(e.target.value))}
                                className="h-8 w-24 text-right"
                              />
                            ) : (
                              edu.year
                            )}
                          </td>
                          {isEditing && (
                            <td className="py-3 px-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEducation(edu.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Articles Tab */}
          <TabsContent value="articles">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Makaleler</h3>
                  {isEditing && (
                    <Button size="sm" variant="outline" onClick={addArticle}>
                      <Plus className="h-4 w-4 mr-2" />
                      Makale Ekle
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-4">
                    {profile.articles.map((article, index) => (
                      <div key={article.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Makale #{index + 1}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeArticle(article.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Makale Başlığı"
                          value={article.title}
                          onChange={(e) => updateArticle(article.id, 'title', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="Dergi Adı"
                            value={article.journal}
                            onChange={(e) => updateArticle(article.id, 'journal', e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="Yıl"
                            value={article.year}
                            onChange={(e) => updateArticle(article.id, 'year', parseInt(e.target.value))}
                          />
                        </div>
                        <Input
                          placeholder="Yazarlar"
                          value={article.authors}
                          onChange={(e) => updateArticle(article.id, 'authors', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="Dergi Tipi (SCI, SCI-Expanded, vb.)"
                            value={article.journalType || ''}
                            onChange={(e) => updateArticle(article.id, 'journalType', e.target.value)}
                          />
                          <Input
                            placeholder="Yurtiçi/Yurtdışı"
                            value={article.domesticInternational || ''}
                            onChange={(e) => updateArticle(article.id, 'domesticInternational', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <Input
                            placeholder="Yayın Ayı/Yılı"
                            value={article.publishingMonth || ''}
                            onChange={(e) => updateArticle(article.id, 'publishingMonth', e.target.value)}
                          />
                          <Input
                            placeholder="Cilt/Sayı/Sayfa"
                            value={article.issuePageYear || ''}
                            onChange={(e) => updateArticle(article.id, 'issuePageYear', e.target.value)}
                          />
                          <Input
                            placeholder="Dil"
                            value={article.language || ''}
                            onChange={(e) => updateArticle(article.id, 'language', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="Makale Tipi"
                            value={article.articleType || ''}
                            onChange={(e) => updateArticle(article.id, 'articleType', e.target.value)}
                          />
                          <Input
                            placeholder="DOI (opsiyonel)"
                            value={article.doi || ''}
                            onChange={(e) => updateArticle(article.id, 'doi', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50 dark:bg-gray-800">
                          <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-12">NO</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">NAME</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400 w-20">YEAR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.articles.map((article, index) => (
                          <tr
                            key={article.id}
                            className="border-b last:border-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer group relative"
                          >
                            <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                            <td className="py-3 px-4">
                              <span className="text-blue-600 dark:text-blue-400 hover:underline">
                                {article.title}...
                              </span>
                              {/* Hover Tooltip */}
                              <div className="absolute left-1/4 top-full mt-1 z-50 hidden group-hover:block w-[500px]">
                                <div className="bg-white dark:bg-gray-800 border-2 border-orange-400 rounded-lg shadow-xl p-4 text-sm">
                                  <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-3 border-b pb-2">
                                    {article.title}
                                  </h4>
                                  <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
                                    <p>
                                      <span className="font-semibold text-gray-900 dark:text-gray-100">JOURNAL NAME:</span>{' '}
                                      {article.journal}
                                    </p>
                                    {article.journalType && (
                                      <p>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">JOURNAL TYPE:</span>{' '}
                                        {article.journalType}
                                      </p>
                                    )}
                                    {article.domesticInternational && (
                                      <p>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">DOMESTIC/INTERNATIONAL:</span>{' '}
                                        {article.domesticInternational}
                                      </p>
                                    )}
                                    {article.publishingMonth && (
                                      <p>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">PUBLISHING MONTH/YEAR:</span>{' '}
                                        {article.publishingMonth}
                                      </p>
                                    )}
                                    {article.issuePageYear && (
                                      <p>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">ISSUE/PAGE/YEAR:</span>{' '}
                                        {article.issuePageYear}
                                      </p>
                                    )}
                                    {article.language && (
                                      <p>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">LANGUAGE:</span>{' '}
                                        {article.language}
                                      </p>
                                    )}
                                    {article.articleType && (
                                      <p>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">ARTICLE TYPE:</span>{' '}
                                        {article.articleType}
                                      </p>
                                    )}
                                    <p>
                                      <span className="font-semibold text-gray-900 dark:text-gray-100">AUTHORS:</span>{' '}
                                      {article.authors}
                                    </p>
                                    {article.doi && (
                                      <p>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">DOI:</span>{' '}
                                        {article.doi}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">{article.year}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulletins Tab */}
          <TabsContent value="bulletins">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Bildiriler</h3>
                  {isEditing && (
                    <Button size="sm" variant="outline" onClick={addBulletin}>
                      <Plus className="h-4 w-4 mr-2" />
                      Bildiri Ekle
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  {profile.bulletins.map((bulletin, index) => (
                    <div key={bulletin.id} className="p-4 border rounded-lg">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Bildiri #{index + 1}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBulletin(bulletin.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Bildiri Başlığı"
                            value={bulletin.title}
                            onChange={(e) => updateBulletin(bulletin.id, 'title', e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              placeholder="Konferans Adı"
                              value={bulletin.conference}
                              onChange={(e) => updateBulletin(bulletin.id, 'conference', e.target.value)}
                            />
                            <Input
                              type="number"
                              placeholder="Yıl"
                              value={bulletin.year}
                              onChange={(e) => updateBulletin(bulletin.id, 'year', parseInt(e.target.value))}
                            />
                          </div>
                          <Input
                            placeholder="Yer"
                            value={bulletin.location}
                            onChange={(e) => updateBulletin(bulletin.id, 'location', e.target.value)}
                          />
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-medium text-blue-600 dark:text-blue-400">{bulletin.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {bulletin.conference}, {bulletin.year}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">{bulletin.location}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Projeler</h3>
                  {isEditing && (
                    <Button size="sm" variant="outline" onClick={addProject}>
                      <Plus className="h-4 w-4 mr-2" />
                      Proje Ekle
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  {profile.projects.map((project, index) => (
                    <div key={project.id} className="p-4 border rounded-lg">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Proje #{index + 1}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProject(project.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Proje Başlığı"
                            value={project.title}
                            onChange={(e) => updateProject(project.id, 'title', e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              placeholder="Rol"
                              value={project.role}
                              onChange={(e) => updateProject(project.id, 'role', e.target.value)}
                            />
                            <Input
                              placeholder="Destekleyen Kuruluş"
                              value={project.funder}
                              onChange={(e) => updateProject(project.id, 'funder', e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <Input
                              type="number"
                              placeholder="Başlangıç Yılı"
                              value={project.startYear}
                              onChange={(e) => updateProject(project.id, 'startYear', parseInt(e.target.value))}
                            />
                            <Input
                              type="number"
                              placeholder="Bitiş Yılı"
                              value={project.endYear || ''}
                              onChange={(e) => updateProject(project.id, 'endYear', parseInt(e.target.value) || undefined)}
                            />
                            <Select
                              value={project.status}
                              onValueChange={(v) => updateProject(project.id, 'status', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ongoing">Devam Ediyor</SelectItem>
                                <SelectItem value="completed">Tamamlandı</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-blue-600 dark:text-blue-400">{project.title}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded ${project.status === 'ongoing' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                              {project.status === 'ongoing' ? 'Devam Ediyor' : 'Tamamlandı'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {project.role} - {project.funder}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {project.startYear} - {project.endYear || 'Devam'}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Awards Tab */}
          <TabsContent value="awards">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Ödüller</h3>
                  {isEditing && (
                    <Button size="sm" variant="outline" onClick={addAward}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ödül Ekle
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Ödül Adı</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Veren Kurum</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Yıl</th>
                        {isEditing && <th className="w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {profile.awards.map((award) => (
                        <tr key={award.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <Input
                                value={award.title}
                                onChange={(e) => updateAward(award.id, 'title', e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              award.title
                            )}
                          </td>
                          <td className="py-3 px-4 text-blue-600 dark:text-blue-400">
                            {isEditing ? (
                              <Input
                                value={award.institution}
                                onChange={(e) => updateAward(award.id, 'institution', e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              award.institution
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={award.year}
                                onChange={(e) => updateAward(award.id, 'year', parseInt(e.target.value))}
                                className="h-8 w-24 text-right"
                              />
                            ) : (
                              award.year
                            )}
                          </td>
                          {isEditing && (
                            <td className="py-3 px-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAward(award.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scholarships Tab */}
          <TabsContent value="scholarships">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Burslar</h3>
                  {isEditing && (
                    <Button size="sm" variant="outline" onClick={addScholarship}>
                      <Plus className="h-4 w-4 mr-2" />
                      Burs Ekle
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Burs Adı</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Veren Kurum</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Yıl</th>
                        {isEditing && <th className="w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {profile.scholarships.map((scholarship) => (
                        <tr key={scholarship.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <Input
                                value={scholarship.title}
                                onChange={(e) => updateScholarship(scholarship.id, 'title', e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              scholarship.title
                            )}
                          </td>
                          <td className="py-3 px-4 text-blue-600 dark:text-blue-400">
                            {isEditing ? (
                              <Input
                                value={scholarship.institution}
                                onChange={(e) => updateScholarship(scholarship.id, 'institution', e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              scholarship.institution
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={scholarship.year}
                                onChange={(e) => updateScholarship(scholarship.id, 'year', parseInt(e.target.value))}
                                className="h-8 w-24 text-right"
                              />
                            ) : (
                              scholarship.year
                            )}
                          </td>
                          {isEditing && (
                            <td className="py-3 px-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeScholarship(scholarship.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Assignments Tab */}
          <TabsContent value="admin">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Akademik & İdari Görevler</h3>
                  {isEditing && (
                    <Button size="sm" variant="outline" onClick={addAdminAssignment}>
                      <Plus className="h-4 w-4 mr-2" />
                      Görev Ekle
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Görev</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Kurum</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Dönem</th>
                        {isEditing && <th className="w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {profile.adminAssignments.map((assignment) => (
                        <tr key={assignment.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <Input
                                value={assignment.title}
                                onChange={(e) => updateAdminAssignment(assignment.id, 'title', e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              assignment.title
                            )}
                          </td>
                          <td className="py-3 px-4 text-blue-600 dark:text-blue-400">
                            {isEditing ? (
                              <Input
                                value={assignment.institution}
                                onChange={(e) => updateAdminAssignment(assignment.id, 'institution', e.target.value)}
                                className="h-8"
                              />
                            ) : (
                              assignment.institution
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <div className="flex gap-2 justify-end">
                                <Input
                                  type="number"
                                  placeholder="Başlangıç"
                                  value={assignment.startYear}
                                  onChange={(e) => updateAdminAssignment(assignment.id, 'startYear', parseInt(e.target.value))}
                                  className="h-8 w-20 text-right"
                                />
                                <span className="self-center">-</span>
                                <Input
                                  type="number"
                                  placeholder="Bitiş"
                                  value={assignment.endYear || ''}
                                  onChange={(e) => updateAdminAssignment(assignment.id, 'endYear', e.target.value ? parseInt(e.target.value) : undefined)}
                                  className="h-8 w-20 text-right"
                                />
                              </div>
                            ) : (
                              `${assignment.startYear} - ${assignment.endYear || 'Devam'}`
                            )}
                          </td>
                          {isEditing && (
                            <td className="py-3 px-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAdminAssignment(assignment.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
