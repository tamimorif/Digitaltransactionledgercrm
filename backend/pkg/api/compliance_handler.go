package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// ComplianceHandler handles compliance-related API endpoints
type ComplianceHandler struct {
	complianceService    *services.ComplianceService
	verificationProvider services.VerificationProvider
	db                   *gorm.DB
	uploadDir            string
}

// NewComplianceHandler creates a new compliance handler
func NewComplianceHandler(db *gorm.DB) *ComplianceHandler {
	// Use Sumsub if configured, otherwise mock
	var provider services.VerificationProvider
	sumsub := services.NewSumsubProvider()
	if sumsub.IsConfigured() {
		provider = sumsub
	} else {
		provider = services.NewMockVerificationProvider()
	}

	uploadDir := os.Getenv("COMPLIANCE_UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads/compliance"
	}

	// Ensure upload directory exists
	os.MkdirAll(uploadDir, 0755)

	return &ComplianceHandler{
		complianceService:    services.NewComplianceService(db),
		verificationProvider: provider,
		db:                   db,
		uploadDir:            uploadDir,
	}
}

// GetCustomerComplianceHandler retrieves compliance status for a customer
// @Summary Get customer compliance status
// @Tags Compliance
// @Accept json
// @Produce json
// @Param customerId path int true "Customer ID"
// @Success 200 {object} models.CustomerCompliance
// @Router /compliance/customer/{customerId} [get]
func (h *ComplianceHandler) GetCustomerComplianceHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	vars := mux.Vars(r)
	customerIDStr := vars["customerId"]
	customerID, err := strconv.ParseUint(customerIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid customer ID", http.StatusBadRequest)
		return
	}

	compliance, err := h.complianceService.GetOrCreateCompliance(*tenantID, uint(customerID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(compliance)
}

// CheckTransactionComplianceHandler checks if a transaction is compliant
// @Summary Check transaction compliance
// @Tags Compliance
// @Accept json
// @Produce json
// @Success 200 {object} services.ComplianceCheckResult
// @Router /compliance/check [post]
func (h *ComplianceHandler) CheckTransactionComplianceHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		CustomerID uint    `json:"customerId"`
		Amount     float64 `json:"amount"`
		Currency   string  `json:"currency"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.complianceService.CheckTransactionCompliance(*tenantID, req.CustomerID, req.Amount, req.Currency)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// UpdateComplianceStatusHandler updates compliance status
// @Summary Update compliance status
// @Tags Compliance
// @Accept json
// @Produce json
// @Router /compliance/{id}/status [put]
func (h *ComplianceHandler) UpdateComplianceStatusHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID
	vars := mux.Vars(r)
	complianceIDStr := vars["id"]
	complianceID, err := strconv.ParseUint(complianceIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid compliance ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	status := models.ComplianceStatus(req.Status)
	if err := h.complianceService.UpdateComplianceStatus(uint(complianceID), status, &userID, req.Reason); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Status updated successfully"})
}

// UploadDocumentHandler handles document uploads
// @Summary Upload compliance document
// @Tags Compliance
// @Accept multipart/form-data
// @Produce json
// @Router /compliance/{id}/documents [post]
func (h *ComplianceHandler) UploadDocumentHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	vars := mux.Vars(r)
	complianceIDStr := vars["id"]
	complianceID, err := strconv.ParseUint(complianceIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid compliance ID", http.StatusBadRequest)
		return
	}

	// Parse multipart form (max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "File too large or invalid form", http.StatusBadRequest)
		return
	}

	docType := r.FormValue("documentType")
	if docType == "" {
		http.Error(w, "Document type is required", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "File is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file type
	allowedTypes := map[string]bool{
		"image/jpeg":      true,
		"image/png":       true,
		"image/gif":       true,
		"application/pdf": true,
	}
	contentType := header.Header.Get("Content-Type")
	if !allowedTypes[contentType] {
		http.Error(w, "Invalid file type. Allowed: JPEG, PNG, GIF, PDF", http.StatusBadRequest)
		return
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%d_%d_%s_%d%s", *tenantID, complianceID, docType, time.Now().UnixNano(), ext)
	filePath := filepath.Join(h.uploadDir, filename)

	// Create destination file
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy file
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Record in database
	doc, err := h.complianceService.UploadDocument(
		uint(complianceID),
		*tenantID,
		docType,
		header.Filename,
		filePath,
		header.Size,
		contentType,
	)
	if err != nil {
		// Clean up file on error
		os.Remove(filePath)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

// GetDocumentsHandler retrieves documents for a compliance record
// @Summary Get compliance documents
// @Tags Compliance
// @Produce json
// @Router /compliance/{id}/documents [get]
func (h *ComplianceHandler) GetDocumentsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	vars := mux.Vars(r)
	complianceIDStr := vars["id"]
	complianceID, err := strconv.ParseUint(complianceIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid compliance ID", http.StatusBadRequest)
		return
	}

	var docs []models.ComplianceDocument
	if err := h.db.Where("customer_compliance_id = ? AND tenant_id = ?", complianceID, *tenantID).Find(&docs).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(docs)
}

// ReviewDocumentHandler reviews an uploaded document
// @Summary Review compliance document
// @Tags Compliance
// @Accept json
// @Produce json
// @Router /compliance/documents/{docId}/review [put]
func (h *ComplianceHandler) ReviewDocumentHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID
	vars := mux.Vars(r)
	docIDStr := vars["docId"]
	docID, err := strconv.ParseUint(docIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid document ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Approved bool   `json:"approved"`
		Notes    string `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.complianceService.ReviewDocument(uint(docID), req.Approved, req.Notes, &userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Document reviewed successfully"})
}

// SetTransactionLimitsHandler sets transaction limits for a customer
// @Summary Set transaction limits
// @Tags Compliance
// @Accept json
// @Produce json
// @Router /compliance/{id}/limits [put]
func (h *ComplianceHandler) SetTransactionLimitsHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID
	vars := mux.Vars(r)
	complianceIDStr := vars["id"]
	complianceID, err := strconv.ParseUint(complianceIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid compliance ID", http.StatusBadRequest)
		return
	}

	var req struct {
		DailyLimit          float64 `json:"dailyLimit"`
		MonthlyLimit        float64 `json:"monthlyLimit"`
		PerTransactionLimit float64 `json:"perTransactionLimit"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.complianceService.SetTransactionLimits(
		uint(complianceID),
		req.DailyLimit,
		req.MonthlyLimit,
		req.PerTransactionLimit,
		&userID,
	); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Limits updated successfully"})
}

// GetPendingReviewsHandler retrieves compliance records pending review
// @Summary Get pending compliance reviews
// @Tags Compliance
// @Produce json
// @Router /compliance/pending [get]
func (h *ComplianceHandler) GetPendingReviewsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	records, err := h.complianceService.GetPendingReviews(*tenantID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(records)
}

// GetExpiringComplianceHandler retrieves expiring compliance records
// @Summary Get expiring compliance records
// @Tags Compliance
// @Produce json
// @Router /compliance/expiring [get]
func (h *ComplianceHandler) GetExpiringComplianceHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	days := 30
	if daysStr := r.URL.Query().Get("days"); daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
			days = d
		}
	}

	records, err := h.complianceService.GetExpiringCompliance(*tenantID, days)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(records)
}

// GetAuditLogHandler retrieves compliance audit log
// @Summary Get compliance audit log
// @Tags Compliance
// @Produce json
// @Router /compliance/{id}/audit [get]
func (h *ComplianceHandler) GetAuditLogHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	complianceIDStr := vars["id"]
	complianceID, err := strconv.ParseUint(complianceIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid compliance ID", http.StatusBadRequest)
		return
	}

	limit := 100
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	logs, err := h.complianceService.GetAuditLog(uint(complianceID), limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// InitiateVerificationHandler initiates external verification
// @Summary Initiate external KYC verification
// @Tags Compliance
// @Accept json
// @Produce json
// @Router /compliance/{id}/verify [post]
func (h *ComplianceHandler) InitiateVerificationHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	vars := mux.Vars(r)
	complianceIDStr := vars["id"]
	complianceID, err := strconv.ParseUint(complianceIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid compliance ID", http.StatusBadRequest)
		return
	}

	// Get compliance record
	var compliance models.CustomerCompliance
	if err := h.db.Preload("Customer").First(&compliance, complianceID).Error; err != nil {
		http.Error(w, "Compliance record not found", http.StatusNotFound)
		return
	}

	if compliance.TenantID != *tenantID {
		http.Error(w, "Not authorized", http.StatusForbidden)
		return
	}

	// Create applicant in external provider
	request := &services.CreateApplicantRequest{
		ExternalUserID: fmt.Sprintf("%d-%d", *tenantID, compliance.CustomerID),
		Country:        compliance.Country,
	}

	applicant, err := h.verificationProvider.CreateApplicant(request)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create applicant: %v", err), http.StatusInternalServerError)
		return
	}

	// Update compliance record with external provider ID
	h.db.Model(&compliance).Update("external_provider_id", applicant.ID)

	// Generate access token for frontend SDK
	token, err := h.verificationProvider.GenerateAccessToken(applicant.ID, "basic-kyc-level")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate token: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"applicantId": applicant.ID,
		"token":       token.Token,
		"expiresAt":   token.ExpiresAt,
	})
}

// GetVerificationStatusHandler retrieves external verification status
// @Summary Get external verification status
// @Tags Compliance
// @Produce json
// @Router /compliance/{id}/verify/status [get]
func (h *ComplianceHandler) GetVerificationStatusHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	vars := mux.Vars(r)
	complianceIDStr := vars["id"]
	complianceID, err := strconv.ParseUint(complianceIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid compliance ID", http.StatusBadRequest)
		return
	}

	var compliance models.CustomerCompliance
	if err := h.db.First(&compliance, complianceID).Error; err != nil {
		http.Error(w, "Compliance record not found", http.StatusNotFound)
		return
	}

	if compliance.TenantID != *tenantID {
		http.Error(w, "Not authorized", http.StatusForbidden)
		return
	}

	if compliance.ExternalProviderID == "" {
		http.Error(w, "No external verification initiated", http.StatusBadRequest)
		return
	}

	status, err := h.verificationProvider.GetApplicantStatus(compliance.ExternalProviderID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get status: %v", err), http.StatusInternalServerError)
		return
	}

	// Update local status based on external status
	if status.ReviewStatus == "completed" {
		newStatus := models.ComplianceStatusApproved
		if status.ReviewAnswer == "RED" {
			newStatus = models.ComplianceStatusRejected
		}
		h.complianceService.UpdateComplianceStatus(uint(complianceID), newStatus, nil, "")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}
