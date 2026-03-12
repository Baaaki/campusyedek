package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/baaaki/mydreamcampus/grades-service/internal/db"
	"github.com/baaaki/mydreamcampus/grades-service/internal/dto"
	"github.com/baaaki/mydreamcampus/grades-service/internal/errors"
	"github.com/baaaki/mydreamcampus/grades-service/internal/repository"
	"github.com/baaaki/mydreamcampus/shared/audit"
	"github.com/baaaki/mydreamcampus/shared/clock"
	"github.com/baaaki/mydreamcampus/shared/logger"
	sharedRepo "github.com/baaaki/mydreamcampus/shared/repository"
	"github.com/baaaki/mydreamcampus/shared/rules"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// Compile-time check that time is used (needed for time.Time type references).
var _ = time.Now

type GradeService struct {
	pool             *pgxpool.Pool
	cacheRepo        *repository.CacheRepository
	registrationRepo *repository.RegistrationRepository
	scoreRepo        *repository.ScoreRepository
	completedRepo    *repository.CompletedRepository
	outboxRepo       *repository.OutboxRepository
	periodRepo       *sharedRepo.PeriodRepository
	auditLogger      audit.Logger
}

func NewGradeService(
	pool *pgxpool.Pool,
	cacheRepo *repository.CacheRepository,
	registrationRepo *repository.RegistrationRepository,
	scoreRepo *repository.ScoreRepository,
	completedRepo *repository.CompletedRepository,
	outboxRepo *repository.OutboxRepository,
	periodRepo *sharedRepo.PeriodRepository,
	auditLogger audit.Logger,
) *GradeService {
	return &GradeService{
		pool:             pool,
		cacheRepo:        cacheRepo,
		registrationRepo: registrationRepo,
		scoreRepo:        scoreRepo,
		completedRepo:    completedRepo,
		outboxRepo:       outboxRepo,
		periodRepo:       periodRepo,
		auditLogger:      auditLogger,
	}
}

// ============================================
// Score Submission
// ============================================

func (s *GradeService) SubmitScore(ctx context.Context, instructorID uuid.UUID, courseID uuid.UUID, req dto.SubmitScoreRequest) (*dto.SubmitScoreResponse, error) {
	// 1. Get registration with course info
	registration, err := s.registrationRepo.GetRegistrationByID(ctx, req.RegistrationID)
	if err != nil {
		logger.Error("failed to get registration", zap.Error(err))
		return nil, errors.ErrRegistrationNotFound
	}

	// 2. Verify instructor authorization
	if registration.InstructorID != instructorID {
		return nil, errors.ErrNotCourseInstructor
	}

	// 3. Validate slug against assessment schema
	var schema []AssessmentSchemaItem
	if err := json.Unmarshal(registration.AssessmentSchema, &schema); err != nil {
		logger.Error("failed to unmarshal assessment schema", zap.Error(err))
		return nil, err
	}

	if !isValidSlug(schema, req.Slug) {
		return nil, errors.ErrInvalidSlug
	}

	// 4. Check if student failed due to attendance
	if utils.PgBoolToBool(registration.IsAttendanceFailed) {
		return nil, errors.ErrAttendanceFailed
	}

	// 5. Check grading period deadline + score lock using CanEditGrade rule engine
	isLocked := false
	existingScore, err := s.scoreRepo.GetScoreByRegistrationAndSlug(ctx, req.RegistrationID, req.Slug)
	if err == nil && existingScore.IsLocked.Valid && existingScore.IsLocked.Bool {
		isLocked = true
	}

	editResult := s.checkCanEditGrade(ctx, registration.Semester, &courseID, isLocked, false)
	if !editResult.Allowed {
		if isLocked {
			return nil, errors.ErrScoreLocked
		}
		return nil, errors.ErrGradingPeriodEnded
	}

	// 6. Validate score
	if req.Score != nil {
		if *req.Score < 0 || *req.Score > 100 {
			return nil, errors.ErrInvalidScore
		}
	}

	// 7. Upsert score
	var scoreValue pgtype.Numeric
	if req.Score != nil {
		// Convert to string for pgtype.Numeric - it accepts string format
		scoreStr := fmt.Sprintf("%d", int(*req.Score))
		if err := scoreValue.Scan(scoreStr); err != nil {
			logger.Error("failed to scan score", zap.Error(err))
			return nil, err
		}
	}

	score, err := s.scoreRepo.UpsertAssessmentScore(ctx, db.UpsertAssessmentScoreParams{
		RegistrationID: req.RegistrationID,
		Slug:           req.Slug,
		Score:          scoreValue,
		IsAbsent:       utils.BoolToPgBool(req.IsAbsent),
		GradedBy:       instructorID,
	})
	if err != nil {
		logger.Error("failed to upsert score", zap.Error(err))
		return nil, err
	}

	// 7. Publish grade.submitted event
	if err := s.publishGradeSubmitted(ctx, registration.StudentID, registration.CourseCode, req.Slug, req.Score); err != nil {
		logger.Error("failed to publish grade submitted event", zap.Error(err))
	}

	// 8. Get student info
	student, err := s.cacheRepo.GetStudentCacheByID(ctx, registration.StudentID)
	if err != nil {
		logger.Error("failed to get student", zap.Error(err))
		return nil, err
	}

	response := &dto.SubmitScoreResponse{
		ID:            score.ID,
		StudentNumber: student.StudentNumber,
		Slug:          score.Slug,
		IsAbsent:      utils.PgBoolToBool(score.IsAbsent),
		GradedAt:      score.GradedAt.Time,
	}

	if score.Score.Valid {
		scoreFloat, err := utils.PgNumericToFloat64(score.Score)
		if err == nil {
			response.Score = &scoreFloat
		}
	}

	// 9. Check if all scores for all assessments are locked → auto-finalize
	allLocked, err := s.checkAllScoresLocked(ctx, courseID)
	if err != nil {
		logger.Error("failed to check locked scores", zap.Error(err))
		return response, nil
	}

	if allLocked {
		logger.Info("all scores locked, triggering auto-finalize", zap.String("course_id", courseID.String()))
		finalizeResult, err := s.AutoFinalize(ctx, courseID, instructorID)
		if err != nil {
			logger.Error("auto-finalize failed", zap.Error(err))
			return response, nil
		}

		response.AutoFinalized = true
		response.FinalizeResult = finalizeResult
	}

	return response, nil
}

