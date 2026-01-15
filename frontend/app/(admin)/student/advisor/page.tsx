"use client";

import { useEffect, useState } from "react";
import { studentApi, staffApi } from "@/lib/api-client";
import type { Student, Staff } from "@/lib/types";

export default function AdvisorAssignmentPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<Staff[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedAdvisor, setSelectedAdvisor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch students without advisor
      const studentsData = await studentApi
        .get("?advisor_id=null&per_page=100")
        .json<{ data: Student[] }>();
      setStudents(studentsData.data);

      // Fetch instructors
      const instructorsData = await staffApi
        .get("instructors")
        .json<Staff[]>();
      setInstructors(instructorsData);
    } catch (err: any) {
      setError(err.message || "Veri yüklenemedi");
    }
  };

  const handleAssignAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedStudent || !selectedAdvisor) {
      setError("Lütfen öğrenci ve danışman seçin");
      return;
    }

    setLoading(true);

    try {
      await studentApi.put(`${selectedStudent}/advisor`, {
        json: { advisor_id: selectedAdvisor },
      });

      setSuccess("Danışman başarıyla atandı");
      setSelectedStudent("");
      setSelectedAdvisor("");

      // Refresh students list
      fetchData();
    } catch (err: any) {
      setError(err.message || "Danışman ataması başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Danışman Atama</h1>

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

          <form onSubmit={handleAssignAdvisor} className="space-y-6">
            <div>
              <label htmlFor="student" className="block text-sm font-medium text-gray-700 mb-2">
                Öğrenci Seçin
              </label>
              <select
                id="student"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">Öğrenci seçin</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.student_id} - {student.first_name} {student.last_name} (
                    {student.department})
                  </option>
                ))}
              </select>
              {students.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  Danışman atanmamış öğrenci bulunamadı
                </p>
              )}
            </div>

            <div>
              <label htmlFor="advisor" className="block text-sm font-medium text-gray-700 mb-2">
                Danışman Seçin
              </label>
              <select
                id="advisor"
                value={selectedAdvisor}
                onChange={(e) => setSelectedAdvisor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">Danışman seçin</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.first_name} {instructor.last_name} - {instructor.title} (
                    {instructor.department})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Atanıyor..." : "Danışman Ata"}
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Geri Dön
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
