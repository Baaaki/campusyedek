package errors

import (
	"net/http"

	sharedErrors "github.com/baaaki/mydreamcampus/shared/errors"
)

// ============================================================================
// COURSE CATALOG SERVICE SPECIFIC ERRORS
// These errors are specific to course catalog management domain
// ============================================================================

var (
	// Catalog errors (AppError for HTTP responses)
	ErrCourseNotFound            = sharedErrors.New("COURSE_NOT_FOUND", "Course not found", http.StatusNotFound)
	ErrCourseCodeExists          = sharedErrors.New("COURSE_CODE_EXISTS", "Course code already exists", http.StatusConflict)
	ErrInvalidPrerequisite       = sharedErrors.New("INVALID_PREREQUISITE", "Invalid prerequisite course", http.StatusBadRequest)
	ErrInvalidPrerequisiteLevel  = sharedErrors.New("INVALID_PREREQUISITE_LEVEL", "Prerequisite class level must be less than course class level", http.StatusBadRequest)
	ErrInvalidStatus             = sharedErrors.New("INVALID_STATUS", "Invalid course status", http.StatusBadRequest)
	ErrCourseNotActive           = sharedErrors.New("COURSE_NOT_ACTIVE", "Course is not active", http.StatusBadRequest)

	// Semester course errors (AppError for HTTP responses)
	ErrSemesterCourseNotFound    = sharedErrors.New("SEMESTER_COURSE_NOT_FOUND", "Semester course not found", http.StatusNotFound)
	ErrCourseAlreadyOpened       = sharedErrors.New("COURSE_ALREADY_OPENED", "Course already opened for this semester", http.StatusConflict)
	ErrClassLevelMismatch        = sharedErrors.New("CLASS_LEVEL_MISMATCH", "Class level mismatch between request and catalog", http.StatusBadRequest)
	ErrSemesterAlreadyExists     = sharedErrors.New("SEMESTER_ALREADY_EXISTS", "Target semester already has courses", http.StatusConflict)
	ErrSourceSemesterNotFound    = sharedErrors.New("SOURCE_SEMESTER_NOT_FOUND", "Source semester not found", http.StatusNotFound)
	ErrCourseHasEnrollments      = sharedErrors.New("COURSE_HAS_ENROLLMENTS", "Course has enrollments", http.StatusConflict)

	// Instructor errors (AppError for HTTP responses)
	ErrInstructorNotFound        = sharedErrors.New("INSTRUCTOR_NOT_FOUND", "Instructor not found", http.StatusNotFound)
	ErrInstructorNotActive       = sharedErrors.New("INSTRUCTOR_NOT_ACTIVE", "Instructor is not active", http.StatusBadRequest)
	ErrInstructorNotInDepartment = sharedErrors.New("INSTRUCTOR_NOT_IN_DEPARTMENT", "Instructor not in department", http.StatusBadRequest)
	ErrInstructorScheduleConflict = sharedErrors.New("INSTRUCTOR_SCHEDULE_CONFLICT", "Instructor has schedule conflict", http.StatusConflict)

	// Schedule errors (AppError for HTTP responses)
	ErrInvalidSlotNumber         = sharedErrors.New("INVALID_SLOT_NUMBER", "Invalid slot number (must be 1-9)", http.StatusBadRequest)
	ErrInvalidDayOfWeek          = sharedErrors.New("INVALID_DAY_OF_WEEK", "Invalid day of week", http.StatusBadRequest)

	// Assessment errors (AppError for HTTP responses)
	ErrInvalidAssessmentSchema   = sharedErrors.New("INVALID_ASSESSMENT_SCHEMA", "Invalid assessment schema", http.StatusBadRequest)
	ErrAssessmentWeightNotHundred = sharedErrors.New("ASSESSMENT_WEIGHT_NOT_HUNDRED", "Assessment weights must sum to 100", http.StatusBadRequest)
	ErrDuplicateAssessmentSlug   = sharedErrors.New("DUPLICATE_ASSESSMENT_SLUG", "Duplicate assessment slug", http.StatusBadRequest)

	// Transaction errors (AppError for HTTP responses)
	ErrTransactionFailed = sharedErrors.New("TRANSACTION_FAILED", "Failed to start database transaction", http.StatusInternalServerError)

	// Repository-specific sentinel errors (for internal use)
	ErrCourseNotFoundRepo         = sharedErrors.ErrNotFoundRepo
	ErrCourseExistsRepo           = sharedErrors.ErrAlreadyExistsRepo
	ErrSemesterCourseNotFoundRepo = sharedErrors.ErrNotFoundRepo
	ErrCourseAlreadyOpenedRepo    = sharedErrors.ErrAlreadyExistsRepo
)
