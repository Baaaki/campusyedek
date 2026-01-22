package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/baaaki/mydreamcampus/meal-service/config"
	"github.com/baaaki/mydreamcampus/meal-service/internal/db"
	"github.com/baaaki/mydreamcampus/meal-service/internal/dto"
	serviceErrors "github.com/baaaki/mydreamcampus/meal-service/internal/errors"
	"github.com/baaaki/mydreamcampus/meal-service/internal/repository"
	sharedErrors "github.com/baaaki/mydreamcampus/shared/errors"
	"github.com/baaaki/mydreamcampus/shared/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"go.uber.org/zap"
)

type ReservationService struct {
	reservationRepo  *repository.ReservationRepository
	cafeteriaRepo    *repository.CafeteriaRepository
	studentCacheRepo *repository.StudentCacheRepository
	paymentClient    *PaymentClient
	cfg              *config.Config
	logger           *zap.Logger
}

func NewReservationService(
	reservationRepo *repository.ReservationRepository,
	cafeteriaRepo *repository.CafeteriaRepository,
	studentCacheRepo *repository.StudentCacheRepository,
	paymentClient *PaymentClient,
	cfg *config.Config,
	logger *zap.Logger,
) *ReservationService {
	return &ReservationService{
		reservationRepo:  reservationRepo,
		cafeteriaRepo:    cafeteriaRepo,
		studentCacheRepo: studentCacheRepo,
		paymentClient:    paymentClient,
		cfg:              cfg,
		logger:           logger,
	}
}

