package api

import (
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// CreateOutgoingRemittanceRequest represents the request to create outgoing remittance
type CreateOutgoingRemittanceRequest struct {
	SenderName       string  `json:"senderName"`
	SenderPhone      string  `json:"senderPhone"`
	SenderEmail      *string `json:"senderEmail"`
	RecipientName    string  `json:"recipientName"`
	RecipientPhone   *string `json:"recipientPhone"`
	RecipientIBAN    *string `json:"recipientIban"`
	RecipientBank    *string `json:"recipientBank"`
	RecipientAddress *string `json:"recipientAddress"`
	AmountIRR        float64 `json:"amountIrr"`
	BuyRateCAD       float64 `json:"buyRateCad"`
	ReceivedCAD      float64 `json:"receivedCad"`
	FeeCAD           float64 `json:"feeCAD"`
	Notes            *string `json:"notes"`
	InternalNotes    *string `json:"internalNotes"`
}

// CreateIncomingRemittanceRequest represents the request to create incoming remittance
type CreateIncomingRemittanceRequest struct {
	SenderName       string  `json:"senderName"`
	SenderPhone      string  `json:"senderPhone"`
	SenderIBAN       *string `json:"senderIban"`
	SenderBank       *string `json:"senderBank"`
	RecipientName    string  `json:"recipientName"`
	RecipientPhone   *string `json:"recipientPhone"`
	RecipientEmail   *string `json:"recipientEmail"`
	RecipientAddress *string `json:"recipientAddress"`
	AmountIRR        float64 `json:"amountIrr"`
	SellRateCAD      float64 `json:"sellRateCad"`
	FeeCAD           float64 `json:"feeCAD"`
	Notes            *string `json:"notes"`
	InternalNotes    *string `json:"internalNotes"`
}

// SettleRemittanceRequest represents the request to create a settlement
type SettleRemittanceRequest struct {
	OutgoingRemittanceID uint    `json:"outgoingRemittanceId"`
	IncomingRemittanceID uint    `json:"incomingRemittanceId"`
	AmountIRR            float64 `json:"amountIrr"`
	Notes                *string `json:"notes"`
}

// MarkAsPaidRequest represents the request to mark incoming as paid
type MarkAsPaidRequest struct {
	PaymentMethod    string  `json:"paymentMethod"`
	PaymentReference *string `json:"paymentReference"`
}

// CancelRemittanceRequest represents the request to cancel a remittance
type CancelRemittanceRequest struct {
	Reason string `json:"reason"`
}

// @Summary Create outgoing remittance (Canada to Iran)
// @Description Create a new outgoing remittance that creates debt for the exchange
// @Tags Remittances
// @Accept json
// @Produce json
// @Param remittance body CreateOutgoingRemittanceRequest true "Outgoing Remittance Data"
// @Success 201 {object} models.OutgoingRemittance
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/outgoing [post]
func (h *Handler) CreateOutgoingRemittance(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	var req CreateOutgoingRemittanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.SenderName == "" || req.SenderPhone == "" {
		respondWithError(w, http.StatusBadRequest, "Sender name and phone are required")
		return
	}

	if req.RecipientName == "" {
		respondWithError(w, http.StatusBadRequest, "Recipient name is required")
		return
	}

	if req.AmountIRR <= 0 || req.BuyRateCAD <= 0 {
		respondWithError(w, http.StatusBadRequest, "Amount and buy rate must be greater than 0")
		return
	}

	remittance := &models.OutgoingRemittance{
		TenantID:         *user.TenantID,
		BranchID:         user.PrimaryBranchID,
		SenderName:       req.SenderName,
		SenderPhone:      req.SenderPhone,
		SenderEmail:      req.SenderEmail,
		RecipientName:    req.RecipientName,
		RecipientPhone:   req.RecipientPhone,
		RecipientIBAN:    req.RecipientIBAN,
		RecipientBank:    req.RecipientBank,
		RecipientAddress: req.RecipientAddress,
		AmountIRR:        req.AmountIRR,
		BuyRateCAD:       req.BuyRateCAD,
		ReceivedCAD:      req.ReceivedCAD,
		FeeCAD:           req.FeeCAD,
		Notes:            req.Notes,
		InternalNotes:    req.InternalNotes,
		CreatedBy:        user.ID,
	}

	remittanceService := services.NewRemittanceService(h.db)
	if err := remittanceService.CreateOutgoingRemittance(remittance); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, remittance)
}

