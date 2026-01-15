package service

import (
	"context"
	"testing"

	sharedErrors "github.com/baaaki/mydreamcampus/shared/errors"
	serviceErrors "github.com/baaaki/mydreamcampus/student-service/internal/errors"
	"github.com/baaaki/mydreamcampus/shared/logger"
	"github.com/baaaki/mydreamcampus/student-service/internal/db"
	"github.com/baaaki/mydreamcampus/student-service/internal/dto"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func init() {
	// Initialize logger for tests
	logger.Init("test")
}

// MockStudentRepository mocks the student repository
type MockStudentRepository struct {
	mock.Mock
}

func (m *MockStudentRepository) GetStudentByNumber(ctx context.Context, studentNumber string) (db.Student, error) {
	args := m.Called(ctx, studentNumber)
	return args.Get(0).(db.Student), args.Error(1)
}

func (m *MockStudentRepository) GetStudentByEmail(ctx context.Context, email string) (db.Student, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(db.Student), args.Error(1)
}

func (m *MockStudentRepository) GetStudentByID(ctx context.Context, id uuid.UUID) (db.Student, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(db.Student), args.Error(1)
}

func (m *MockStudentRepository) CreateStudentWithEvent(ctx context.Context, params db.CreateStudentParams, eventPayload map[string]interface{}) (db.Student, error) {
	args := m.Called(ctx, params, eventPayload)
	return args.Get(0).(db.Student), args.Error(1)
}

func (m *MockStudentRepository) UpdateStudentWithEvent(ctx context.Context, id uuid.UUID, params db.UpdateStudentParams, eventPayload map[string]interface{}) (db.Student, error) {
	args := m.Called(ctx, id, params, eventPayload)
	return args.Get(0).(db.Student), args.Error(1)
}

func (m *MockStudentRepository) SoftDeleteStudentWithEvent(ctx context.Context, id uuid.UUID, eventPayload map[string]interface{}) error {
	args := m.Called(ctx, id, eventPayload)
	return args.Error(0)
}

func (m *MockStudentRepository) ListStudentsFiltered(ctx context.Context, params db.ListStudentsParams) ([]db.Student, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]db.Student), args.Error(1)
}

func (m *MockStudentRepository) CountStudents(ctx context.Context) (int64, error) {
	args := m.Called(ctx)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockStudentRepository) ListStudentsByAdvisor(ctx context.Context, advisorID uuid.UUID) ([]db.Student, error) {
	args := m.Called(ctx, advisorID)
	return args.Get(0).([]db.Student), args.Error(1)
}

func (m *MockStudentRepository) ListOrphanedStudents(ctx context.Context, limit, offset int32) ([]db.Student, int64, error) {
	args := m.Called(ctx, limit, offset)
	return args.Get(0).([]db.Student), args.Get(1).(int64), args.Error(2)
}

func (m *MockStudentRepository) BulkAssignAdvisor(ctx context.Context, studentIDs []uuid.UUID, advisorID uuid.UUID, eventPayloads []map[string]interface{}) error {
	args := m.Called(ctx, studentIDs, advisorID, eventPayloads)
	return args.Error(0)
}

func (m *MockStudentRepository) SearchStudents(ctx context.Context, params db.SearchStudentsParams) ([]db.Student, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]db.Student), args.Error(1)
}

// MockStaffService mocks the staff service interface
type MockStaffService struct {
	mock.Mock
}

func (m *MockStaffService) ValidateAdvisor(ctx context.Context, advisorID uuid.UUID) error {
	args := m.Called(ctx, advisorID)
	return args.Error(0)
}