// CreateReservation creates a single reservation
func (s *ReservationService) CreateReservation(ctx context.Context, studentID uuid.UUID, req dto.CreateReservationRequest) (*dto.CreateReservationResponse, error) {
	// 1. Check if student is active
	student, err := s.studentCacheRepo.GetStudentCacheByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, sharedErrors.ErrNotFoundRepo) {
			return nil, sharedErrors.ErrNotFound
		}
		s.logger.Error("failed to get student cache", zap.Error(err), zap.String("student_id", studentID.String()))
		return nil, err
	}

	if !student.IsActive {
		return nil, serviceErrors.ErrStudentDeactivated
	}

	// 2. Validate reservation window (Monday 08:00 - Friday 13:00 UTC+3)
	if err := s.validateReservationWindow(); err != nil {
		return nil, err
	}

	// 3. Parse and validate date
	reservationDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, sharedErrors.ErrBadRequest
	}

	// 4. Validate date is in next week (Monday-Friday)
	if err := s.validateReservationDate(reservationDate); err != nil {
		return nil, err
	}

	// 5. Parse cafeteria ID
	cafeteriaID, err := uuid.Parse(req.CafeteriaID)
	if err != nil {
		return nil, sharedErrors.ErrBadRequest
	}

	// 6. Get and validate cafeteria
	cafeteria, err := s.cafeteriaRepo.GetCafeteriaByID(ctx, cafeteriaID)
	if err != nil {
		if errors.Is(err, serviceErrors.ErrCafeteriaNotFoundRepo) {
			return nil, serviceErrors.ErrCafeteriaNotFound
		}
		return nil, err
	}

	if !cafeteria.IsActive {
		return nil, serviceErrors.ErrCafeteriaNotActive
	}

	// 7. Validate meal time and menu type
	if err := s.validateMealTimeAndMenu(req.MealTime, req.MenuType, cafeteria); err != nil {
		return nil, err
	}

	// 8. Check for active reservation (conflict)
	mealTimeEnum, _ := s.parseMealTimeEnum(req.MealTime)
	existing, err := s.reservationRepo.CheckActiveReservation(ctx, db.CheckActiveReservationParams{
		StudentID: utils.UUIDToPgtype(studentID),
		ReservationDate: pgtype.Date{Time: reservationDate, Valid: true},
		MealTime:        mealTimeEnum,
	})
	if err != nil {
		return nil, err
	}

	if existing != nil {
		return nil, serviceErrors.ErrActiveReservationExists
	}

	// 9. Create reservation in pending status
	menuTypeEnum, _ := s.parseMenuTypeEnum(req.MenuType)
	expiresAt := time.Now().Add(time.Duration(s.cfg.Reservation.TimeoutMinutes) * time.Minute)

	reservation, err := s.reservationRepo.CreateReservation(ctx, db.CreateReservationParams{
		BatchID:         pgtype.UUID{Valid: false},
		StudentID: utils.UUIDToPgtype(studentID),
		CafeteriaID: utils.UUIDToPgtype(cafeteriaID),
		ReservationDate: pgtype.Date{Time: reservationDate, Valid: true},
		MealTime:        mealTimeEnum,
		MenuType:        menuTypeEnum,
		Status:          db.ReservationStatusEnumPending,
		ExpiresAt:       pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	if err != nil {
		s.logger.Error("failed to create reservation", zap.Error(err))
		return nil, err
	}

	// 10. Call Payment Service
	referenceID := fmt.Sprintf("res_%s", reservation.ID.String())
	paymentResp, err := s.paymentClient.InitiatePayment(ctx, dto.InitiatePaymentRequest{
		ReferenceID: referenceID,
		Amount:      s.cfg.Reservation.MealPriceTRY,
		Currency:    "TRY",
		Description: fmt.Sprintf("Meal reservation - %s %s", req.Date, req.MealTime),
		StudentID:   studentID.String(),
	})
	if err != nil {
		s.logger.Error("failed to initiate payment", zap.Error(err), zap.String("reservation_id", reservation.ID.String()))
		return nil, err
	}

	s.logger.Info("reservation created",
		zap.String("reservation_id", reservation.ID.String()),
		zap.String("student_id", studentID.String()),
		zap.String("date", req.Date),
		zap.String("meal_time", req.MealTime),
	)

	return &dto.CreateReservationResponse{
		ReservationID: reservation.ID.String(),
		PaymentURL:    paymentResp.PaymentURL,
		Amount:        s.cfg.Reservation.MealPriceTRY,
		Currency:      "TRY",
		ExpiresAt:     expiresAt,
		Reservation: dto.ReservationResponse{
			ID:            reservation.ID.String(),
			Date:          req.Date,
			MealTime:      req.MealTime,
			MenuType:      req.MenuType,
			CafeteriaName: cafeteria.Name,
			Status:        string(reservation.Status),
			IsUsed:        reservation.IsUsed,
			CreatedAt:     reservation.CreatedAt.Time,
		},
	}, nil
}

// CreateBatchReservation creates multiple reservations atomically
func (s *ReservationService) CreateBatchReservation(ctx context.Context, studentID uuid.UUID, req dto.BatchReservationRequest) (*dto.CreateBatchReservationResponse, error) {
	// 1. Check if student is active
	student, err := s.studentCacheRepo.GetStudentCacheByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, sharedErrors.ErrNotFoundRepo) {
			return nil, sharedErrors.ErrNotFound
		}
		return nil, err
	}

	if !student.IsActive {
		return nil, serviceErrors.ErrStudentDeactivated
	}

	// 2. Validate reservation window
	if err := s.validateReservationWindow(); err != nil {
		return nil, err
	}

	// 3. Validate all reservations (collect all errors)
	validationErrors := make([]dto.ValidationError, 0)
	conflicts := make([]dto.ReservationConflict, 0)

	reservationParams := make([]db.CreateReservationParams, 0, len(req.Reservations))
	cafeterias := make(map[string]db.Cafeteria)

	batchID := uuid.New()
	expiresAt := time.Now().Add(time.Duration(s.cfg.Reservation.TimeoutMinutes) * time.Minute)

	for i, r := range req.Reservations {
		// Parse date
		reservationDate, err := time.Parse("2006-01-02", r.Date)
		if err != nil {
			validationErrors = append(validationErrors, dto.ValidationError{
				Index:    i,
				Date:     r.Date,
				MealTime: r.MealTime,
				Code:     "INVALID_DATE_FORMAT",
				Message:  "Invalid date format (expected YYYY-MM-DD)",
			})
			continue
		}

		// Validate date
		if err := s.validateReservationDate(reservationDate); err != nil {
			validationErrors = append(validationErrors, dto.ValidationError{
				Index:    i,
				Date:     r.Date,
				MealTime: r.MealTime,
				Code:     "INVALID_DATE_RANGE",
				Message:  err.Error(),
			})
			continue
		}

		// Parse cafeteria ID
		cafeteriaID, err := uuid.Parse(r.CafeteriaID)
		if err != nil {
			validationErrors = append(validationErrors, dto.ValidationError{
				Index:    i,
				Date:     r.Date,
				MealTime: r.MealTime,
				Code:     "INVALID_CAFETERIA_ID",
				Message:  "Invalid cafeteria ID format",
			})
			continue
		}

		// Get cafeteria (cache it)
		var cafeteria db.Cafeteria
		if cached, ok := cafeterias[r.CafeteriaID]; ok {
			cafeteria = cached
		} else {
			cafeteria, err = s.cafeteriaRepo.GetCafeteriaByID(ctx, cafeteriaID)
			if err != nil {
				if errors.Is(err, serviceErrors.ErrCafeteriaNotFoundRepo) {
					validationErrors = append(validationErrors, dto.ValidationError{
						Index:    i,
						Date:     r.Date,
						MealTime: r.MealTime,
						Code:     "CAFETERIA_NOT_FOUND",
						Message:  "Cafeteria not found",
					})
				} else {
					return nil, err
				}
				continue
			}
			cafeterias[r.CafeteriaID] = cafeteria
		}

		if !cafeteria.IsActive {
			validationErrors = append(validationErrors, dto.ValidationError{
				Index:    i,
				Date:     r.Date,
				MealTime: r.MealTime,
				Code:     "CAFETERIA_NOT_ACTIVE",
				Message:  "Cafeteria is not active",
			})
			continue
		}

		// Validate meal time and menu
		if err := s.validateMealTimeAndMenu(r.MealTime, r.MenuType, cafeteria); err != nil {
			validationErrors = append(validationErrors, dto.ValidationError{
				Index:    i,
				Date:     r.Date,
				MealTime: r.MealTime,
				Code:     s.getErrorCode(err),
				Message:  err.Error(),
			})
			continue
		}

		// Check for conflicts
		mealTimeEnum, _ := s.parseMealTimeEnum(r.MealTime)
		existing, err := s.reservationRepo.CheckActiveReservation(ctx, db.CheckActiveReservationParams{
			StudentID: utils.UUIDToPgtype(studentID),
			ReservationDate: pgtype.Date{Time: reservationDate, Valid: true},
			MealTime:        mealTimeEnum,
		})
		if err != nil {
			return nil, err
		}

		if existing != nil {
			conflicts = append(conflicts, dto.ReservationConflict{
				Date:                  r.Date,
				MealTime:              r.MealTime,
				ExistingReservationID: existing.ID.String(),
				CafeteriaName:         cafeteria.Name,
				Status:                string(existing.Status),
			})
			continue
		}

		// Add to batch
		menuTypeEnum, _ := s.parseMenuTypeEnum(r.MenuType)
		reservationParams = append(reservationParams, db.CreateReservationParams{
			BatchID:         pgtype.UUID{Bytes: batchID, Valid: true},
			StudentID: utils.UUIDToPgtype(studentID),
			CafeteriaID: utils.UUIDToPgtype(cafeteriaID),
			ReservationDate: pgtype.Date{Time: reservationDate, Valid: true},
			MealTime:        mealTimeEnum,
			MenuType:        menuTypeEnum,
			Status:          db.ReservationStatusEnumPending,
			ExpiresAt:       pgtype.Timestamptz{Time: expiresAt, Valid: true},
		})
	}

	// If there are any validation errors, return them
	if len(validationErrors) > 0 {
		return nil, fmt.Errorf("%w", serviceErrors.ErrValidationErrors)
	}

	// If there are any conflicts, return them
	if len(conflicts) > 0 {
		return nil, fmt.Errorf("%w", serviceErrors.ErrReservationConflicts)
	}

	// Create all reservations atomically
	reservations, err := s.reservationRepo.CreateBatchReservations(ctx, reservationParams)
	if err != nil {
		s.logger.Error("failed to create batch reservations", zap.Error(err))
		return nil, err
	}

	// Call Payment Service for batch
	totalAmount := s.cfg.Reservation.MealPriceTRY * float64(len(reservations))
	referenceID := fmt.Sprintf("bat_%s", batchID.String())
	paymentResp, err := s.paymentClient.InitiatePayment(ctx, dto.InitiatePaymentRequest{
		ReferenceID: referenceID,
		Amount:      totalAmount,
		Currency:    "TRY",
		Description: fmt.Sprintf("Batch meal reservation - %d meals", len(reservations)),
		StudentID:   studentID.String(),
	})
	if err != nil {
		s.logger.Error("failed to initiate batch payment", zap.Error(err), zap.String("batch_id", batchID.String()))
		return nil, err
	}

	// Build response
	reservationResponses := make([]dto.ReservationResponse, 0, len(reservations))
	for _, r := range reservations {
		cafeteria := cafeterias[r.CafeteriaID.String()]
		reservationResponses = append(reservationResponses, dto.ReservationResponse{
			ID:            r.ID.String(),
			Date:          r.ReservationDate.Time.Format("2006-01-02"),
			MealTime:      string(r.MealTime),
			MenuType:      string(r.MenuType),
			CafeteriaName: cafeteria.Name,
			Status:        string(r.Status),
			IsUsed:        r.IsUsed,
			CreatedAt:     r.CreatedAt.Time,
		})
	}

	s.logger.Info("batch reservation created",
		zap.String("batch_id", batchID.String()),
		zap.String("student_id", studentID.String()),
		zap.Int("count", len(reservations)),
	)

	return &dto.CreateBatchReservationResponse{
		BatchID:      batchID.String(),
		PaymentURL:   paymentResp.PaymentURL,
		TotalAmount:  totalAmount,
		Currency:     "TRY",
		ExpiresAt:    expiresAt,
		Reservations: reservationResponses,
	}, nil
}