func (s *GradeService) BulkSubmitScores(ctx context.Context, instructorID uuid.UUID, courseID uuid.UUID, req dto.BulkSubmitScoresRequest) (*dto.BulkSubmitScoresResponse, error) {
	successCount := 0

	for _, entry := range req.Scores {
		submitReq := dto.SubmitScoreRequest{
			RegistrationID: entry.RegistrationID,
			Slug:           req.Slug,
			Score:          entry.Score,
			IsAbsent:       entry.IsAbsent,
		}

		if _, err := s.SubmitScore(ctx, instructorID, courseID, submitReq); err != nil {
			logger.Error("failed to submit score in bulk", zap.Error(err), zap.String("registration_id", entry.RegistrationID.String()))
			continue
		}

		successCount++
	}

	response := &dto.BulkSubmitScoresResponse{
		Slug:         req.Slug,
		SuccessCount: successCount,
	}

	// Check auto-finalize after bulk submission - triggers when all scores are locked
	allLocked, err := s.checkAllScoresLocked(ctx, courseID)
	if err != nil {
		logger.Error("failed to check locked scores", zap.Error(err))
		return response, nil
	}

	if allLocked {
		logger.Info("all scores locked after bulk, triggering auto-finalize", zap.String("course_id", courseID.String()))
		finalizeResult, err := s.AutoFinalize(ctx, courseID, instructorID)
		if err != nil {
			logger.Error("auto-finalize failed", zap.Error(err))
			return response, nil
		}

		response.AutoFinalized = true
		response.FinalizeResult = finalizeResult
	}

	return response, nil
}

// ============================================
// Auto Finalize
// ============================================