// @Summary Create incoming remittance (Iran to Canada)
// @Description Create a new incoming remittance that can settle debt
// @Tags Remittances
// @Accept json
// @Produce json
// @Param remittance body CreateIncomingRemittanceRequest true "Incoming Remittance Data"
// @Success 201 {object} models.IncomingRemittance
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/incoming [post]
func (h *Handler) CreateIncomingRemittance(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	var req CreateIncomingRemittanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.SenderName == "" || req.SenderPhone == "" {
		respondWithError(w, http.StatusBadRequest, "Sender name and phone are required")
		return
	}

	if req.RecipientName == "" {
		respondWithError(w, http.StatusBadRequest, "Recipient name is required")
		return
	}

	if req.AmountIRR <= 0 || req.SellRateCAD <= 0 {
		respondWithError(w, http.StatusBadRequest, "Amount and sell rate must be greater than 0")
		return
	}

	remittance := &models.IncomingRemittance{
		TenantID:         *user.TenantID,
		BranchID:         user.PrimaryBranchID,
		SenderName:       req.SenderName,
		SenderPhone:      req.SenderPhone,
		SenderIBAN:       req.SenderIBAN,
		SenderBank:       req.SenderBank,
		RecipientName:    req.RecipientName,
		RecipientPhone:   req.RecipientPhone,
		RecipientEmail:   req.RecipientEmail,
		RecipientAddress: req.RecipientAddress,
		AmountIRR:        req.AmountIRR,
		SellRateCAD:      req.SellRateCAD,
		FeeCAD:           req.FeeCAD,
		Notes:            req.Notes,
		InternalNotes:    req.InternalNotes,
		CreatedBy:        user.ID,
	}

	remittanceService := services.NewRemittanceService(h.db)
	if err := remittanceService.CreateIncomingRemittance(remittance); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, remittance)
}

// @Summary Settle remittance
// @Description Create a settlement linking incoming to outgoing remittance
// @Tags Remittances
// @Accept json
// @Produce json
// @Param settlement body SettleRemittanceRequest true "Settlement Data"
// @Success 201 {object} models.RemittanceSettlement
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/settle [post]
func (h *Handler) SettleRemittance(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	var req SettleRemittanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.AmountIRR <= 0 {
		respondWithError(w, http.StatusBadRequest, "Settlement amount must be greater than 0")
		return
	}

	remittanceService := services.NewRemittanceService(h.db)
	settlement, err := remittanceService.SettleRemittance(
		*user.TenantID,
		req.OutgoingRemittanceID,
		req.IncomingRemittanceID,
		req.AmountIRR,
		user.ID,
	)

	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Notes != nil {
		settlement.Notes = req.Notes
		h.db.Save(settlement)
	}

	respondWithJSON(w, http.StatusCreated, settlement)
}

// @Summary Get outgoing remittances
// @Description Get list of outgoing remittances with optional filters
// @Tags Remittances
// @Accept json
// @Produce json
// @Param status query string false "Status filter"
// @Param branchId query int false "Branch ID filter"
// @Success 200 {array} models.OutgoingRemittance
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/outgoing [get]
func (h *Handler) GetOutgoingRemittances(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	status := r.URL.Query().Get("status")
	branchIDStr := r.URL.Query().Get("branchId")

	var branchID *uint
	if branchIDStr != "" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	remittanceService := services.NewRemittanceService(h.db)
	remittances, err := remittanceService.GetOutgoingRemittances(*user.TenantID, status, branchID)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, remittances)
}

// @Summary Get incoming remittances
// @Description Get list of incoming remittances with optional filters
// @Tags Remittances
// @Accept json
// @Produce json
// @Param status query string false "Status filter"
// @Param branchId query int false "Branch ID filter"
// @Success 200 {array} models.IncomingRemittance
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/incoming [get]
func (h *Handler) GetIncomingRemittances(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	status := r.URL.Query().Get("status")
	branchIDStr := r.URL.Query().Get("branchId")

	var branchID *uint
	if branchIDStr != "" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	remittanceService := services.NewRemittanceService(h.db)
	remittances, err := remittanceService.GetIncomingRemittances(*user.TenantID, status, branchID)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, remittances)
}