// GetMyReservations returns student's reservations with optional filters
func (s *ReservationService) GetMyReservations(ctx context.Context, studentID uuid.UUID, query dto.MyReservationsQuery) (*dto.MyReservationsResponse, error) {
	var reservations []db.GetStudentReservationsFilteredRow
	var err error

	// Parse optional filters
	var fromDate, toDate pgtype.Date
	var status db.ReservationStatusEnum

	if query.FromDate != "" {
		t, err := time.Parse("2006-01-02", query.FromDate)
		if err != nil {
			return nil, sharedErrors.ErrBadRequest
		}
		fromDate = pgtype.Date{Time: t, Valid: true}
	}

	if query.ToDate != "" {
		t, err := time.Parse("2006-01-02", query.ToDate)
		if err != nil {
			return nil, sharedErrors.ErrBadRequest
		}
		toDate = pgtype.Date{Time: t, Valid: true}
	}

	if query.Status != "" {
		statusEnum, err := s.parseStatusEnum(query.Status)
		if err != nil {
			return nil, err
		}
		status = statusEnum
	}

	reservations, err = s.reservationRepo.GetStudentReservationsFiltered(ctx, db.GetStudentReservationsFilteredParams{
		StudentID: utils.UUIDToPgtype(studentID),
		Column2:   fromDate,
		Column3:   toDate,
		Column4:   status,
	})
	if err != nil {
		s.logger.Error("failed to get student reservations", zap.Error(err))
		return nil, err
	}

	// Build response
	response := &dto.MyReservationsResponse{
		Reservations: make([]dto.ReservationResponse, 0, len(reservations)),
		Summary: dto.ReservationSummary{
			Total:     len(reservations),
			Confirmed: 0,
			Pending:   0,
			Used:      0,
			Cancelled: 0,
		},
	}

	for _, r := range reservations {
		response.Reservations = append(response.Reservations, dto.ReservationResponse{
			ID:       r.ID.String(),
			Date:     r.ReservationDate.Time.Format("2006-01-02"),
			MealTime: string(r.MealTime),
			MenuType: string(r.MenuType),
			Cafeteria: &dto.CafeteriaInfo{
				ID:       r.CafeteriaID.String(),
				Name:     r.CafeteriaName,
				Location: r.CafeteriaLocation,
			},
			Status:    string(r.Status),
			IsUsed:    r.IsUsed,
			CreatedAt: r.CreatedAt.Time,
		})

		// Update summary
		switch r.Status {
		case db.ReservationStatusEnumConfirmed:
			response.Summary.Confirmed++
			if r.IsUsed {
				response.Summary.Used++
			}
		case db.ReservationStatusEnumPending:
			response.Summary.Pending++
		case db.ReservationStatusEnumCancelled:
			response.Summary.Cancelled++
		}
	}

	return response, nil
}