func (s *GradeService) AutoFinalize(ctx context.Context, courseID uuid.UUID, instructorID uuid.UUID) (*dto.FinalizeResult, error) {
	// 1. Get course info
	course, err := s.cacheRepo.GetCourseCacheByID(ctx, courseID)
	if err != nil {
		logger.Error("failed to get course", zap.Error(err))
		return nil, errors.ErrCourseNotFound
	}

	// 2. Get all registrations
	registrations, err := s.registrationRepo.GetRegistrationsByCourse(ctx, courseID)
	if err != nil {
		logger.Error("failed to get registrations", zap.Error(err))
		return nil, err
	}

	if len(registrations) == 0 {
		logger.Warn("no registrations found for course", zap.String("course_id", courseID.String()))
		return nil, fmt.Errorf("no registrations found")
	}

	// 3. Parse assessment schema
	var schema []AssessmentSchemaItem
	if err := json.Unmarshal(course.AssessmentSchema, &schema); err != nil {
		logger.Error("failed to unmarshal assessment schema", zap.Error(err))
		return nil, err
	}

	// 4. Calculate weighted averages and separate students by attendance status
	type StudentResult struct {
		Registration       db.GetRegistrationsByCourseRow
		Scores             map[string]float64
		WeightedAverage    float64
		GradePoint         db.GradePointEnum
		ZScore             float64
		IsAttendanceFailed bool
	}

	var regularStudents []StudentResult
	var attendanceFailedStudents []StudentResult

	for _, reg := range registrations {
		// Get scores for this registration
		scores, err := s.scoreRepo.GetScoresByRegistration(ctx, reg.ID)
		if err != nil {
			logger.Error("failed to get scores", zap.Error(err))
			continue
		}

		scoreMap := make(map[string]float64)
		for _, score := range scores {
			if score.Score.Valid && !utils.PgBoolToBool(score.IsAbsent) {
				scoreFloat, err := utils.PgNumericToFloat64(score.Score)
				if err == nil {
					scoreMap[score.Slug] = scoreFloat
				} else {
					scoreMap[score.Slug] = 0.0
				}
			} else {
				scoreMap[score.Slug] = 0.0
			}
		}

		student := StudentResult{
			Registration:       reg,
			Scores:             scoreMap,
			IsAttendanceFailed: utils.PgBoolToBool(reg.IsAttendanceFailed),
		}

		if utils.PgBoolToBool(reg.IsAttendanceFailed) {
			// Attendance failed: automatic 0 score and FF grade
			student.WeightedAverage = 0.0
			student.GradePoint = db.GradePointEnum000
			for _, item := range schema {
				student.Scores[item.Slug] = 0.0
			}
			attendanceFailedStudents = append(attendanceFailedStudents, student)
		} else {
			// Regular student: calculate weighted average
			student.WeightedAverage = calculateWeightedAverage(scoreMap, schema)
			regularStudents = append(regularStudents, student)
		}
	}

	// 5. Calculate class statistics (only regular students)
	var averages []float64
	for _, s := range regularStudents {
		averages = append(averages, s.WeightedAverage)
	}

	classStats := calculateClassStatistics(averages)

	// 6. Determine grading type
	gradingType := determineGradingType(classStats.Mean)

	logger.Info("finalize grading",
		zap.String("course_code", course.CourseCode),
		zap.String("grading_type", string(gradingType)),
		zap.Float64("class_mean", classStats.Mean),
		zap.Int("regular_students", len(regularStudents)),
		zap.Int("attendance_failed", len(attendanceFailedStudents)),
	)

	// 7. Calculate grade points for regular students
	for i := range regularStudents {
		student := &regularStudents[i]
		if gradingType == db.GradingTypeEnumAbsolute {
			student.GradePoint = calculateAbsoluteGradePoint(student.WeightedAverage)
		} else {
			gp, zScore := calculateZScoreGradePoint(student.WeightedAverage, classStats.Mean, classStats.StdDev)
			student.GradePoint = gp
			student.ZScore = zScore
		}
	}

	// 8. Combine all students
	allStudents := append(regularStudents, attendanceFailedStudents...)

	// 9. Start transaction to save completed courses
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		logger.Error("failed to begin transaction", zap.Error(err))
		return nil, err
	}
	defer tx.Rollback(ctx)

	completedQtx := s.completedRepo
	outboxQtx := s.outboxRepo
	registrationQtx := s.registrationRepo
	scoreQtx := s.scoreRepo

	passingCount := 0
	failingCount := 0

	for _, student := range allStudents {
		// Delete old completed course record (for retakes)
		if err := completedQtx.DeleteCompletedCourse(ctx, db.DeleteCompletedCourseParams{
			StudentID:  student.Registration.StudentID,
			CourseCode: course.CourseCode,
		}); err != nil {
			logger.Error("failed to delete old completed course", zap.Error(err))
		}

		// Marshal scores to JSONB
		scoresJSON, err := json.Marshal(student.Scores)
		if err != nil {
			logger.Error("failed to marshal scores", zap.Error(err))
			continue
		}

		// Build grading config
		gradingConfig := make(map[string]any)
		if gradingType == db.GradingTypeEnumRelative {
			gradingConfig["class_mean"] = classStats.Mean
			gradingConfig["class_stddev"] = classStats.StdDev
			gradingConfig["student_z_score"] = student.ZScore
		}
		gradingConfigJSON, _ := json.Marshal(gradingConfig)

		// Build class statistics
		classStatsMap := map[string]any{
			"total_students": classStats.Count,
			"mean":           classStats.Mean,
			"stddev":         classStats.StdDev,
			"min":            classStats.Min,
			"max":            classStats.Max,
		}
		classStatsJSON, _ := json.Marshal(classStatsMap)

		// Create completed course record
		_, err = completedQtx.CreateCompletedCourse(ctx, db.CreateCompletedCourseParams{
			StudentID:          student.Registration.StudentID,
			StudentNumber:      student.Registration.StudentNumber,
			StudentFirstName:   utils.PgTextToString(student.Registration.StudentFirstName),
			StudentLastName:    utils.PgTextToString(student.Registration.StudentLastName),
			StudentDepartment:  student.Registration.StudentDepartment,
			CourseID:           courseID,
			CourseCode:         course.CourseCode,
			CourseName:         course.CourseName,
			Credits:            course.Credits,
			Semester:           course.Semester,
			InstructorID:       course.InstructorID,
			InstructorName:     course.InstructorFullname.String,
			AssessmentScores:   scoresJSON,
			WeightedAverage:    utils.Float64ToPgNumeric(student.WeightedAverage),
			GradePoint:         student.GradePoint,
			GradingType:        gradingType,
			GradingConfig:      gradingConfigJSON,
			ClassStatistics:    classStatsJSON,
			IsAttendanceFailed: utils.BoolToPgBool(student.IsAttendanceFailed),
			FinalizedAt:        utils.TimeToPgTimestamp(clock.Now()),
			FinalizedBy:        instructorID,
		})
		if err != nil {
			logger.Error("failed to create completed course", zap.Error(err))
			continue
		}

		// Count passing/failing
		if isPassing(student.GradePoint) {
			passingCount++

			// Check if this is a prerequisite course
			isPrereq, err := s.cacheRepo.IsPrerequisiteCourse(ctx, course.CourseCode)
			if err != nil {
				logger.Error("failed to check prerequisite", zap.Error(err))
			} else if isPrereq {
				// Publish prerequisite passed event
				prereqEvent := dto.GradeStudentPrerequisitePassedEvent{
					EventType: "grade.student.prerequisite.passed",
					Timestamp: clock.Now(),
				}
				prereqEvent.Data.StudentID = student.Registration.StudentID
				prereqEvent.Data.CourseID = courseID
				prereqEvent.Data.CourseCode = course.CourseCode
				prereqEvent.Data.Semester = course.Semester
				prereqEvent.Data.GradePoint = string(student.GradePoint)

				prereqPayload, _ := json.Marshal(prereqEvent)
				if _, err := outboxQtx.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
					EventType:  "grade.student.prerequisite.passed",
					RoutingKey: "grade.student.prerequisite.passed",
					Payload:    prereqPayload,
				}); err != nil {
					logger.Error("failed to create prerequisite passed outbox event", zap.Error(err))
				}
			}
		} else {
			failingCount++
		}
	}

	// 10. Clean up operational tables
	if err := scoreQtx.DeleteScoresByCourse(ctx, courseID); err != nil {
		logger.Error("failed to delete scores", zap.Error(err))
	}
	if err := registrationQtx.DeleteRegistrationsByCourse(ctx, courseID); err != nil {
		logger.Error("failed to delete registrations", zap.Error(err))
	}

	// 11. Publish grade.finalized event
	finalizedEvent := dto.GradeFinalizedEvent{
		EventType: "grade.finalized",
		Timestamp: clock.Now(),
	}
	finalizedEvent.Data.CourseID = courseID
	finalizedEvent.Data.CourseCode = course.CourseCode
	finalizedEvent.Data.Semester = course.Semester
	finalizedEvent.Data.GradingType = string(gradingType)
	finalizedEvent.Data.TotalStudents = len(allStudents)
	finalizedEvent.Data.PassingCount = passingCount
	finalizedEvent.Data.FailingCount = failingCount
	finalizedEvent.Data.AttendanceFailedCount = len(attendanceFailedStudents)
	finalizedEvent.Data.ClassMean = classStats.Mean

	finalizedPayload, _ := json.Marshal(finalizedEvent)
	if _, err := outboxQtx.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		EventType:  "grade.finalized",
		RoutingKey: "grade.finalized",
		Payload:    finalizedPayload,
	}); err != nil {
		logger.Error("failed to create finalized outbox event", zap.Error(err))
	}

	// 12. Commit transaction
	if err := tx.Commit(ctx); err != nil {
		logger.Error("failed to commit transaction", zap.Error(err))
		return nil, err
	}

	return &dto.FinalizeResult{
		GradingType:           string(gradingType),
		ClassMean:             classStats.Mean,
		TotalStudents:         len(allStudents),
		PassingCount:          passingCount,
		FailingCount:          failingCount,
		AttendanceFailedCount: len(attendanceFailedStudents),
	}, nil
}

