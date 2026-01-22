-- name: CreateScheduleSession :one
INSERT INTO course_schedule_sessions (semester_course_id, day_of_week, slot_number)
VALUES ($1, $2, $3)
RETURNING id, semester_course_id, day_of_week, slot_number, created_at;

-- name: BatchCreateScheduleSessions :batchexec
INSERT INTO course_schedule_sessions (semester_course_id, day_of_week, slot_number)
VALUES ($1, $2, $3);

-- name: GetScheduleSessionsByCourseID :many
SELECT id, semester_course_id, day_of_week, slot_number, created_at
FROM course_schedule_sessions
WHERE semester_course_id = $1
ORDER BY day_of_week, slot_number;

-- name: GetScheduleSessionsByMultipleCourseIDs :many
SELECT id, semester_course_id, day_of_week, slot_number, created_at
FROM course_schedule_sessions
WHERE semester_course_id = ANY(sqlc.arg('course_ids')::UUID[])
ORDER BY semester_course_id, day_of_week, slot_number;

-- name: DeleteScheduleSessionsByCourseID :exec
DELETE FROM course_schedule_sessions
WHERE semester_course_id = $1;

-- name: CheckInstructorScheduleConflict :many
SELECT sc.course_code, sc.id
FROM course_schedule_sessions css
JOIN semester_courses sc ON css.semester_course_id = sc.id
WHERE css.day_of_week = ANY(sqlc.arg('days')::day_of_week_enum[])
  AND css.slot_number = ANY(sqlc.arg('slots')::SMALLINT[])
  AND sc.semester = sqlc.arg('semester')
  AND sc.instructor_id = sqlc.arg('instructor_id')
  AND sc.id != sqlc.arg('exclude_course_id');