// CancelReservation cancels a confirmed reservation and processes refund synchronously
func (s *ReservationService) CancelReservation(ctx context.Context, studentID uuid.UUID, reservationID string) (*dto.CancelReservationResponse, error) {
	// 1. Parse reservation ID
	resID, err := uuid.Parse(reservationID)
	if err != nil {
		return nil, sharedErrors.ErrBadRequest
	}

	// 2. Check if student is active
	student, err := s.studentCacheRepo.GetStudentCacheByID(ctx, studentID)
	if err != nil {
		return nil, err
	}

	if !student.IsActive {
		return nil, serviceErrors.ErrStudentDeactivated
	}

	// 3. Validate reservation window
	if err := s.validateReservationWindow(); err != nil {
		return nil, err
	}

	// 4. Get reservation
	reservation, err := s.reservationRepo.GetReservationByID(ctx, resID)
	if err != nil {
		if errors.Is(err, serviceErrors.ErrReservationNotFoundRepo) {
			return nil, serviceErrors.ErrReservationNotFound
		}
		return nil, err
	}

	// 5. Check ownership
	if utils.PgtypeToUUID(reservation.StudentID) != studentID {
		return nil, serviceErrors.ErrNotOwner
	}

	// 6. Check status (only confirmed can be cancelled)
	if reservation.Status != db.ReservationStatusEnumConfirmed {
		return nil, serviceErrors.ErrInvalidStatusForCancel
	}

	// 7. Check if already used
	if reservation.IsUsed {
		return nil, serviceErrors.ErrReservationAlreadyUsed
	}

	// 8. Request refund synchronously
	refundResp, err := s.paymentClient.RequestRefund(ctx, dto.RefundRequest{
		ReferenceID: resID.String(),
		Amount:      s.cfg.Reservation.MealPriceTRY,
		Currency:    "TRY",
		Reason:      "Student cancelled reservation",
	})
	if err != nil {
		s.logger.Error("refund failed", zap.Error(err), zap.String("reservation_id", reservationID))
		return nil, err
	}

	// 9. Cancel reservation and create outbox event
	eventPayload := map[string]interface{}{
		"reservation_id": reservation.ID.String(),
		"student_id":     student.ID.String(),
		"student_number": student.StudentNumber,
		"date":           reservation.ReservationDate.Time.Format("2006-01-02"),
		"meal_time":      string(reservation.MealTime),
		"refund_amount":  s.cfg.Reservation.MealPriceTRY,
		"currency":       "TRY",
	}

	_, err = s.reservationRepo.CancelReservationWithRefund(ctx, resID, eventPayload)
	if err != nil {
		s.logger.Error("failed to cancel reservation", zap.Error(err))
		return nil, err
	}

	s.logger.Info("reservation cancelled",
		zap.String("reservation_id", reservationID),
		zap.String("student_id", studentID.String()),
	)

	return &dto.CancelReservationResponse{
		ReservationID: reservationID,
		RefundAmount:  s.cfg.Reservation.MealPriceTRY,
		Currency:      "TRY",
		RefundStatus:  refundResp.Status,
	}, nil
}

