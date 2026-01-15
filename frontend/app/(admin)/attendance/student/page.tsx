"use client";

import { useEffect, useState } from "react";
import { attendanceApi } from "@/lib/api-client";
import type { MyAttendanceResponse } from "@/lib/types";

export default function StudentAttendancePage() {
  const [attendanceData, setAttendanceData] = useState<MyAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const data = await attendanceApi.get("my").json<MyAttendanceResponse>();
      setAttendanceData(data);
    } catch (err: any) {
      setError(err.message || "Yoklama bilgileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleScanQR = async () => {
    if (!qrCode.trim()) {
      setScanResult("Lütfen QR kod değeri girin");
      return;
    }

    try {
      await attendanceApi.post("mark", {
        json: { qr_secret: qrCode },
      });

      setScanResult("Yoklama başarıyla işaretlendi!");
      setQrCode("");

      // Refresh attendance summary
      fetchAttendance();

      setTimeout(() => setScanResult(""), 3000);
    } catch (err: any) {
      setScanResult(err.message || "Yoklama işaretleme başarısız");
    }
  };

  const getStatusColor = (absentCount: number, totalWeeks: number) => {
    const maxAllowed = Math.floor(totalWeeks * 0.3); // 30% limit
    if (absentCount <= maxAllowed - 1) return "text-green-600";
    if (absentCount === maxAllowed) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusMessage = (absentCount: number, totalWeeks: number) => {
    const maxAllowed = Math.floor(totalWeeks * 0.3); // 30% limit
    const remaining = maxAllowed - absentCount;
    if (remaining > 0) {
      return `✅ ${remaining} devamsızlık hakkı kaldı`;
    }
    if (remaining === 0) {
      return `⚠️ Devamsızlık hakkı doldu - dikkat!`;
    }
    return `❌ Devamsızlık limitini aştınız`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* QR Scanner Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">QR Kod ile Yoklama</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="qr-code" className="block text-sm font-medium text-gray-700 mb-2">
                QR Kod Değeri
              </label>
              <input
                type="text"
                id="qr-code"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="QR kod değerini girin veya tarayın"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleScanQR}
              className="px-6 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium"
            >
              Yoklama İşaretle
            </button>

            {scanResult && (
              <div
                className={`rounded-md p-4 ${
                  scanResult.includes("başarıyla") ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <p
                  className={`text-sm ${
                    scanResult.includes("başarıyla") ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {scanResult}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Yoklama Durumum</h2>

          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!attendanceData || attendanceData.courses.length === 0 ? (
            <p className="text-gray-600">Yoklama bilgisi bulunamadı.</p>
          ) : (
            <div className="space-y-4">
              <div className="mb-4 text-sm text-gray-600">
                <p>Öğrenci: {attendanceData.student_number}</p>
                <p>Dönem: {attendanceData.semester}</p>
              </div>
              {attendanceData.courses.map((course) => (
                <div key={course.course_id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {course.course_code} - {course.course_name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Öğretim Üyesi: {course.instructor}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-600">Toplam Hafta</p>
                      <p className="font-semibold text-gray-900">{course.total_weeks}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Tamamlanan</p>
                      <p className="font-semibold text-blue-600">{course.completed_weeks}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Katıldı</p>
                      <p className="font-semibold text-green-600">{course.present_count}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Devamsız</p>
                      <p className="font-semibold text-red-600">{course.absent_count}</p>
                    </div>
                  </div>

                  {course.absent_weeks.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600">
                        Devamsız olunan haftalar: {course.absent_weeks.join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t">
                    <p className={`font-medium ${getStatusColor(course.absent_count, course.total_weeks)}`}>
                      {getStatusMessage(course.absent_count, course.total_weeks)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
