"use client";

import { useEffect, useState } from "react";
import { attendanceApi } from "@/lib/api-client";
import type { AttendanceSession, CourseOffering } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";

export default function TeacherAttendancePage() {
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (activeSession) {
      // Refresh QR code every 15 seconds
      interval = setInterval(() => {
        refreshSession();
      }, 15000);

      // Update attendance count every 3 seconds
      const countInterval = setInterval(() => {
        fetchAttendanceCount();
      }, 3000);

      return () => {
        clearInterval(interval);
        clearInterval(countInterval);
      };
    }

    return () => {};
  }, [activeSession]);

  const fetchCourses = async () => {
    try {
      const data = await attendanceApi.get("teacher/courses").json<CourseOffering[]>();
      setCourses(data);
    } catch (err: any) {
      setError(err.message || "Dersler yüklenemedi");
    }
  };

  const startSession = async () => {
    if (!selectedCourse || !weekNumber) {
      setError("Lütfen ders ve hafta seçin");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const session = await attendanceApi
        .post("sessions", {
          json: {
            course_offering_id: selectedCourse,
            week_number: weekNumber,
          },
        })
        .json<AttendanceSession>();

      setActiveSession(session);
      setAttendanceCount(0);
    } catch (err: any) {
      setError(err.message || "Oturum başlatılamadı");
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    if (!activeSession) return;

    try {
      const session = await attendanceApi
        .get(`sessions/${activeSession.id}/refresh`)
        .json<AttendanceSession>();

      setActiveSession(session);
    } catch (err: any) {
      console.error("Session refresh failed:", err);
    }
  };

  const fetchAttendanceCount = async () => {
    if (!activeSession) return;

    try {
      const data = await attendanceApi
        .get(`sessions/${activeSession.id}/count`)
        .json<{ count: number }>();

      setAttendanceCount(data.count);
    } catch (err: any) {
      console.error("Attendance count fetch failed:", err);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;

    if (!confirm("Yoklama oturumunu kapatmak istediğinize emin misiniz?")) {
      return;
    }

    try {
      await attendanceApi.post(`sessions/${activeSession.id}/close`);
      setActiveSession(null);
      setAttendanceCount(0);
      alert("Yoklama oturumu başarıyla kapatıldı");
    } catch (err: any) {
      setError(err.message || "Oturum kapatılamadı");
    }
  };

  if (activeSession) {
    const remainingTime = new Date(activeSession.expires_at).getTime() - Date.now();
    const remainingMinutes = Math.max(0, Math.floor(remainingTime / 60000));

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {activeSession.course_code} - {activeSession.course_name}
          </h1>
          <p className="text-xl text-gray-600 mb-6">Hafta {activeSession.week_number} - Yoklama</p>

          <div className="mb-6">
            <QRCodeSVG value={activeSession.qr_secret} size={300} className="mx-auto" />
          </div>

          <div className="mb-6 space-y-2">
            <p className="text-lg font-semibold text-gray-700">
              Katılan Öğrenci Sayısı: <span className="text-indigo-600 text-2xl">{attendanceCount}</span>
            </p>
            <p className="text-sm text-gray-600">
              Kalan Süre: <span className="font-medium">{remainingMinutes} dakika</span>
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={endSession}
              className="px-6 py-3 text-white bg-red-600 hover:bg-red-700 rounded-md font-medium"
            >
              Oturumu Kapat
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            QR kod her 15 saniyede bir otomatik olarak yenilenir
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Yoklama Oturumu Başlat</h1>

          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-2">
                Ders Seçin
              </label>
              <select
                id="course"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Ders seçin</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_code} - {course.course_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="week" className="block text-sm font-medium text-gray-700 mb-2">
                Hafta Numarası
              </label>
              <input
                type="number"
                id="week"
                min="1"
                max="14"
                value={weekNumber}
                onChange={(e) => setWeekNumber(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              onClick={startSession}
              disabled={loading || !selectedCourse}
              className="w-full px-6 py-3 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Başlatılıyor..." : "Yoklama Oturumu Başlat"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