// UseReservation validates QR and marks reservation as used
func (s *ReservationService) UseReservation(ctx context.Context, studentID uuid.UUID, req dto.UseReservationRequest) (*dto.UseReservationResponse, error) {
	// 1. Parse QR payload
	cafeteriaID, date, mealTime, signature, err := s.parseQRPayload(req.QRPayload)
	if err != nil {
		return nil, serviceErrors.ErrInvalidQR
	}

	// 2. Verify signature
	if !s.verifyQRSignature(cafeteriaID, date, mealTime, signature) {
		return nil, serviceErrors.ErrInvalidQR
	}

	// 3. Validate date (must be today)
	today := time.Now().In(time.FixedZone("UTC+3", 3*3600)).Format("2006-01-02")
	if date != today {
		return nil, serviceErrors.ErrInvalidQRDate
	}

	// 4. Validate time window
	if err := s.validateMealTimeWindow(mealTime); err != nil {
		return nil, err
	}

	// 5. Check if student is active
	student, err := s.studentCacheRepo.GetStudentCacheByID(ctx, studentID)
	if err != nil {
		return nil, err
	}

	if !student.IsActive {
		return nil, serviceErrors.ErrStudentDeactivated
	}

	// 6. Find reservation
	parsedCafeteriaID, _ := uuid.Parse(cafeteriaID)
	parsedDate, _ := time.Parse("2006-01-02", date)
	mealTimeEnum, _ := s.parseMealTimeEnum(mealTime)

	reservation, err := s.reservationRepo.FindReservationForQR(ctx, db.FindReservationForQRParams{
		CafeteriaID:     utils.UUIDToPgtype(parsedCafeteriaID),
		ReservationDate: pgtype.Date{Time: parsedDate, Valid: true},
		MealTime:        mealTimeEnum,
		StudentID: utils.UUIDToPgtype(studentID),
	})
	if err != nil {
		if errors.Is(err, serviceErrors.ErrReservationNotFoundRepo) {
			return nil, serviceErrors.ErrNoReservation
		}
		return nil, err
	}

	// 7. Mark as used
	_, err = s.reservationRepo.MarkReservationUsed(ctx, utils.PgtypeToUUID(reservation.ID))
	if err != nil {
		s.logger.Error("failed to mark reservation as used", zap.Error(err))
		return nil, err
	}

	s.logger.Info("reservation used",
		zap.String("reservation_id", reservation.ID.String()),
		zap.String("student_id", studentID.String()),
		zap.String("cafeteria", reservation.CafeteriaName),
	)

	return &dto.UseReservationResponse{
		Message:       "Reservation validated",
		ReservationID: reservation.ID.String(),
		CafeteriaName: reservation.CafeteriaName,
		MealTime:      mealTime,
		MenuType:      string(reservation.MenuType),
	}, nil
}