// ============================================
// Query Methods
// ============================================

func (s *GradeService) GetCourseStatus(ctx context.Context, instructorID uuid.UUID, courseID uuid.UUID) (*dto.CourseStatusResponse, error) {
	// Get course
	course, err := s.cacheRepo.GetCourseCacheByID(ctx, courseID)
	if err != nil {
		return nil, errors.ErrCourseNotFound
	}

	// Verify instructor
	if course.InstructorID != instructorID {
		return nil, errors.ErrNotCourseInstructor
	}

	// Parse assessment schema
	var schema []AssessmentSchemaItem
	if err := json.Unmarshal(course.AssessmentSchema, &schema); err != nil {
		logger.Error("failed to unmarshal assessment schema", zap.Error(err))
		return nil, err
	}

	// Count total students
	totalStudents, err := s.registrationRepo.CountRegistrationsByCourse(ctx, courseID)
	if err != nil {
		logger.Error("failed to count registrations", zap.Error(err))
		return nil, err
	}

	// Build assessment status
	var assessments []dto.AssessmentStatus
	for _, item := range schema {
		gradedCount, err := s.scoreRepo.CountScoresBySlugAndCourse(ctx, db.CountScoresBySlugAndCourseParams{
			CourseID: courseID,
			Slug:     item.Slug,
		})
		if err != nil {
			logger.Error("failed to count scores", zap.Error(err))
			gradedCount = 0
		}

		assessments = append(assessments, dto.AssessmentStatus{
			Slug:         item.Slug,
			Name:         item.Name,
			Weight:       item.Weight,
			GradedCount:  int(gradedCount),
			PendingCount: int(totalStudents) - int(gradedCount),
			IsComplete:   gradedCount >= totalStudents,
		})
	}

	// Check if finalized
	completedCourses, err := s.completedRepo.GetCompletedCoursesByCourse(ctx, courseID)
	isFinalized := err == nil && len(completedCourses) > 0

	response := &dto.CourseStatusResponse{
		CourseID:      courseID,
		CourseCode:    course.CourseCode,
		CourseName:    course.CourseName,
		Semester:      course.Semester,
		TotalStudents: int(totalStudents),
		Assessments:   assessments,
		IsFinalized:   isFinalized,
	}

	if !isFinalized {
		// Find pending message
		for _, a := range assessments {
			if !a.IsComplete {
				response.PendingMessage = fmt.Sprintf("%s için %d öğrencinin notu girilmemiş", a.Slug, a.PendingCount)
				break
			}
		}
	}

	return response, nil
}

