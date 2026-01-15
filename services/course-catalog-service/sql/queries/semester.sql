-- name: CreateSemesterCourse :one
INSERT INTO semester_courses (
    semester, course_code, credits, class_level, instructor_id,
    instructor_fullname, classroom_location, max_capacity, assessment_schema, prerequisites
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, semester, course_code, credits, class_level, instructor_id,
          instructor_fullname, classroom_location, max_capacity, assessment_schema, prerequisites,
          created_at, updated_at;

-- name: GetSemesterCourseByID :one
SELECT id, semester, course_code, credits, class_level, instructor_id,
       instructor_fullname, classroom_location, max_capacity, assessment_schema, prerequisites,
       created_at, updated_at
FROM semester_courses
WHERE id = $1 AND semester = $2
LIMIT 1;

-- name: GetSemesterCourseBySemesterAndCode :one
SELECT id, semester, course_code, credits, class_level, instructor_id,
       instructor_fullname, classroom_location, max_capacity, assessment_schema, prerequisites,
       created_at, updated_at
FROM semester_courses
WHERE semester = $1 AND course_code = $2
LIMIT 1;

-- name: UpdateSemesterCourse :one
UPDATE semester_courses
SET instructor_id = COALESCE(sqlc.narg('instructor_id'), instructor_id),
    instructor_fullname = COALESCE(sqlc.narg('instructor_fullname'), instructor_fullname),
    classroom_location = COALESCE(sqlc.narg('classroom_location'), classroom_location),
    max_capacity = COALESCE(sqlc.narg('max_capacity'), max_capacity),
    assessment_schema = COALESCE(sqlc.narg('assessment_schema'), assessment_schema),
    updated_at = NOW()
WHERE id = $1
RETURNING id, semester, course_code, credits, class_level, instructor_id,
          instructor_fullname, classroom_location, max_capacity, assessment_schema, prerequisites,
          created_at, updated_at;

-- name: DeleteSemesterCourse :exec
DELETE FROM semester_courses
WHERE id = $1;

-- name: ListSemesterCourses :many
SELECT sc.id, sc.semester, sc.course_code, cc.name as course_name, sc.credits, sc.class_level,
       sc.instructor_id, sc.instructor_fullname, sc.classroom_location, sc.max_capacity,
       sc.assessment_schema
FROM semester_courses sc
JOIN course_catalog cc ON sc.course_code = cc.course_code
WHERE sc.semester = sqlc.arg('semester')
  AND (sqlc.narg('faculty')::text IS NULL OR cc.faculty = sqlc.narg('faculty'))
  AND (sqlc.narg('department')::text IS NULL OR cc.department = sqlc.narg('department'))
  AND (sqlc.narg('instructor_id')::uuid IS NULL OR sc.instructor_id = sqlc.narg('instructor_id'))
  AND (sqlc.narg('course_type')::course_type_enum IS NULL OR cc.course_type = sqlc.narg('course_type'))
  AND (sqlc.narg('class_level')::SMALLINT IS NULL OR sc.class_level = sqlc.narg('class_level'))
ORDER BY sc.course_code
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSemesterCourses :one
SELECT COUNT(*)
FROM semester_courses sc
JOIN course_catalog cc ON sc.course_code = cc.course_code
WHERE sc.semester = sqlc.arg('semester')
  AND (sqlc.narg('faculty')::text IS NULL OR cc.faculty = sqlc.narg('faculty'))
  AND (sqlc.narg('department')::text IS NULL OR cc.department = sqlc.narg('department'))
  AND (sqlc.narg('instructor_id')::uuid IS NULL OR sc.instructor_id = sqlc.narg('instructor_id'))
  AND (sqlc.narg('course_type')::course_type_enum IS NULL OR cc.course_type = sqlc.narg('course_type'))
  AND (sqlc.narg('class_level')::SMALLINT IS NULL OR sc.class_level = sqlc.narg('class_level'));
