package dto

// ScheduleSession represents a course schedule session
type ScheduleSession struct {
	DayOfWeek   string `json:"day_of_week"`
	SlotNumbers []int  `json:"slot_numbers"`
}

// CourseBasic represents basic course information
type CourseBasic struct {
	ID               string            `json:"id"`
	CourseCode       string            `json:"course_code"`
	CourseName       string            `json:"course_name"`
	Credits          int16             `json:"credits"`
	InstructorName   string            `json:"instructor,omitempty"`
	ScheduleSessions []ScheduleSession `json:"schedule_sessions"`
}

// PaginationRequest represents pagination parameters
type PaginationRequest struct {
	Page     int `json:"page" form:"page"`
	PageSize int `json:"page_size" form:"page_size"`
}

// PaginationResponse represents pagination metadata
type PaginationResponse struct {
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalItems int `json:"total_items"`
	TotalPages int `json:"total_pages"`
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code,omitempty"`
}

// SuccessResponse represents a generic success response
type SuccessResponse struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
