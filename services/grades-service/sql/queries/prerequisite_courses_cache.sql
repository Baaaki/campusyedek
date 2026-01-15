-- name: TruncatePrerequisiteCourses :exec
TRUNCATE TABLE prerequisite_courses_cache;

-- name: BulkInsertPrerequisiteCourses :copyfrom
INSERT INTO prerequisite_courses_cache (course_code, course_id)
VALUES ($1, $2);

-- name: IsPrerequisiteCourse :one
SELECT EXISTS(
    SELECT 1 FROM prerequisite_courses_cache
    WHERE course_code = $1
) as is_prerequisite;
