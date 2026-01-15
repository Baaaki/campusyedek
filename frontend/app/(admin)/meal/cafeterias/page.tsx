'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Cafeteria } from '@/lib/types';
import {
  Plus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  MapPin,
  Leaf,
  Moon,
  Search,
} from 'lucide-react';

// Mock data
const initialCafeterias: Cafeteria[] = [
  {
    id: '1',
    name: 'Merkez Yemekhane',
    location: 'Ana Kampüs, A Blok',
    has_vegan_menu: true,
    serves_dinner: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Mühendislik Yemekhanesi',
    location: 'Mühendislik Fakültesi, Zemin Kat',
    has_vegan_menu: true,
    serves_dinner: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Fen Fakültesi Kafeteryası',
    location: 'Fen Fakültesi, B Blok',
    has_vegan_menu: false,
    serves_dinner: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'Tınaztepe Yemekhanesi',
    location: 'Tınaztepe Kampüsü',
    has_vegan_menu: true,
    serves_dinner: true,
    is_active: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

interface CafeteriaFormData {
  name: string;
  location: string;
  has_vegan_menu: boolean;
  serves_dinner: boolean;
  is_active: boolean;
}

const initialFormData: CafeteriaFormData = {
  name: '',
  location: '',
  has_vegan_menu: false,
  serves_dinner: false,
  is_active: true,
};

export default function CafeteriasPage() {
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>(initialCafeterias);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCafeteria, setEditingCafeteria] = useState<Cafeteria | null>(null);
  const [deletingCafeteria, setDeletingCafeteria] = useState<Cafeteria | null>(null);
  const [formData, setFormData] = useState<CafeteriaFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtreleme
  const filteredCafeterias = cafeterias.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Yeni ekleme dialogunu aç
  const handleAddClick = () => {
    setEditingCafeteria(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  // Düzenleme dialogunu aç
  const handleEditClick = (cafeteria: Cafeteria) => {
    setEditingCafeteria(cafeteria);
    setFormData({
      name: cafeteria.name,
      location: cafeteria.location,
      has_vegan_menu: cafeteria.has_vegan_menu,
      serves_dinner: cafeteria.serves_dinner,
      is_active: cafeteria.is_active,
    });
    setIsDialogOpen(true);
  };

  // Silme dialogunu aç
  const handleDeleteClick = (cafeteria: Cafeteria) => {
    setDeletingCafeteria(cafeteria);
    setIsDeleteDialogOpen(true);
  };

  // Form gönderimi
  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Simüle edilmiş API çağrısı
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (editingCafeteria) {
      // Güncelleme
      setCafeterias((prev) =>
        prev.map((c) =>
          c.id === editingCafeteria.id
            ? {
                ...c,
                ...formData,
                updated_at: new Date().toISOString(),
              }
            : c
        )
      );
    } else {
      // Yeni ekleme
      const newCafeteria: Cafeteria = {
        id: Date.now().toString(),
        ...formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCafeterias((prev) => [...prev, newCafeteria]);
    }

    setIsSubmitting(false);
    setIsDialogOpen(false);
    setFormData(initialFormData);
  };

  // Silme işlemi
  const handleDelete = async () => {
    if (!deletingCafeteria) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    setCafeterias((prev) => prev.filter((c) => c.id !== deletingCafeteria.id));

    setIsSubmitting(false);
    setIsDeleteDialogOpen(false);
    setDeletingCafeteria(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Yemekhane Yönetimi</h1>
          <p className="text-muted-foreground">Yemekhaneleri ekleyin, düzenleyin veya silin</p>
        </div>
        <Button onClick={handleAddClick}>
          <Plus className="h-4 w-4 mr-2" />
          Yemekhane Ekle
        </Button>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam</p>
                <p className="text-2xl font-bold dark:text-white">{cafeterias.length}</p>
              </div>
              <UtensilsCrossed className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktif</p>
                <p className="text-2xl font-bold text-green-600">
                  {cafeterias.filter((c) => c.is_active).length}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vegan Menü</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {cafeterias.filter((c) => c.has_vegan_menu).length}
                </p>
              </div>
              <Leaf className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Akşam Servisi</p>
                <p className="text-2xl font-bold text-purple-600">
                  {cafeterias.filter((c) => c.serves_dinner).length}
                </p>
              </div>
              <Moon className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Arama ve Liste */}
      <Card className="dark:bg-gray-900 dark:border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="dark:text-white">Yemekhaneler</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Yemekhane Adı</TableHead>
                <TableHead>Konum</TableHead>
                <TableHead className="text-center">Vegan</TableHead>
                <TableHead className="text-center">Akşam</TableHead>
                <TableHead className="text-center">Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCafeterias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Yemekhane bulunamadı
                  </TableCell>
                </TableRow>
              ) : (
                filteredCafeterias.map((cafeteria) => (
                  <TableRow key={cafeteria.id}>
                    <TableCell className="font-medium dark:text-white">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-indigo-500" />
                        {cafeteria.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {cafeteria.location}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {cafeteria.has_vegan_menu ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Leaf className="h-3 w-3 mr-1" />
                          Var
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {cafeteria.serves_dinner ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          <Moon className="h-3 w-3 mr-1" />
                          Var
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {cafeteria.is_active ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Pasif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(cafeteria)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(cafeteria)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ekle/Düzenle Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCafeteria ? 'Yemekhane Düzenle' : 'Yeni Yemekhane Ekle'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Yemekhane Adı *</Label>
              <Input
                id="name"
                placeholder="Örn: Merkez Yemekhane"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Konum *</Label>
              <Input
                id="location"
                placeholder="Örn: Ana Kampüs, A Blok"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_vegan_menu"
                  checked={formData.has_vegan_menu}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, has_vegan_menu: checked as boolean })
                  }
                />
                <Label htmlFor="has_vegan_menu" className="flex items-center gap-2 cursor-pointer">
                  <Leaf className="h-4 w-4 text-emerald-500" />
                  Vegan menü mevcut
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="serves_dinner"
                  checked={formData.serves_dinner}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, serves_dinner: checked as boolean })
                  }
                />
                <Label htmlFor="serves_dinner" className="flex items-center gap-2 cursor-pointer">
                  <Moon className="h-4 w-4 text-purple-500" />
                  Akşam yemeği servisi var
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked as boolean })
                  }
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Aktif
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.location || isSubmitting}
            >
              {isSubmitting ? 'Kaydediliyor...' : editingCafeteria ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yemekhaneyi Sil</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              <strong className="text-foreground">{deletingCafeteria?.name}</strong> yemekhanesini
              silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Siliniyor...' : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
