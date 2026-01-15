"use client";

import { useEffect, useState } from "react";
import { gradesApi } from "@/lib/api-client";
import type { MyGradesResponse, TranscriptResponse } from "@/lib/types";

export default function StudentGradesPage() {
  const [gradesData, setGradesData] = useState<MyGradesResponse | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResponse | null>(null);
  const [view, setView] = useState<'current' | 'transcript'>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      const data = await gradesApi.get("my").json<MyGradesResponse>();
      setGradesData(data);

      // Fetch transcript as well
      const transcriptData = await gradesApi.get("transcript/my").json<TranscriptResponse>();
      setTranscript(transcriptData);
    } catch (err: any) {
      setError(err.message || "Notlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Yükleniyor...</p>
      </div>
    );
  }

  if (error || !gradesData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error || "Not bilgileri bulunamadı"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Not Bilgilerim</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Öğrenci Numarası</p>
              <p className="font-semibold text-gray-900">{gradesData.student_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Toplam Kredi</p>
              <p className="font-semibold text-gray-900">{gradesData.total_credits}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Genel Not Ortalaması</p>
              <p className="font-semibold text-indigo-600 text-xl">
                {gradesData.cumulative_gpa.toFixed(2)}
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setView('current')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                view === 'current'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Güncel Dersler
            </button>
            <button
              onClick={() => setView('transcript')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                view === 'transcript'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Transkript
            </button>
          </div>
        </div>

        {view === 'current' ? (
          <>
            {/* Active Courses */}
            {gradesData.active_courses.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Devam Eden Dersler</h2>
                <div className="space-y-4">
                  {gradesData.active_courses.map((course) => (
                    <div key={course.course_code} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{course.course_code}</h3>
                          <p className="text-sm text-gray-600">{course.course_name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {course.semester} • {course.credits} Kredi
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {Object.entries(course.scores).map(([slug, scoreDetail]) => (
                          <div key={slug} className="bg-gray-50 rounded p-3">
                            <p className="text-xs text-gray-600 mb-1">{slug}</p>
                            {scoreDetail.is_absent ? (
                              <p className="text-sm font-semibold text-red-600">Devamsız</p>
                            ) : scoreDetail.score !== null ? (
                              <p className="text-sm font-semibold text-gray-900">
                                {scoreDetail.score.toFixed(0)}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400">-</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Courses */}
            {gradesData.completed_courses.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Tamamlanan Dersler</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Ders Kodu
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Ders Adı
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Dönem
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Kredi
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Ortalama
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Harf Notu
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {gradesData.completed_courses.map((course) => (
                        <tr key={course.course_code + course.semester}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {course.course_code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {course.course_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {course.semester}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {course.credits}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {course.weighted_average.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {course.grade_point}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Transcript View */
          transcript && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Resmi Transkript</h2>

              <div className="mb-6 pb-6 border-b">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Öğrenci</p>
                    <p className="font-semibold text-gray-900">
                      {transcript.student.first_name} {transcript.student.last_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {transcript.student.student_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Bölüm</p>
                    <p className="font-semibold text-gray-900">{transcript.student.department}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Kayıt Yılı: {transcript.student.enrollment_year}
                    </p>
                  </div>
                </div>
              </div>

              {/* Semesters */}
              <div className="space-y-6">
                {transcript.semesters.map((semester) => (
                  <div key={semester.semester} className="border-l-4 border-indigo-500 pl-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">
                      {semester.semester_display}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Ders Kodu
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Ders Adı
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Kredi
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Harf Notu
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {semester.courses.map((course) => (
                            <tr key={course.course_code}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {course.course_code}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {course.course_name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {course.credits}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  {course.grade_point}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 flex justify-end gap-4 text-sm">
                      <span className="text-gray-600">
                        Dönem Kredisi: <span className="font-semibold">{semester.semester_credits}</span>
                      </span>
                      <span className="text-gray-600">
                        Dönem Not Ortalaması: <span className="font-semibold">{semester.semester_gpa.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-8 pt-6 border-t">
                <div className="flex justify-end gap-8 text-lg">
                  <div>
                    <span className="text-gray-600">Toplam Kredi: </span>
                    <span className="font-bold text-gray-900">{transcript.summary.total_credits}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Genel Ortalama: </span>
                    <span className="font-bold text-indigo-600 text-xl">
                      {transcript.summary.cumulative_gpa.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-right mt-2">
                  Oluşturulma Tarihi: {new Date(transcript.generated_at).toLocaleDateString('tr-TR')}
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