func (s *GradeService) GetCourseStudents(ctx context.Context, instructorID uuid.UUID, courseID uuid.UUID) (*dto.CourseStudentsResponse, error) {
	// Get course
	course, err := s.cacheRepo.GetCourseCacheByID(ctx, courseID)
	if err != nil {
		return nil, errors.ErrCourseNotFound
	}

	// Verify instructor
	if course.InstructorID != instructorID {
		return nil, errors.ErrNotCourseInstructor
	}

	// Get registrations
	registrations, err := s.registrationRepo.GetRegistrationsByCourse(ctx, courseID)
	if err != nil {
		logger.Error("failed to get registrations", zap.Error(err))
		return nil, err
	}

	// Parse schema
	var schema []AssessmentSchemaItem
	if err := json.Unmarshal(course.AssessmentSchema, &schema); err != nil {
		logger.Error("failed to unmarshal assessment schema", zap.Error(err))
		return nil, err
	}

	// Build student grades
	var students []dto.StudentGrades
	for _, reg := range registrations {
		scores, err := s.scoreRepo.GetScoresByRegistration(ctx, reg.ID)
		if err != nil {
			logger.Error("failed to get scores", zap.Error(err))
			continue
		}

		scoreMap := make(map[string]dto.ScoreDetail)
		for _, score := range scores {
			detail := dto.ScoreDetail{
				IsAbsent: utils.PgBoolToBool(score.IsAbsent),
				IsLocked: score.IsLocked.Valid && score.IsLocked.Bool,
			}
			if score.Score.Valid {
				scoreFloat, err := utils.PgNumericToFloat64(score.Score)
				if err == nil {
					detail.Score = &scoreFloat
				}
			}
			scoreMap[score.Slug] = detail
		}

		// Calculate current average
		var currentAverage *float64
		if len(scoreMap) > 0 {
			scoreValues := make(map[string]float64)
			for slug, detail := range scoreMap {
				if detail.Score != nil {
					scoreValues[slug] = *detail.Score
				}
			}
			avg := calculateWeightedAverage(scoreValues, schema)
			currentAverage = &avg
		}

		students = append(students, dto.StudentGrades{
			RegistrationID:     reg.ID,
			StudentID:          reg.StudentID,
			StudentNumber:      reg.StudentNumber,
			FirstName:          utils.PgTextToString(reg.StudentFirstName),
			LastName:           utils.PgTextToString(reg.StudentLastName),
			Scores:             scoreMap,
			CurrentAverage:     currentAverage,
			IsAttendanceFailed: utils.PgBoolToBool(reg.IsAttendanceFailed),
		})
	}

	return &dto.CourseStudentsResponse{
		CourseID:   courseID,
		CourseCode: course.CourseCode,
		Students:   students,
	}, nil
}

