-- name: CreateSemester :one
INSERT INTO semesters (name, hard_deadline)
VALUES ($1, $2)
RETURNING *;

-- name: GetSemesterByName :one
SELECT * FROM semesters WHERE name = $1;

-- name: GetActiveSemester :one
SELECT * FROM semesters WHERE status = 'active' LIMIT 1;

-- name: ListSemesters :many
SELECT * FROM semesters ORDER BY created_at DESC;

-- name: ActivateSemester :one
UPDATE semesters SET status = 'active' WHERE id = $1 AND status = 'planned'
RETURNING *;

-- name: CompleteSemester :one
UPDATE semesters SET status = 'completed' WHERE id = $1 AND status = 'active'
RETURNING *;

-- name: AutoCompleteSemester :exec
UPDATE semesters SET status = 'completed'
WHERE name = $1 AND status = 'active' AND hard_deadline < NOW();
