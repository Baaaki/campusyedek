-- name: CreateClosedDay :one
INSERT INTO closed_days (date, reason)
VALUES ($1, $2)
RETURNING id, date, reason, created_at;

-- name: DeleteClosedDay :exec
DELETE FROM closed_days WHERE id = $1;

-- name: ListClosedDays :many
SELECT id, date, reason, created_at
FROM closed_days
WHERE ($1::date IS NULL OR date >= $1)
  AND ($2::date IS NULL OR date <= $2)
ORDER BY date ASC;

-- name: IsDateClosed :one
SELECT EXISTS(
    SELECT 1 FROM closed_days WHERE date = $1
) AS is_closed;

-- name: GetClosedDaysByDateRange :many
SELECT id, date, reason, created_at
FROM closed_days
WHERE date >= $1 AND date <= $2
ORDER BY date ASC;