// ============================================
// Helper Functions
// ============================================

func (s *GradeService) checkAllFinalScoresComplete(ctx context.Context, courseID uuid.UUID) (bool, error) {
	totalStudents, err := s.registrationRepo.CountRegistrationsByCourse(ctx, courseID)
	if err != nil {
		return false, err
	}

	finalGradedCount, err := s.scoreRepo.CountScoresBySlugAndCourse(ctx, db.CountScoresBySlugAndCourseParams{
		CourseID: courseID,
		Slug:     "final",
	})
	if err != nil {
		return false, err
	}

	return finalGradedCount >= totalStudents, nil
}

// checkAllScoresLocked checks if all assessment scores for a course are locked
// Returns true only when every student has a locked score for every assessment
func (s *GradeService) checkAllScoresLocked(ctx context.Context, courseID uuid.UUID) (bool, error) {
	// 1. Get course and parse assessment schema
	course, err := s.cacheRepo.GetCourseCacheByID(ctx, courseID)
	if err != nil {
		return false, err
	}

	var schema []AssessmentSchemaItem
	if err := json.Unmarshal(course.AssessmentSchema, &schema); err != nil {
		return false, err
	}

	// 2. Get total students
	totalStudents, err := s.registrationRepo.CountRegistrationsByCourse(ctx, courseID)
	if err != nil {
		return false, err
	}

	if totalStudents == 0 {
		return false, nil
	}

	// 3. For each assessment, check if all students have locked scores
	for _, item := range schema {
		lockedCount, err := s.scoreRepo.CountLockedScoresBySlugAndCourse(ctx, courseID, item.Slug)
		if err != nil {
			return false, err
		}

		if lockedCount < totalStudents {
			logger.Debug("not all scores locked",
				zap.String("slug", item.Slug),
				zap.Int64("locked_count", lockedCount),
				zap.Int64("total_students", totalStudents),
			)
			return false, nil
		}
	}

	return true, nil
}

func isValidSlug(schema []AssessmentSchemaItem, slug string) bool {
	for _, item := range schema {
		if item.Slug == slug {
			return true
		}
	}
	return false
}

func (s *GradeService) publishGradeSubmitted(ctx context.Context, studentID uuid.UUID, courseCode string, slug string, score *float64) error {
	if score == nil {
		return nil
	}

	event := dto.GradeSubmittedEvent{
		EventType: "grade.submitted",
		Timestamp: clock.Now(),
	}
	event.Data.StudentID = studentID
	event.Data.CourseCode = courseCode
	event.Data.Slug = slug
	event.Data.Score = *score

	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	_, err = s.outboxRepo.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		EventType:  "grade.submitted",
		RoutingKey: "grade.submitted",
		Payload:    payload,
	})

	return err
}

// ============================================
// Appeal (İtiraz) - Recalculate using frozen statistics
// ============================================

