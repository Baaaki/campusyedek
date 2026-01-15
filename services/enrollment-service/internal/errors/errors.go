package errors

import "errors"

// Enrollment-specific errors
var (
	// Student errors
	ErrStudentDeactivated = errors.New("student account is deactivated")
	ErrStudentNotFound    = errors.New("student not found in cache")

	// Enrollment errors
	ErrAlreadySubmitted      = errors.New("enrollment program already submitted for this semester")
	ErrProgramNotFound       = errors.New("enrollment program not found")
	ErrInvalidStatus         = errors.New("invalid enrollment status")
	ErrCannotModifyApproved  = errors.New("cannot modify approved enrollment program")

	// Course errors
	ErrCourseFull            = errors.New("course capacity is full")
	ErrCourseNotFound        = errors.New("course not found")
	ErrInvalidDepartment     = errors.New("course does not belong to student's department")
	ErrInvalidClassLevel     = errors.New("course class level exceeds student's class level")

	// Prerequisite errors
	ErrPrerequisitesNotMet   = errors.New("prerequisites not met for one or more courses")
	ErrPrerequisiteNotFound  = errors.New("prerequisite information not found")

	// Schedule errors
	ErrScheduleConflict      = errors.New("schedule conflict detected between courses")

	// Validation errors
	ErrInvalidSemester       = errors.New("invalid semester format")
	ErrNoCourses             = errors.New("no courses provided in enrollment request")
	ErrInvalidCourseID       = errors.New("invalid course ID")
)
