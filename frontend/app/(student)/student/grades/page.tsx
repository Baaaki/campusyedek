'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function StudentGradesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ders Notları</h1>
          <p className="text-gray-600 dark:text-gray-400">Derslerinizin not durumunu görüntüleyin</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Not Durumu</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400">
            Henüz not kaydı bulunmuyor. Sınavlar tamamlandığında notlarınız burada görüntülenecektir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