func (s *GradeService) ProcessAppeal(ctx context.Context, req dto.AppealScoreRequest) (*dto.AppealScoreResponse, error) {
	// 1. Get the student's completed course record (contains frozen statistics)
	completedCourse, err := s.completedRepo.GetCompletedCourseByStudentAndCourse(ctx, req.StudentID, req.CourseID)
	if err != nil {
		logger.Error("failed to get completed course", zap.Error(err))
		return nil, errors.ErrCourseNotFound
	}

	// 2. Parse existing assessment scores
	var scores map[string]float64
	if err := json.Unmarshal(completedCourse.AssessmentScores, &scores); err != nil {
		logger.Error("failed to unmarshal assessment scores", zap.Error(err))
		return nil, err
	}

	// 3. Check if the slug exists
	oldScore, exists := scores[req.Slug]
	if !exists {
		return nil, errors.ErrInvalidSlug
	}

	// 4. Parse frozen class statistics
	var frozenStats struct {
		Mean   float64 `json:"mean"`
		StdDev float64 `json:"stddev"`
		Min    float64 `json:"min"`
		Max    float64 `json:"max"`
		Count  int     `json:"total_students"`
	}
	if err := json.Unmarshal(completedCourse.ClassStatistics, &frozenStats); err != nil {
		logger.Error("failed to unmarshal class statistics", zap.Error(err))
		return nil, err
	}

	// 5. Get course to parse assessment schema for weight calculation
	course, err := s.cacheRepo.GetCourseCacheByID(ctx, req.CourseID)
	if err != nil {
		logger.Error("failed to get course", zap.Error(err))
		return nil, errors.ErrCourseNotFound
	}

	var schema []AssessmentSchemaItem
	if err := json.Unmarshal(course.AssessmentSchema, &schema); err != nil {
		logger.Error("failed to unmarshal assessment schema", zap.Error(err))
		return nil, err
	}

	// 6. Update the score
	scores[req.Slug] = req.NewScore

	// 7. Recalculate weighted average
	oldWeightedAvg, _ := utils.PgNumericToFloat64(completedCourse.WeightedAverage)
	newWeightedAvg := calculateWeightedAverage(scores, schema)

	// 8. Recalculate grade point using FROZEN statistics
	var newGradePoint db.GradePointEnum
	var newZScore float64

	if completedCourse.GradingType == db.GradingTypeEnumAbsolute {
		newGradePoint = calculateAbsoluteGradePoint(newWeightedAvg)
	} else {
		newGradePoint, newZScore = calculateZScoreGradePoint(newWeightedAvg, frozenStats.Mean, frozenStats.StdDev)
	}

	// 9. Marshal updated scores
	updatedScoresJSON, err := json.Marshal(scores)
	if err != nil {
		logger.Error("failed to marshal updated scores", zap.Error(err))
		return nil, err
	}

	// 10. Update grading config with new z-score if relative
	gradingConfig := make(map[string]any)
	if completedCourse.GradingType == db.GradingTypeEnumRelative {
		gradingConfig["class_mean"] = frozenStats.Mean
		gradingConfig["class_stddev"] = frozenStats.StdDev
		gradingConfig["student_z_score"] = newZScore
	}
	gradingConfigJSON, _ := json.Marshal(gradingConfig)

	// 11. Update the completed course record
	err = s.completedRepo.UpdateCompletedCourseAfterAppeal(ctx, db.UpdateCompletedCourseAfterAppealParams{
		StudentID:        req.StudentID,
		CourseID:         req.CourseID,
		AssessmentScores: updatedScoresJSON,
		WeightedAverage:  utils.Float64ToPgNumeric(newWeightedAvg),
		GradePoint:       newGradePoint,
		GradingConfig:    gradingConfigJSON,
	})
	if err != nil {
		logger.Error("failed to update completed course after appeal", zap.Error(err))
		return nil, err
	}

	// Audit log
	if s.auditLogger != nil {
		// Extract actor_id from context (set by handler)
		actorID := ""
		if v := ctx.Value("user_id"); v != nil {
			actorID, _ = v.(string)
		}
		s.auditLogger.Log(ctx, audit.AuditEvent{
			ActorID:      actorID,
			ActorRole:    "admin",
			Action:       "grade.appeal_processed",
			ResourceType: "grade",
			ResourceID:   req.CourseID.String(),
			Details: map[string]any{
				"student_id":      req.StudentID.String(),
				"course_code":     completedCourse.CourseCode,
				"slug":            req.Slug,
				"old_score":       oldScore,
				"new_score":       req.NewScore,
				"old_grade_point": string(completedCourse.GradePoint),
				"new_grade_point": string(newGradePoint),
				"reason":          req.Reason,
			},
		})
	}

	logger.Info("appeal processed successfully",
		zap.String("student_id", req.StudentID.String()),
		zap.String("course_code", completedCourse.CourseCode),
		zap.String("slug", req.Slug),
		zap.Float64("old_score", oldScore),
		zap.Float64("new_score", req.NewScore),
		zap.String("old_grade", string(completedCourse.GradePoint)),
		zap.String("new_grade", string(newGradePoint)),
	)

	response := &dto.AppealScoreResponse{
		StudentID:          req.StudentID,
		CourseCode:         completedCourse.CourseCode,
		Slug:               req.Slug,
		OldScore:           oldScore,
		NewScore:           req.NewScore,
		OldWeightedAverage: oldWeightedAvg,
		NewWeightedAverage: newWeightedAvg,
		OldGradePoint:      string(completedCourse.GradePoint),
		NewGradePoint:      string(newGradePoint),
		GradingType:        string(completedCourse.GradingType),
		FrozenClassMean:    frozenStats.Mean,
	}

	if completedCourse.GradingType == db.GradingTypeEnumRelative {
		response.FrozenClassStdDev = frozenStats.StdDev
	}

	return response, nil
}

