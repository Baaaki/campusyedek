-- name: CreateRegistration :one
INSERT INTO student_course_registrations (
    student_id, course_id, semester, is_attendance_failed
) VALUES (
    $1, $2, $3, $4
)
ON CONFLICT (student_id, course_id) DO NOTHING
RETURNING *;

-- name: GetRegistrationByID :one
SELECT
    r.*,
    s.student_number,
    s.first_name as student_first_name,
    s.last_name as student_last_name,
    s.department as student_department,
    c.course_code,
    c.course_name,
    c.instructor_id,
    c.assessment_schema
FROM student_course_registrations r
JOIN students_cache s ON r.student_id = s.id
JOIN courses_cache c ON r.course_id = c.id
WHERE r.id = $1;

-- name: GetRegistrationsByCourse :many
SELECT
    r.*,
    s.student_number,
    s.first_name as student_first_name,
    s.last_name as student_last_name,
    s.department as student_department
FROM student_course_registrations r
JOIN students_cache s ON r.student_id = s.id
WHERE r.course_id = $1
ORDER BY s.student_number;

-- name: MarkAttendanceFailed :exec
UPDATE student_course_registrations
SET is_attendance_failed = true
WHERE student_id = $1 AND course_id = $2;

-- name: CountRegistrationsByCourse :one
SELECT COUNT(*) FROM student_course_registrations
WHERE course_id = $1;

-- name: DeleteRegistrationsByCourse :exec
DELETE FROM student_course_registrations WHERE course_id = $1;
