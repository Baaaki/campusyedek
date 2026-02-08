package repository

import (
	"context"

	"github.com/baaaki/mydreamcampus/grades-service/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ScoreRepository struct {
	queries *db.Queries
	pool    *pgxpool.Pool
}

func NewScoreRepository(pool *pgxpool.Pool) *ScoreRepository {
	return &ScoreRepository{
		queries: db.New(pool),
		pool:    pool,
	}
}

func (r *ScoreRepository) UpsertAssessmentScore(ctx context.Context, arg db.UpsertAssessmentScoreParams) (db.StudentAssessmentScore, error) {
	return r.queries.UpsertAssessmentScore(ctx, arg)
}

func (r *ScoreRepository) GetScoresByRegistration(ctx context.Context, registrationID uuid.UUID) ([]db.StudentAssessmentScore, error) {
	return r.queries.GetScoresByRegistration(ctx, registrationID)
}

func (r *ScoreRepository) CountScoresBySlugAndCourse(ctx context.Context, arg db.CountScoresBySlugAndCourseParams) (int64, error) {
	return r.queries.CountScoresBySlugAndCourse(ctx, arg)
}

func (r *ScoreRepository) DeleteScoresByCourse(ctx context.Context, courseID uuid.UUID) error {
	return r.queries.DeleteScoresByCourse(ctx, courseID)
}

func (r *ScoreRepository) GetScoreByRegistrationAndSlug(ctx context.Context, registrationID uuid.UUID, slug string) (db.StudentAssessmentScore, error) {
	return r.queries.GetScoreByRegistrationAndSlug(ctx, db.GetScoreByRegistrationAndSlugParams{
		RegistrationID: registrationID,
		Slug:           slug,
	})
}

func (r *ScoreRepository) UnlockScore(ctx context.Context, registrationID uuid.UUID, slug string) error {
	return r.queries.UnlockScore(ctx, db.UnlockScoreParams{
		RegistrationID: registrationID,
		Slug:           slug,
	})
}

func (r *ScoreRepository) LockScore(ctx context.Context, registrationID uuid.UUID, slug string) error {
	return r.queries.LockScore(ctx, db.LockScoreParams{
		RegistrationID: registrationID,
		Slug:           slug,
	})
}

func (r *ScoreRepository) CountLockedScoresBySlugAndCourse(ctx context.Context, courseID uuid.UUID, slug string) (int64, error) {
	return r.queries.CountLockedScoresBySlugAndCourse(ctx, db.CountLockedScoresBySlugAndCourseParams{
		CourseID: courseID,
		Slug:     slug,
	})
}