// ============================================
// Score Lock/Unlock (Admin)
// ============================================

func (s *GradeService) UnlockScore(ctx context.Context, registrationID uuid.UUID, slug string) error {
	_, err := s.scoreRepo.GetScoreByRegistrationAndSlug(ctx, registrationID, slug)
	if err != nil {
		return errors.ErrScoreNotFound
	}

	if err := s.scoreRepo.UnlockScore(ctx, registrationID, slug); err != nil {
		logger.Error("failed to unlock score", zap.Error(err))
		return err
	}

	logger.Info("score unlocked by admin",
		zap.String("registration_id", registrationID.String()),
		zap.String("slug", slug),
	)
	return nil
}

func (s *GradeService) LockScore(ctx context.Context, registrationID uuid.UUID, slug string) error {
	_, err := s.scoreRepo.GetScoreByRegistrationAndSlug(ctx, registrationID, slug)
	if err != nil {
		return errors.ErrScoreNotFound
	}

	if err := s.scoreRepo.LockScore(ctx, registrationID, slug); err != nil {
		logger.Error("failed to lock score", zap.Error(err))
		return err
	}

	logger.Info("score locked by admin",
		zap.String("registration_id", registrationID.String()),
		zap.String("slug", slug),
	)
	return nil
}

// ============================================
// Grading Period Check
// ============================================

// checkCanEditGrade checks the 3-layer lock model: score lock + deadline + admin override.
// If no active period is defined, grading is allowed (no deadline enforced).
func (s *GradeService) checkCanEditGrade(ctx context.Context, semester string, courseID *uuid.UUID, isLocked bool, isAdmin bool) rules.GradeEditResult {
	period, err := s.periodRepo.GetEffectiveDeadline(ctx, semester, courseID)
	if err != nil {
		// No period defined — still check is_locked
		if isLocked && !isAdmin {
			return rules.GradeEditResult{
				Allowed: false,
				Reason:  "score is locked — admin must unlock it first",
			}
		}
		return rules.GradeEditResult{Allowed: true, Reason: "no grading period defined — allowed by default"}
	}

	var overrideDeadline *time.Time
	if courseID != nil && period.CourseID != nil {
		// The returned period is a course-specific override
		overrideDeadline = &period.PeriodEnd
		// Fetch global deadline for the rule engine
		globalPeriod, gErr := s.periodRepo.GetEffectiveDeadline(ctx, semester, nil)
		if gErr == nil {
			return rules.CanEditGrade(rules.GradeEditParams{
				IsLocked:         isLocked,
				GlobalDeadline:   globalPeriod.PeriodEnd,
				OverrideDeadline: overrideDeadline,
				IsAdminAction:    isAdmin,
			})
		}
	}

	return rules.CanEditGrade(rules.GradeEditParams{
		IsLocked:         isLocked,
		GlobalDeadline:   period.PeriodEnd,
		OverrideDeadline: nil,
		IsAdminAction:    isAdmin,
	})
}