// @Summary Get outgoing remittance details
// @Description Get detailed information about a specific outgoing remittance
// @Tags Remittances
// @Accept json
// @Produce json
// @Param id path int true "Remittance ID"
// @Success 200 {object} models.OutgoingRemittance
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/outgoing/{id} [get]
func (h *Handler) GetOutgoingRemittanceDetails(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	vars := mux.Vars(r)

	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid remittance ID")
		return
	}

	remittanceService := services.NewRemittanceService(h.db)
	remittance, err := remittanceService.GetOutgoingRemittanceDetails(*user.TenantID, uint(id))

	if err != nil {
		respondWithError(w, http.StatusNotFound, "Remittance not found")
		return
	}

	respondWithJSON(w, http.StatusOK, remittance)
}

// @Summary Get incoming remittance details
// @Description Get detailed information about a specific incoming remittance
// @Tags Remittances
// @Accept json
// @Produce json
// @Param id path int true "Remittance ID"
// @Success 200 {object} models.IncomingRemittance
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/incoming/{id} [get]
func (h *Handler) GetIncomingRemittanceDetails(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	vars := mux.Vars(r)

	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid remittance ID")
		return
	}

	remittanceService := services.NewRemittanceService(h.db)
	remittance, err := remittanceService.GetIncomingRemittanceDetails(*user.TenantID, uint(id))

	if err != nil {
		respondWithError(w, http.StatusNotFound, "Remittance not found")
		return
	}

	respondWithJSON(w, http.StatusOK, remittance)
}

// @Summary Mark incoming as paid
// @Description Mark an incoming remittance as paid to recipient
// @Tags Remittances
// @Accept json
// @Produce json
// @Param id path int true "Remittance ID"
// @Param payment body MarkAsPaidRequest true "Payment Data"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/incoming/{id}/mark-paid [post]
func (h *Handler) MarkIncomingAsPaid(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	vars := mux.Vars(r)

	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid remittance ID")
		return
	}

	var req MarkAsPaidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	paymentRef := ""
	if req.PaymentReference != nil {
		paymentRef = *req.PaymentReference
	}

	remittanceService := services.NewRemittanceService(h.db)
	if err := remittanceService.MarkIncomingAsPaid(*user.TenantID, uint(id), user.ID, req.PaymentMethod, paymentRef); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Remittance marked as paid successfully"})
}

// @Summary Cancel outgoing remittance
// @Description Cancel an outgoing remittance
// @Tags Remittances
// @Accept json
// @Produce json
// @Param id path int true "Remittance ID"
// @Param cancellation body CancelRemittanceRequest true "Cancellation Data"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/outgoing/{id}/cancel [post]
func (h *Handler) CancelOutgoingRemittance(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	vars := mux.Vars(r)

	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid remittance ID")
		return
	}

	var req CancelRemittanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	remittanceService := services.NewRemittanceService(h.db)
	if err := remittanceService.CancelOutgoingRemittance(*user.TenantID, uint(id), user.ID, req.Reason); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Remittance cancelled successfully"})
}

// @Summary Cancel incoming remittance
// @Description Cancel an incoming remittance
// @Tags Remittances
// @Accept json
// @Produce json
// @Param id path int true "Remittance ID"
// @Param cancellation body CancelRemittanceRequest true "Cancellation Data"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/incoming/{id}/cancel [post]
func (h *Handler) CancelIncomingRemittance(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	vars := mux.Vars(r)

	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid remittance ID")
		return
	}

	var req CancelRemittanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	remittanceService := services.NewRemittanceService(h.db)
	if err := remittanceService.CancelIncomingRemittance(*user.TenantID, uint(id), user.ID, req.Reason); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Remittance cancelled successfully"})
}

// @Summary Get profit summary
// @Description Get remittance profit summary for a tenant
// @Tags Remittances
// @Accept json
// @Produce json
// @Param startDate query string false "Start date (RFC3339)"
// @Param endDate query string false "End date (RFC3339)"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} ErrorResponse
// @Security BearerAuth
// @Router /remittances/profit-summary [get]
func (h *Handler) GetRemittanceProfitSummary(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	var startDate, endDate *time.Time

	if startStr := r.URL.Query().Get("startDate"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startDate = &t
		}
	}

	if endStr := r.URL.Query().Get("endDate"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endDate = &t
		}
	}

	remittanceService := services.NewRemittanceService(h.db)
	summary, err := remittanceService.GetRemittanceProfitSummary(*user.TenantID, startDate, endDate)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, summary)
}
