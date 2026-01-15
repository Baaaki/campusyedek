"use client";

import { useEffect, useState } from "react";
import { gradesApi, catalogApi } from "@/lib/api-client";
import type { Grade, CourseOffering } from "@/lib/types";

export default function TeacherGradeEntryPage() {
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchGrades();
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const data = await catalogApi.get("teacher/my-courses").json<CourseOffering[]>();
      setCourses(data);
    } catch (err: any) {
      setError(err.message || "Dersler yüklenemedi");
    }
  };

  const fetchGrades = async () => {
    try {
      setLoading(true);
      const data = await gradesApi
        .get(`course/${selectedCourse}/grades`)
        .json<Grade[]>();
      setGrades(data);
    } catch (err: any) {
      setError(err.message || "Notlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (gradeId: string, assessmentSlug: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) return;

    setGrades((prev) =>
      prev.map((grade) =>
        grade.id === gradeId
          ? {
              ...grade,
              assessment_scores: {
                ...grade.assessment_scores,
                [assessmentSlug]: numValue,
              },
            }
          : grade
      )
    );
  };

  const handleSaveGrades = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await gradesApi.post(`course/${selectedCourse}/grades/bulk`, {
        json: {
          grades: grades.map((g) => ({
            enrollment_id: g.enrollment_id,
            assessment_scores: g.assessment_scores,
          })),
        },
      });

      setSuccess("Notlar başarıyla kaydedildi");
      fetchGrades();
    } catch (err: any) {
      setError(err.message || "Notlar kaydedilemedi");
    } finally {
      setLoading(false);
    }
  };

  const selectedCourseData = courses.find((c) => c.id === selectedCourse);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Not Girişi</h1>

          {/* Course Selection */}
          <div className="mb-6">
            <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-2">
              Ders Seçin
            </label>
            <select
              id="course"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Ders seçin</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4 mb-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {selectedCourse && !loading && grades.length > 0 && selectedCourseData && (
            <>
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">
                        Öğrenci
                      </th>
                      {selectedCourseData.assessment_schema.map((assessment) => (
                        <th
                          key={assessment.slug}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {assessment.name}
                          <br />
                          <span className="text-xs text-gray-400">
                            ({assessment.weight}%)
                          </span>
                        </th>
                      ))}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Final Not
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Harf Notu
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {grades.map((grade) => (
                      <tr key={grade.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          {grade.enrollment_id}
                        </td>
                        {selectedCourseData.assessment_schema.map((assessment) => (
                          <td key={assessment.slug} className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={grade.assessment_scores[assessment.slug] || ""}
                              onChange={(e) =>
                                handleScoreChange(grade.id, assessment.slug, e.target.value)
                              }
                              disabled={grade.is_finalized}
                              className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                            />
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {grade.final_grade ? grade.final_grade.toFixed(2) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {grade.letter_grade ? (
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                grade.letter_grade === "FF"
                                  ? "bg-red-100 text-red-800"
                                  : ["AA", "BA", "BB"].includes(grade.letter_grade)
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {grade.letter_grade}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleSaveGrades}
                disabled={loading}
                className="px-6 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Kaydediliyor..." : "Notları Kaydet"}
              </button>
            </>
          )}

          {selectedCourse && !loading && grades.length === 0 && (
            <p className="text-gray-600">Bu ders için öğrenci bulunamadı.</p>
          )}

          {loading && <p className="text-gray-600">Yükleniyor...</p>}
        </div>
      </div>
    </div>
  );
}
