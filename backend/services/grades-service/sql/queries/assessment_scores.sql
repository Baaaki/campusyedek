-- name: UpsertAssessmentScore :one
INSERT INTO student_assessment_scores (
    registration_id, slug, score, is_absent, graded_by, graded_at
) VALUES (
    $1, $2, $3, $4, $5, NOW()
)
ON CONFLICT (registration_id, slug) DO UPDATE SET
    score = EXCLUDED.score,
    is_absent = EXCLUDED.is_absent,
    graded_by = EXCLUDED.graded_by,
    graded_at = NOW()
RETURNING *;

-- name: GetScoresByRegistration :many
SELECT * FROM student_assessment_scores
WHERE registration_id = $1
ORDER BY graded_at;

-- name: CountScoresBySlugAndCourse :one
SELECT COUNT(DISTINCT sa.registration_id)
FROM student_assessment_scores sa
JOIN student_course_registrations r ON sa.registration_id = r.id
WHERE r.course_id = $1 AND sa.slug = $2;

-- name: DeleteScoresByCourse :exec
DELETE FROM student_assessment_scores
WHERE registration_id IN (
    SELECT id FROM student_course_registrations WHERE course_id = $1
);
