package dto

import (
	"time"

	"github.com/google/uuid"
)

// BaseEvent contains common event fields
type BaseEvent struct {
	EventID   uuid.UUID   `json:"event_id"`
	EventType string      `json:"event_type"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// =======================================
// CONSUMED EVENTS
// =======================================

// StudentCreatedEvent is consumed from student service
type StudentCreatedEventData struct {
	StudentID     uuid.UUID `json:"student_id"`
	StudentNumber string    `json:"student_number"`
	FirstName     string    `json:"first_name"`
	LastName      string    `json:"last_name"`
	Email         string    `json:"email"`
	Department    string    `json:"department"`
}

// StudentUpdatedEvent is consumed from student service
type StudentUpdatedEventData struct {
	StudentID     uuid.UUID `json:"student_id"`
	StudentNumber string    `json:"student_number"`
	FirstName     string    `json:"first_name"`
	LastName      string    `json:"last_name"`
	Email         string    `json:"email"`
	Department    string    `json:"department"`
}

// StudentDeactivatedEvent is consumed from student service
type StudentDeactivatedEventData struct {
	StudentID uuid.UUID `json:"student_id"`
}

// CourseSemesterCreatedEvent is consumed from course catalog service
type CourseSemesterCreatedEventData struct {
	CourseID          uuid.UUID `json:"course_id"`
	CourseCode        string    `json:"course_code"`
	CourseName        string    `json:"course_name"`
	Credits           int16     `json:"credits"`
	Semester          string    `json:"semester"`
	Department        string    `json:"department"`
	InstructorID      uuid.UUID `json:"instructor_id"`
	InstructorName    string    `json:"instructor_name"`
	TotalWeeks        int16     `json:"total_weeks"`
}

// CourseSemesterUpdatedEvent is consumed from course catalog service
type CourseSemesterUpdatedEventData struct {
	CourseID          uuid.UUID `json:"course_id"`
	CourseCode        string    `json:"course_code"`
	CourseName        string    `json:"course_name"`
	Credits           int16     `json:"credits"`
	Semester          string    `json:"semester"`
	Department        string    `json:"department"`
	InstructorID      uuid.UUID `json:"instructor_id"`
	InstructorName    string    `json:"instructor_name"`
	TotalWeeks        int16     `json:"total_weeks"`
}

// CourseSemesterDeletedEvent is consumed from course catalog service
type CourseSemesterDeletedEventData struct {
	CourseID   uuid.UUID `json:"course_id"`
	CourseCode string    `json:"course_code"`
	Semester   string    `json:"semester"`
}

// EnrollmentCourseInfo represents a course in enrollment event
type EnrollmentCourseInfo struct {
	CourseID   uuid.UUID `json:"course_id"`
	CourseCode string    `json:"course_code"`
	CourseName string    `json:"course_name"`
	Credits    int16     `json:"credits"`
}

// EnrollmentProgramApprovedEvent is consumed from enrollment service
type EnrollmentProgramApprovedEventData struct {
	ProgramID     uuid.UUID              `json:"program_id"`
	StudentID     uuid.UUID              `json:"student_id"`
	StudentNumber string                 `json:"student_number"`
	StudentEmail  string                 `json:"student_email"`
	Semester      string                 `json:"semester"`
	Courses       []EnrollmentCourseInfo `json:"courses"`
}

// =======================================
// PUBLISHED EVENTS
// =======================================

// AttendanceSemesterFailedEventData is published when student fails due to attendance
type AttendanceSemesterFailedEventData struct {
	StudentID          uuid.UUID `json:"student_id"`
	StudentNumber      string    `json:"student_number"`
	StudentEmail       string    `json:"student_email"`
	CourseID           uuid.UUID `json:"course_id"`
	CourseCode         string    `json:"course_code"`
	CourseName         string    `json:"course_name"`
	Semester           string    `json:"semester"`
	TotalWeeks         int16     `json:"total_weeks"`
	PresentCount       int       `json:"present_count"`
	AbsentCount        int       `json:"absent_count"`
	MaxAllowedAbsences int       `json:"max_allowed_absences"`
}
