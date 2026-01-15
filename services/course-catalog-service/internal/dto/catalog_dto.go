package dto

import (
	"time"

	"github.com/google/uuid"
)

// Prerequisite represents a prerequisite course
type Prerequisite struct {
	ID         uuid.UUID `json:"id"`
	CourseCode string    `json:"course_code"`
	CourseName string    `json:"course_name"`
}

// CreateCourseRequest represents the request to create a new course
type CreateCourseRequest struct {
	CourseCode        string         `json:"course_code" binding:"required,min=2,max=50"`
	Name              string         `json:"name" binding:"required,min=3,max=255"`
	Faculty           string         `json:"faculty" binding:"required,min=3,max=100"`
	Department        string         `json:"department" binding:"required,min=3,max=100"`
	ClassLevel        int16          `json:"class_level" binding:"required,min=1,max=6"`
	Credits           int16          `json:"credits" binding:"required,min=1,max=30"`
	TheoreticalHours  int16          `json:"theoretical_hours" binding:"omitempty,min=0,max=20"`
	PracticalHours    int16          `json:"practical_hours" binding:"omitempty,min=0,max=20"`
	CourseType        string         `json:"course_type" binding:"required,oneof=mandatory elective"`
	Prerequisites     []Prerequisite `json:"prerequisites" binding:"omitempty,dive"`
	Description       string         `json:"description" binding:"omitempty,max=5000"`
	LearningOutcomes  string         `json:"learning_outcomes" binding:"omitempty,max=5000"`
	Syllabus          string         `json:"syllabus" binding:"omitempty,max=10000"`
	Status            string         `json:"status" binding:"omitempty,oneof=active draft pending_approval under_revision archived suspended"`
}

// UpdateCourseRequest represents the request to update a course
type UpdateCourseRequest struct {
	Name             *string         `json:"name" binding:"omitempty,min=3,max=255"`
	Faculty          *string         `json:"faculty" binding:"omitempty,min=3,max=100"`
	Department       *string         `json:"department" binding:"omitempty,min=3,max=100"`
	ClassLevel       *int16          `json:"class_level" binding:"omitempty,min=1,max=6"`
	Credits          *int16          `json:"credits" binding:"omitempty,min=1,max=30"`
	TheoreticalHours *int16          `json:"theoretical_hours" binding:"omitempty,min=0,max=20"`
	PracticalHours   *int16          `json:"practical_hours" binding:"omitempty,min=0,max=20"`
	CourseType       *string         `json:"course_type" binding:"omitempty,oneof=mandatory elective"`
	Prerequisites    *[]Prerequisite `json:"prerequisites" binding:"omitempty,dive"`
	Description      *string         `json:"description" binding:"omitempty,max=5000"`
	LearningOutcomes *string         `json:"learning_outcomes" binding:"omitempty,max=5000"`
	Syllabus         *string         `json:"syllabus" binding:"omitempty,max=10000"`
	Status           *string         `json:"status" binding:"omitempty,oneof=active draft pending_approval under_revision archived suspended"`
}

// CourseResponse represents a course in API responses
type CourseResponse struct {
	ID               uuid.UUID      `json:"id"`
	CourseCode       string         `json:"course_code"`
	Name             string         `json:"name"`
	Faculty          string         `json:"faculty"`
	Department       string         `json:"department"`
	ClassLevel       int16          `json:"class_level"`
	Credits          int16          `json:"credits"`
	TheoreticalHours int16          `json:"theoretical_hours"`
	PracticalHours   int16          `json:"practical_hours"`
	CourseType       string         `json:"course_type"`
	Prerequisites    []Prerequisite `json:"prerequisites"`
	Description      *string        `json:"description,omitempty"`
	LearningOutcomes *string        `json:"learning_outcomes,omitempty"`
	Syllabus         *string        `json:"syllabus,omitempty"`
	Status           string         `json:"status"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

// CourseListItem represents a course in list responses (minimal fields)
type CourseListItem struct {
	ID               uuid.UUID      `json:"id"`
	CourseCode       string         `json:"course_code"`
	Name             string         `json:"name"`
	Faculty          string         `json:"faculty"`
	Department       string         `json:"department"`
	ClassLevel       int16          `json:"class_level"`
	Credits          int16          `json:"credits"`
	TheoreticalHours int16          `json:"theoretical_hours"`
	PracticalHours   int16          `json:"practical_hours"`
	CourseType       string         `json:"course_type"`
	Prerequisites    []Prerequisite `json:"prerequisites"`
	Status           string         `json:"status"`
}

// ListCoursesRequest represents query parameters for listing courses
type ListCoursesRequest struct {
	PaginationRequest
	Faculty    *string `form:"faculty" binding:"omitempty"`
	Department *string `form:"department" binding:"omitempty"`
	CourseType *string `form:"course_type" binding:"omitempty,oneof=mandatory elective"`
	Status     *string `form:"status" binding:"omitempty,oneof=active draft pending_approval under_revision archived suspended"`
	ClassLevel *int16  `form:"class_level" binding:"omitempty,min=1,max=6"`
	Search     *string `form:"search" binding:"omitempty,max=100"`
}

// ListCoursesResponse represents the response for listing courses
type ListCoursesResponse struct {
	Data       []CourseListItem   `json:"data"`
	Pagination PaginationResponse `json:"pagination"`
}
