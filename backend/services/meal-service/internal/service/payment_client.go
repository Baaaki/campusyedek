package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/baaaki/mydreamcampus/meal-service/internal/dto"
	serviceErrors "github.com/baaaki/mydreamcampus/meal-service/internal/errors"
	"go.uber.org/zap"
)

type PaymentClient struct {
	baseURL    string
	httpClient *http.Client
	logger     *zap.Logger
}

func NewPaymentClient(baseURL string, logger *zap.Logger) *PaymentClient {
	return &PaymentClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger,
	}
}

// InitiatePayment initiates payment for reservation(s)
func (c *PaymentClient) InitiatePayment(ctx context.Context, req dto.InitiatePaymentRequest) (*dto.InitiatePaymentResponse, error) {
	url := fmt.Sprintf("%s/api/v1/payments/initiate", c.baseURL)

	payload, err := json.Marshal(req)
	if err != nil {
		c.logger.Error("failed to marshal payment request", zap.Error(err))
		return nil, fmt.Errorf("%w: failed to marshal request", serviceErrors.ErrPaymentServiceError)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		c.logger.Error("failed to create payment request", zap.Error(err))
		return nil, fmt.Errorf("%w: failed to create request", serviceErrors.ErrPaymentServiceError)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		c.logger.Error("failed to call payment service", zap.Error(err), zap.String("url", url))
		return nil, fmt.Errorf("%w: failed to call payment service", serviceErrors.ErrPaymentServiceError)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.logger.Error("failed to read payment response", zap.Error(err))
		return nil, fmt.Errorf("%w: failed to read response", serviceErrors.ErrPaymentServiceError)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		c.logger.Error("payment service returned error",
			zap.Int("status_code", resp.StatusCode),
			zap.String("response", string(body)),
		)
		return nil, fmt.Errorf("%w: payment service returned status %d", serviceErrors.ErrPaymentServiceError, resp.StatusCode)
	}

	var paymentResp dto.InitiatePaymentResponse
	if err := json.Unmarshal(body, &paymentResp); err != nil {
		c.logger.Error("failed to unmarshal payment response", zap.Error(err), zap.String("body", string(body)))
		return nil, fmt.Errorf("%w: failed to parse response", serviceErrors.ErrPaymentServiceError)
	}

	return &paymentResp, nil
}

// RequestRefund requests refund for a cancelled reservation
func (c *PaymentClient) RequestRefund(ctx context.Context, req dto.RefundRequest) (*dto.RefundResponse, error) {
	url := fmt.Sprintf("%s/api/v1/payments/refund", c.baseURL)

	payload, err := json.Marshal(req)
	if err != nil {
		c.logger.Error("failed to marshal refund request", zap.Error(err))
		return nil, fmt.Errorf("%w: failed to marshal request", serviceErrors.ErrRefundFailed)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		c.logger.Error("failed to create refund request", zap.Error(err))
		return nil, fmt.Errorf("%w: failed to create request", serviceErrors.ErrRefundFailed)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		c.logger.Error("failed to call payment service for refund", zap.Error(err), zap.String("url", url))
		return nil, fmt.Errorf("%w: failed to call payment service", serviceErrors.ErrRefundFailed)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.logger.Error("failed to read refund response", zap.Error(err))
		return nil, fmt.Errorf("%w: failed to read response", serviceErrors.ErrRefundFailed)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		c.logger.Error("payment service refund failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("response", string(body)),
		)
		return nil, fmt.Errorf("%w: refund failed with status %d", serviceErrors.ErrRefundFailed, resp.StatusCode)
	}

	var refundResp dto.RefundResponse
	if err := json.Unmarshal(body, &refundResp); err != nil {
		c.logger.Error("failed to unmarshal refund response", zap.Error(err), zap.String("body", string(body)))
		return nil, fmt.Errorf("%w: failed to parse response", serviceErrors.ErrRefundFailed)
	}

	// Check if refund was successful
	if refundResp.Status != "completed" {
		c.logger.Error("refund not completed", zap.String("status", refundResp.Status), zap.String("message", refundResp.Message))
		return nil, fmt.Errorf("%w: %s", serviceErrors.ErrRefundFailed, refundResp.Message)
	}

	return &refundResp, nil
}