// GenerateQR generates QR payload for cafeteria (Admin only)
func (s *ReservationService) GenerateQR(ctx context.Context, cafeteriaID string, date string, mealTime string) (*dto.QRResponse, error) {
	// Parse cafeteria ID
	cID, err := uuid.Parse(cafeteriaID)
	if err != nil {
		return nil, sharedErrors.ErrBadRequest
	}

	// Get cafeteria
	cafeteria, err := s.cafeteriaRepo.GetCafeteriaByID(ctx, cID)
	if err != nil {
		if errors.Is(err, serviceErrors.ErrCafeteriaNotFoundRepo) {
			return nil, serviceErrors.ErrCafeteriaNotFound
		}
		return nil, err
	}

	// Default date to today if not provided
	if date == "" {
		date = time.Now().In(time.FixedZone("UTC+3", 3*3600)).Format("2006-01-02")
	}

	// Generate QR payload
	qrPayload := s.generateQRPayload(cafeteriaID, date, mealTime)

	// Determine time window
	var startHour, endHour int
	if mealTime == "lunch" {
		startHour = s.cfg.MealTime.LunchStartHour
		endHour = s.cfg.MealTime.LunchEndHour
	} else {
		startHour = s.cfg.MealTime.DinnerStartHour
		endHour = s.cfg.MealTime.DinnerEndHour
	}

	return &dto.QRResponse{
		CafeteriaID:   cafeteriaID,
		CafeteriaName: cafeteria.Name,
		Date:          date,
		MealTime:      mealTime,
		QRPayload:     qrPayload,
		ValidTimeWindow: dto.ValidTimeWindow{
			Start: fmt.Sprintf("%02d:00", startHour),
			End:   fmt.Sprintf("%02d:00", endHour),
		},
	}, nil
}

// ============================================================================
// HELPER METHODS
// ============================================================================

func (s *ReservationService) validateReservationWindow() error {
	now := time.Now().In(time.FixedZone("UTC+3", 3*3600))
	weekday := now.Weekday()
	hour := now.Hour()

	// Must be Monday-Friday
	if weekday == time.Saturday || weekday == time.Sunday {
		return serviceErrors.ErrOutsideReservationWindow
	}

	// Monday 08:00 - Friday 13:00
	if weekday == time.Monday && hour < 8 {
		return serviceErrors.ErrOutsideReservationWindow
	}
	if weekday == time.Friday && hour >= 13 {
		return serviceErrors.ErrOutsideReservationWindow
	}

	return nil
}

func (s *ReservationService) validateReservationDate(date time.Time) error {
	// Get next Monday
	now := time.Now().In(time.FixedZone("UTC+3", 3*3600))
	daysUntilMonday := (8 - int(now.Weekday())) % 7
	if daysUntilMonday == 0 {
		daysUntilMonday = 7
	}
	nextMonday := now.AddDate(0, 0, daysUntilMonday)
	nextFriday := nextMonday.AddDate(0, 0, 4)

	// Reset to start of day for comparison
	nextMonday = time.Date(nextMonday.Year(), nextMonday.Month(), nextMonday.Day(), 0, 0, 0, 0, nextMonday.Location())
	nextFriday = time.Date(nextFriday.Year(), nextFriday.Month(), nextFriday.Day(), 23, 59, 59, 0, nextFriday.Location())
	date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())

	if date.Before(nextMonday) || date.After(nextFriday) {
		return serviceErrors.ErrInvalidDateRange
	}

	// Must be Monday-Friday
	weekday := date.Weekday()
	if weekday == time.Saturday || weekday == time.Sunday {
		return serviceErrors.ErrInvalidDateRange
	}

	return nil
}

