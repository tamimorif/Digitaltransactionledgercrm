package api

import (
	"api/pkg/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// BatchPaymentHandler handles batch payment API endpoints
type BatchPaymentHandler struct {
	batchPaymentService *services.BatchPaymentService
}

// NewBatchPaymentHandler creates a new BatchPaymentHandler
func NewBatchPaymentHandler(batchPaymentService *services.BatchPaymentService) *BatchPaymentHandler {
	return &BatchPaymentHandler{
		batchPaymentService: batchPaymentService,
	}
}

// PreviewBatchPayment calculates and returns how a payment would be allocated
// POST /api/payments/batch/preview
func (h *BatchPaymentHandler) PreviewBatchPayment(c *gin.Context) {
	tenantID := c.GetUint("tenantId")
	if tenantID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var request services.BatchPaymentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate request
	if len(request.TransactionIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one transaction is required"})
		return
	}
	if request.TotalAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Total amount must be positive"})
		return
	}

	// Default strategy to FIFO
	if request.Strategy == "" {
		request.Strategy = "FIFO"
	}

	preview, err := h.batchPaymentService.PreviewBatchPayment(tenantID, request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, preview)
}

// ProcessBatchPayment processes a batch payment
// POST /api/payments/batch
func (h *BatchPaymentHandler) ProcessBatchPayment(c *gin.Context) {
	tenantID := c.GetUint("tenantId")
	userID := c.GetUint("userId")
	if tenantID == 0 || userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var request services.BatchPaymentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate request
	if len(request.TransactionIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one transaction is required"})
		return
	}
	if request.TotalAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Total amount must be positive"})
		return
	}
	if request.PaymentMethod == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payment method is required"})
		return
	}

	// Default strategy to FIFO
	if request.Strategy == "" {
		request.Strategy = "FIFO"
	}

	result, err := h.batchPaymentService.ProcessBatchPayment(tenantID, userID, request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetPendingTransactions returns all transactions eligible for batch payment
// GET /api/payments/batch/pending
func (h *BatchPaymentHandler) GetPendingTransactions(c *gin.Context) {
	tenantID := c.GetUint("tenantId")
	if tenantID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	transactions, err := h.batchPaymentService.GetPendingTransactions(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"transactions": transactions})
}