func (m *MockStaffService) GetInstructorsByDepartment(ctx context.Context, department string) ([]uuid.UUID, error) {
	args := m.Called(ctx, department)
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

// Helper to create StudentService with mocks
func setupService() (*StudentService, *MockStudentRepository, *MockStaffService) {
	mockRepo := new(MockStudentRepository)
	mockStaffService := new(MockStaffService)

	// Cast to interfaces that StudentService expects
	var repoInterface StudentRepositoryInterface = mockRepo
	var staffInterface StaffServiceInterface = mockStaffService

	service := NewStudentService(repoInterface, staffInterface)
	return service, mockRepo, mockStaffService
}

// Test CreateStudent - Success
func TestCreateStudent_Success(t *testing.T) {
	service, mockRepo, mockStaffService := setupService()
	ctx := context.Background()
	advisorID := uuid.New()
	studentID := uuid.New()

	req := dto.CreateStudentRequest{
		StudentNumber:  "2024001",
		FirstName:      "Ahmet",
		LastName:       "Yılmaz",
		Email:          "ahmet@university.edu.tr",
		Faculty:        "Engineering",
		Department:     "Computer Engineering",
		EnrollmentYear: 2024,
		ClassLevel:     1,
		AdvisorID:      advisorID,
	}

	mockRepo.On("GetStudentByNumber", ctx, "2024001").Return(db.Student{}, nil)
	mockRepo.On("GetStudentByEmail", ctx, "ahmet@university.edu.tr").Return(db.Student{}, nil)
	mockStaffService.On("ValidateAdvisor", ctx, advisorID).Return(nil)

	createdStudent := db.Student{
		ID:             pgtype.UUID{Bytes: studentID, Valid: true},
		StudentNumber:  "2024001",
		FirstName:      "Ahmet",
		LastName:       "Yılmaz",
		Email:          "ahmet@university.edu.tr",
		Faculty:        "Engineering",
		Department:     "Computer Engineering",
		EnrollmentYear: 2024,
		ClassLevel:     1,
		AdvisorID:      pgtype.UUID{Bytes: advisorID, Valid: true},
		Status:         pgtype.Text{String: "active", Valid: true},
	}
	mockRepo.On("CreateStudentWithEvent", ctx, mock.AnythingOfType("db.CreateStudentParams"), mock.AnythingOfType("map[string]interface {}")).Return(createdStudent, nil)

	result, err := service.CreateStudent(ctx, req)

	assert.NoError(t, err)
	assert.Equal(t, "2024001", result.StudentNumber)
	assert.Equal(t, "Ahmet", result.FirstName)
	assert.Equal(t, "ahmet@university.edu.tr", result.Email)
	mockRepo.AssertExpectations(t)
	mockStaffService.AssertExpectations(t)
}

// Test CreateStudent - Student Number Already Exists
func TestCreateStudent_StudentNumberExists(t *testing.T) {
	service, mockRepo, _ := setupService()
	ctx := context.Background()
	advisorID := uuid.New()

	req := dto.CreateStudentRequest{
		StudentNumber:  "2024001",
		FirstName:      "Ahmet",
		LastName:       "Yılmaz",
		Email:          "ahmet@university.edu.tr",
		Faculty:        "Engineering",
		Department:     "Computer Engineering",
		EnrollmentYear: 2024,
		ClassLevel:     1,
		AdvisorID:      advisorID,
	}

	existingStudent := db.Student{StudentNumber: "2024001"}
	mockRepo.On("GetStudentByNumber", ctx, "2024001").Return(existingStudent, nil)

	result, err := service.CreateStudent(ctx, req)

	assert.Error(t, err)
	assert.Equal(t, serviceErrors.ErrStudentNumberExists, err)
	assert.Equal(t, "", result.StudentNumber)
	mockRepo.AssertExpectations(t)
}

// Test CreateStudent - Email Already Exists
func TestCreateStudent_EmailExists(t *testing.T) {
	service, mockRepo, _ := setupService()
	ctx := context.Background()
	advisorID := uuid.New()

	req := dto.CreateStudentRequest{
		StudentNumber:  "2024001",
		FirstName:      "Ahmet",
		LastName:       "Yılmaz",
		Email:          "ahmet@university.edu.tr",
		Faculty:        "Engineering",
		Department:     "Computer Engineering",
		EnrollmentYear: 2024,
		ClassLevel:     1,
		AdvisorID:      advisorID,
	}

	mockRepo.On("GetStudentByNumber", ctx, "2024001").Return(db.Student{}, nil)
	existingStudent := db.Student{Email: "ahmet@university.edu.tr"}
	mockRepo.On("GetStudentByEmail", ctx, "ahmet@university.edu.tr").Return(existingStudent, nil)

	result, err := service.CreateStudent(ctx, req)

	assert.Error(t, err)
	assert.Equal(t, serviceErrors.ErrStudentEmailExists, err)
	assert.Equal(t, "", result.StudentNumber)
	mockRepo.AssertExpectations(t)
}

// Test CreateStudent - Advisor Not Found
func TestCreateStudent_AdvisorNotFound(t *testing.T) {
	service, mockRepo, mockStaffService := setupService()
	ctx := context.Background()
	advisorID := uuid.New()

	req := dto.CreateStudentRequest{
		StudentNumber:  "2024001",
		FirstName:      "Ahmet",
		LastName:       "Yılmaz",
		Email:          "ahmet@university.edu.tr",
		Faculty:        "Engineering",
		Department:     "Computer Engineering",
		EnrollmentYear: 2024,
		ClassLevel:     1,
		AdvisorID:      advisorID,
	}

	mockRepo.On("GetStudentByNumber", ctx, "2024001").Return(db.Student{}, nil)
	mockRepo.On("GetStudentByEmail", ctx, "ahmet@university.edu.tr").Return(db.Student{}, nil)
	mockStaffService.On("ValidateAdvisor", ctx, advisorID).Return(serviceErrors.ErrAdvisorNotFound)

	result, err := service.CreateStudent(ctx, req)

	assert.Error(t, err)
	assert.Equal(t, serviceErrors.ErrAdvisorNotFound, err)
	assert.Equal(t, "", result.StudentNumber)
	mockRepo.AssertExpectations(t)
	mockStaffService.AssertExpectations(t)
}

// Test GetStudentByID - Success
func TestGetStudentByID_Success(t *testing.T) {
	service, mockRepo, _ := setupService()
	ctx := context.Background()
	studentID := uuid.New()

	student := db.Student{
		ID:             pgtype.UUID{Bytes: studentID, Valid: true},
		StudentNumber:  "2024001",
		FirstName:      "Ahmet",
		LastName:       "Yılmaz",
		Email:          "ahmet@university.edu.tr",
		Faculty:        "Engineering",
		Department:     "Computer Engineering",
		EnrollmentYear: 2024,
		ClassLevel:     1,
		Status:         pgtype.Text{String: "active", Valid: true},
	}
	mockRepo.On("GetStudentByID", ctx, studentID).Return(student, nil)

	result, err := service.GetStudentByID(ctx, studentID.String())

	assert.NoError(t, err)
	assert.Equal(t, "2024001", result.StudentNumber)
	assert.Equal(t, "Ahmet", result.FirstName)
	mockRepo.AssertExpectations(t)
}

// Test GetStudentByID - Invalid ID
func TestGetStudentByID_InvalidID(t *testing.T) {
	service, _, _ := setupService()
	ctx := context.Background()

	result, err := service.GetStudentByID(ctx, "invalid-uuid")

	assert.Error(t, err)
	assert.Equal(t, sharedErrors.ErrInvalidID, err)
	assert.Equal(t, "", result.StudentNumber)
}

// Test GetStudentByID - Not Found
func TestGetStudentByID_NotFound(t *testing.T) {
	service, mockRepo, _ := setupService()
	ctx := context.Background()
	studentID := uuid.New()

	mockRepo.On("GetStudentByID", ctx, studentID).Return(db.Student{}, serviceErrors.ErrStudentNotFoundRepo)

	result, err := service.GetStudentByID(ctx, studentID.String())

	assert.Error(t, err)
	assert.Equal(t, serviceErrors.ErrStudentNotFound, err)
	assert.Equal(t, "", result.StudentNumber)
	mockRepo.AssertExpectations(t)
}

// Test UpdateStudent - Success
func TestUpdateStudent_Success(t *testing.T) {
	service, mockRepo, mockStaffService := setupService()
	ctx := context.Background()
	studentID := uuid.New()
	newAdvisorID := uuid.New()
	newClassLevel := int16(2)
	newStatus := "active"

	req := dto.UpdateStudentRequest{
		ClassLevel: &newClassLevel,
		AdvisorID:  &newAdvisorID,
		Status:     &newStatus,
	}

	existingStudent := db.Student{
		ID:             pgtype.UUID{Bytes: studentID, Valid: true},
		StudentNumber:  "2024001",
		FirstName:      "Ahmet",
		LastName:       "Yılmaz",
		Email:          "ahmet@university.edu.tr",
		Faculty:        "Engineering",
		Department:     "Computer Engineering",
		EnrollmentYear: 2024,
		ClassLevel:     1,
		Status:         pgtype.Text{String: "active", Valid: true},
	}
	mockRepo.On("GetStudentByID", ctx, studentID).Return(existingStudent, nil)
	mockStaffService.On("ValidateAdvisor", ctx, newAdvisorID).Return(nil)

	updatedStudent := existingStudent
	updatedStudent.ClassLevel = 2
	updatedStudent.AdvisorID = pgtype.UUID{Bytes: newAdvisorID, Valid: true}
	mockRepo.On("UpdateStudentWithEvent", ctx, studentID, mock.AnythingOfType("db.UpdateStudentParams"), mock.AnythingOfType("map[string]interface {}")).Return(updatedStudent, nil)

	result, err := service.UpdateStudent(ctx, studentID.String(), req)

	assert.NoError(t, err)
	assert.Equal(t, int16(2), result.ClassLevel)
	mockRepo.AssertExpectations(t)
	mockStaffService.AssertExpectations(t)
}

// Test DeleteStudent - Success
func TestDeleteStudent_Success(t *testing.T) {
	service, mockRepo, _ := setupService()
	ctx := context.Background()
	studentID := uuid.New()

	student := db.Student{
		ID:            pgtype.UUID{Bytes: studentID, Valid: true},
		StudentNumber: "2024001",
		FirstName:     "Ahmet",
		LastName:      "Yılmaz",
	}
	mockRepo.On("GetStudentByID", ctx, studentID).Return(student, nil)
	mockRepo.On("SoftDeleteStudentWithEvent", ctx, studentID, mock.AnythingOfType("map[string]interface {}")).Return(nil)

	err := service.DeleteStudent(ctx, studentID.String())

	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

// Test DeleteStudent - Student Not Found
func TestDeleteStudent_NotFound(t *testing.T) {
	service, mockRepo, _ := setupService()
	ctx := context.Background()
	studentID := uuid.New()

	mockRepo.On("GetStudentByID", ctx, studentID).Return(db.Student{}, serviceErrors.ErrStudentNotFoundRepo)

	err := service.DeleteStudent(ctx, studentID.String())

	assert.Error(t, err)
	assert.Equal(t, serviceErrors.ErrStudentNotFound, err)
	mockRepo.AssertExpectations(t)
}
