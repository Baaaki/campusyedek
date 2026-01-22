package repository

import (
	"context"

	"github.com/baaaki/mydreamcampus/grades-service/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CacheRepository struct {
	queries *db.Queries
	pool    *pgxpool.Pool
}

func NewCacheRepository(pool *pgxpool.Pool) *CacheRepository {
	return &CacheRepository{
		queries: db.New(pool),
		pool:    pool,
	}
}

// Student Cache
func (r *CacheRepository) UpsertStudentCache(ctx context.Context, arg db.UpsertStudentCacheParams) (db.StudentsCache, error) {
	return r.queries.UpsertStudentCache(ctx, arg)
}

func (r *CacheRepository) GetStudentCacheByID(ctx context.Context, id uuid.UUID) (db.StudentsCache, error) {
	return r.queries.GetStudentCacheByID(ctx, id)
}

func (r *CacheRepository) DeactivateStudentCache(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeactivateStudentCache(ctx, id)
}

// Course Cache
func (r *CacheRepository) UpsertCourseCache(ctx context.Context, arg db.UpsertCourseCacheParams) (db.CoursesCache, error) {
	return r.queries.UpsertCourseCache(ctx, arg)
}

func (r *CacheRepository) GetCourseCacheByID(ctx context.Context, id uuid.UUID) (db.CoursesCache, error) {
	return r.queries.GetCourseCacheByID(ctx, id)
}

func (r *CacheRepository) DeleteCourseCache(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteCourseCache(ctx, id)
}

func (r *CacheRepository) UpdateCourseInstructor(ctx context.Context, arg db.UpdateCourseInstructorParams) error {
	return r.queries.UpdateCourseInstructor(ctx, arg)
}

// Prerequisite Courses
func (r *CacheRepository) SyncPrerequisiteCourses(ctx context.Context, prerequisites []db.BulkInsertPrerequisiteCoursesParams) error {
	// Start transaction
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)

	// Truncate existing
	if err := qtx.TruncatePrerequisiteCourses(ctx); err != nil {
		return err
	}

	// Bulk insert
	if len(prerequisites) > 0 {
		if _, err := qtx.BulkInsertPrerequisiteCourses(ctx, prerequisites); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *CacheRepository) IsPrerequisiteCourse(ctx context.Context, courseCode string) (bool, error) {
	return r.queries.IsPrerequisiteCourse(ctx, courseCode)
}