func (s *ReservationService) validateMealTimeAndMenu(mealTime, menuType string, cafeteria db.Cafeteria) error {
	if mealTime != "lunch" && mealTime != "dinner" {
		return serviceErrors.ErrInvalidMealTime
	}

	if menuType != "normal" && menuType != "vegan" {
		return serviceErrors.ErrInvalidMenuType
	}

	if mealTime == "dinner" && !cafeteria.ServesDinner {
		return serviceErrors.ErrCafeteriaNoDinner
	}

	if menuType == "vegan" && !cafeteria.HasVeganMenu {
		return serviceErrors.ErrCafeteriaNoVegan
	}

	return nil
}

func (s *ReservationService) validateMealTimeWindow(mealTime string) error {
	now := time.Now().In(time.FixedZone("UTC+3", 3*3600))
	hour := now.Hour()

	if mealTime == "lunch" {
		if hour < s.cfg.MealTime.LunchStartHour || hour >= s.cfg.MealTime.LunchEndHour {
			return serviceErrors.ErrOutsideMealTimeWindow
		}
	} else if mealTime == "dinner" {
		if hour < s.cfg.MealTime.DinnerStartHour || hour >= s.cfg.MealTime.DinnerEndHour {
			return serviceErrors.ErrOutsideMealTimeWindow
		}
	}

	return nil
}

func (s *ReservationService) generateQRPayload(cafeteriaID, date, mealTime string) string {
	payload := fmt.Sprintf("%s:%s:%s", cafeteriaID, date, mealTime)
	signature := s.signQRPayload(payload)
	return fmt.Sprintf("%s:%s", payload, signature)
}

func (s *ReservationService) signQRPayload(payload string) string {
	h := hmac.New(sha256.New, []byte(s.cfg.QR.Secret))
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *ReservationService) parseQRPayload(qrPayload string) (cafeteriaID, date, mealTime, signature string, err error) {
	parts := strings.Split(qrPayload, ":")
	if len(parts) != 4 {
		return "", "", "", "", fmt.Errorf("invalid QR format")
	}
	return parts[0], parts[1], parts[2], parts[3], nil
}

func (s *ReservationService) verifyQRSignature(cafeteriaID, date, mealTime, signature string) bool {
	payload := fmt.Sprintf("%s:%s:%s", cafeteriaID, date, mealTime)
	expectedSignature := s.signQRPayload(payload)
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

func (s *ReservationService) parseMealTimeEnum(mealTime string) (db.MealTimeEnum, error) {
	switch mealTime {
	case "lunch":
		return db.MealTimeEnumLunch, nil
	case "dinner":
		return db.MealTimeEnumDinner, nil
	default:
		return "", serviceErrors.ErrInvalidMealTime
	}
}

func (s *ReservationService) parseMenuTypeEnum(menuType string) (db.MenuTypeEnum, error) {
	switch menuType {
	case "normal":
		return db.MenuTypeEnumNormal, nil
	case "vegan":
		return db.MenuTypeEnumVegan, nil
	default:
		return "", serviceErrors.ErrInvalidMenuType
	}
}

func (s *ReservationService) parseStatusEnum(status string) (db.ReservationStatusEnum, error) {
	switch status {
	case "pending":
		return db.ReservationStatusEnumPending, nil
	case "confirmed":
		return db.ReservationStatusEnumConfirmed, nil
	case "cancelled":
		return db.ReservationStatusEnumCancelled, nil
	case "expired":
		return db.ReservationStatusEnumExpired, nil
	default:
		return "", sharedErrors.ErrBadRequest
	}
}

func (s *ReservationService) getErrorCode(err error) string {
	switch {
	case errors.Is(err, serviceErrors.ErrCafeteriaNoDinner):
		return "CAFETERIA_NO_DINNER"
	case errors.Is(err, serviceErrors.ErrCafeteriaNoVegan):
		return "CAFETERIA_NO_VEGAN"
	case errors.Is(err, serviceErrors.ErrInvalidMealTime):
		return "INVALID_MEAL_TIME"
	case errors.Is(err, serviceErrors.ErrInvalidMenuType):
		return "INVALID_MENU_TYPE"
	default:
		return "VALIDATION_ERROR"
	}
}
