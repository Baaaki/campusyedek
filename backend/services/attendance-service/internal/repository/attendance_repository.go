package repository

import (
	"context"

	"github.com/baaaki/mydreamcampus/attendance-service/internal/db"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AttendanceRepository struct {
	queries *db.Queries
	pool    *pgxpool.Pool
}

func NewAttendanceRepository(pool *pgxpool.Pool) *AttendanceRepository {
	return &AttendanceRepository{
		queries: db.New(pool),
		pool:    pool,
	}
}

func (r *AttendanceRepository) CreateAttendanceRecordQR(ctx context.Context, params db.CreateAttendanceRecordQRParams) error {
	return r.queries.CreateAttendanceRecordQR(ctx, params)
}

func (r *AttendanceRepository) CreateAttendanceRecordManual(ctx context.Context, params db.CreateAttendanceRecordManualParams) (db.AttendanceRecord, error) {
	return r.queries.CreateAttendanceRecordManual(ctx, params)
}

func (r *AttendanceRepository) CheckAttendanceExists(ctx context.Context, sessionID, studentID uuid.UUID) (bool, error) {
	count, err := r.queries.CheckAttendanceExists(ctx, db.CheckAttendanceExistsParams{
		SessionID: utils.UUIDToPgUUID(sessionID),
		StudentID: utils.UUIDToPgUUID(studentID),
	})
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *AttendanceRepository) GetMarkedStudentsBySession(ctx context.Context, sessionID uuid.UUID) ([]uuid.UUID, error) {
	pgtypeUUIDs, err := r.queries.GetMarkedStudentsBySession(ctx, utils.UUIDToPgUUID(sessionID))
	if err != nil {
		return nil, err
	}

	result := make([]uuid.UUID, len(pgtypeUUIDs))
	for i, pgtypeUUID := range pgtypeUUIDs {
		result[i] = utils.PgUUIDToUUID(pgtypeUUID)
	}
	return result, nil
}

func (r *AttendanceRepository) GetSessionAttendanceCounts(ctx context.Context, sessionID uuid.UUID) (db.GetSessionAttendanceCountsRow, error) {
	return r.queries.GetSessionAttendanceCounts(ctx, utils.UUIDToPgUUID(sessionID))
}

func (r *AttendanceRepository) GetStudentAttendanceByCourse(ctx context.Context, studentID, courseID uuid.UUID, semester string) ([]db.GetStudentAttendanceByCourseRow, error) {
	return r.queries.GetStudentAttendanceByCourse(ctx, db.GetStudentAttendanceByCourseParams{
		StudentID: utils.UUIDToPgUUID(studentID),
		CourseID:  utils.UUIDToPgUUID(courseID),
		Semester:  semester,
	})
}

func (r *AttendanceRepository) GetCourseAttendanceStats(ctx context.Context, courseID uuid.UUID, semester string) ([]db.GetCourseAttendanceStatsRow, error) {
	return r.queries.GetCourseAttendanceStats(ctx, db.GetCourseAttendanceStatsParams{
		CourseID: utils.UUIDToPgUUID(courseID),
		Semester: semester,
	})
}

func (r *AttendanceRepository) GetFailingStudentsByCourse(ctx context.Context, courseID uuid.UUID, semester string) ([]db.GetFailingStudentsByCourseRow, error) {
	return r.queries.GetFailingStudentsByCourse(ctx, db.GetFailingStudentsByCourseParams{
		CourseID: utils.UUIDToPgUUID(courseID),
		Semester: semester,
	})
}

func (r *AttendanceRepository) GetAttendanceRecordsBySession(ctx context.Context, sessionID uuid.UUID) ([]db.GetAttendanceRecordsBySessionRow, error) {
	return r.queries.GetAttendanceRecordsBySession(ctx, utils.UUIDToPgUUID(sessionID))
}

// BatchCreateAbsentRecords creates multiple absent records at once (for session close)
func (r *AttendanceRepository) BatchCreateAbsentRecords(ctx context.Context, sessionID, courseID uuid.UUID, semester string, weekNumber int16, instructorID uuid.UUID, studentIDs []uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)

	for _, studentID := range studentIDs {
		_, err := qtx.CreateAttendanceRecordManual(ctx, db.CreateAttendanceRecordManualParams{
			SessionID:        utils.UUIDToPgUUID(sessionID),
			StudentID:        utils.UUIDToPgUUID(studentID),
			CourseID:         utils.UUIDToPgUUID(courseID),
			Semester:         semester,
			WeekNumber:       weekNumber,
			IsPresent:        false,
			ManuallyMarkedBy: pgtype.UUID{Bytes: instructorID, Valid: true},
			ManualNote:       pgtype.Text{},
		})
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
