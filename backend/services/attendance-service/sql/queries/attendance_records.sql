-- name: CreateAttendanceRecordQR :exec
INSERT INTO attendance_records (
    session_id, student_id, course_id, semester, week_number,
    is_present, marked_via, scanned_at, qr_timestamp
) VALUES (
    $1, $2, $3, $4, $5, TRUE, 'qr_scan', $6, $7
) ON CONFLICT (session_id, student_id) DO NOTHING;

-- name: CreateAttendanceRecordManual :one
INSERT INTO attendance_records (
    session_id, student_id, course_id, semester, week_number,
    is_present, marked_via, manually_marked_by, manually_marked_at, manual_note
) VALUES (
    $1, $2, $3, $4, $5, $6, 'manual', $7, NOW(), $8
) ON CONFLICT (session_id, student_id)
DO UPDATE SET
    is_present = EXCLUDED.is_present,
    marked_via = EXCLUDED.marked_via,
    manually_marked_by = EXCLUDED.manually_marked_by,
    manually_marked_at = NOW(),
    manual_note = EXCLUDED.manual_note
RETURNING *;

-- name: CheckAttendanceExists :one
SELECT COUNT(*) as count
FROM attendance_records
WHERE session_id = $1 AND student_id = $2;

-- name: GetMarkedStudentsBySession :many
SELECT student_id
FROM attendance_records
WHERE session_id = $1;

-- name: GetSessionAttendanceCounts :one
SELECT
    COUNT(*) FILTER (WHERE is_present = TRUE) as present_count,
    COUNT(*) FILTER (WHERE is_present = FALSE) as absent_count
FROM attendance_records
WHERE session_id = $1;

-- name: GetStudentAttendanceByCourse :many
SELECT
    ar.week_number,
    ats.session_date,
    ar.is_present,
    ar.marked_via,
    ar.manual_note,
    ar.scanned_at,
    ar.manually_marked_at
FROM attendance_records ar
JOIN attendance_sessions ats ON ar.session_id = ats.id
WHERE ar.student_id = $1 AND ar.course_id = $2 AND ar.semester = $3
ORDER BY ar.week_number ASC;

-- name: GetCourseAttendanceStats :many
SELECT
    s.id as student_id,
    s.student_number,
    s.first_name,
    s.last_name,
    COUNT(*) FILTER (WHERE ar.is_present = TRUE) as present_count,
    COUNT(*) FILTER (WHERE ar.is_present = FALSE) as absent_count,
    ARRAY_AGG(ar.week_number ORDER BY ar.week_number) FILTER (WHERE ar.is_present = FALSE) as absent_weeks
FROM enrollments_cache e
JOIN students_cache s ON e.student_id = s.id
LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.course_id = e.course_id
WHERE e.course_id = $1 AND e.semester = $2
GROUP BY s.id, s.student_number, s.first_name, s.last_name
ORDER BY s.student_number;

-- name: GetFailingStudentsByCourse :many
SELECT
    s.id as student_id,
    s.student_number,
    s.first_name,
    s.last_name,
    s.email,
    COUNT(*) FILTER (WHERE ar.is_present = TRUE) as present_count,
    COUNT(*) FILTER (WHERE ar.is_present = FALSE) as absent_count
FROM enrollments_cache e
JOIN students_cache s ON e.student_id = s.id
LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.course_id = e.course_id AND ar.semester = e.semester
WHERE e.course_id = $1 AND e.semester = $2
GROUP BY s.id, s.student_number, s.first_name, s.last_name, s.email
HAVING COUNT(*) FILTER (WHERE ar.is_present = FALSE) >= 4;
