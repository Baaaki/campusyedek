-- name: GetCourseByCourseCode :one
SELECT id, course_code, name, faculty, department, class_level, credits,
       theoretical_hours, practical_hours, course_type, prerequisites,
       description, learning_outcomes, syllabus, status, created_at, updated_at
FROM course_catalog
WHERE course_code = $1
LIMIT 1;

-- name: CreateCourse :one
INSERT INTO course_catalog (
    course_code, name, faculty, department, class_level, credits,
    theoretical_hours, practical_hours, course_type, prerequisites,
    description, learning_outcomes, syllabus, status
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING id, course_code, name, faculty, department, class_level, credits,
          theoretical_hours, practical_hours, course_type, prerequisites,
          description, learning_outcomes, syllabus, status, created_at, updated_at;

-- name: UpdateCourse :one
UPDATE course_catalog
SET name = COALESCE(sqlc.narg('name'), name),
    faculty = COALESCE(sqlc.narg('faculty'), faculty),
    department = COALESCE(sqlc.narg('department'), department),
    class_level = COALESCE(sqlc.narg('class_level'), class_level),
    credits = COALESCE(sqlc.narg('credits'), credits),
    theoretical_hours = COALESCE(sqlc.narg('theoretical_hours'), theoretical_hours),
    practical_hours = COALESCE(sqlc.narg('practical_hours'), practical_hours),
    course_type = COALESCE(sqlc.narg('course_type'), course_type),
    prerequisites = COALESCE(sqlc.narg('prerequisites'), prerequisites),
    description = COALESCE(sqlc.narg('description'), description),
    learning_outcomes = COALESCE(sqlc.narg('learning_outcomes'), learning_outcomes),
    syllabus = COALESCE(sqlc.narg('syllabus'), syllabus),
    status = COALESCE(sqlc.narg('status'), status),
    updated_at = NOW()
WHERE course_code = $1
RETURNING id, course_code, name, faculty, department, class_level, credits,
          theoretical_hours, practical_hours, course_type, prerequisites,
          description, learning_outcomes, syllabus, status, created_at, updated_at;

-- name: ListCourses :many
SELECT id, course_code, name, faculty, department, class_level, credits,
       theoretical_hours, practical_hours, course_type, prerequisites, status
FROM course_catalog
WHERE (sqlc.narg('faculty')::text IS NULL OR faculty = sqlc.narg('faculty'))
  AND (sqlc.narg('department')::text IS NULL OR department = sqlc.narg('department'))
  AND (sqlc.narg('course_type')::course_type_enum IS NULL OR course_type = sqlc.narg('course_type'))
  AND (sqlc.narg('status')::course_catalog_status_enum IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('class_level')::SMALLINT IS NULL OR class_level = sqlc.narg('class_level'))
  AND (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search') || '%' OR course_code ILIKE '%' || sqlc.narg('search') || '%')
ORDER BY course_code
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountCourses :one
SELECT COUNT(*)
FROM course_catalog
WHERE (sqlc.narg('faculty')::text IS NULL OR faculty = sqlc.narg('faculty'))
  AND (sqlc.narg('department')::text IS NULL OR department = sqlc.narg('department'))
  AND (sqlc.narg('course_type')::course_type_enum IS NULL OR course_type = sqlc.narg('course_type'))
  AND (sqlc.narg('status')::course_catalog_status_enum IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('class_level')::SMALLINT IS NULL OR class_level = sqlc.narg('class_level'))
  AND (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search') || '%' OR course_code ILIKE '%' || sqlc.narg('search') || '%');

-- name: GetCourseByID :one
SELECT id, course_code, name, faculty, department, class_level, credits,
       theoretical_hours, practical_hours, course_type, prerequisites,
       description, learning_outcomes, syllabus, status, created_at, updated_at
FROM course_catalog
WHERE id = $1
LIMIT 1;

-- name: GetCoursesByIDs :many
SELECT id, course_code, name, class_level
FROM course_catalog
WHERE id = ANY($1::uuid[]);