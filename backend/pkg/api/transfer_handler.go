package api

import (
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type TransferHandler struct {
	transferService *services.TransferService
}

func NewTransferHandler(transferService *services.TransferService) *TransferHandler {
	return &TransferHandler{transferService: transferService}
}

// CreateTransferRequest defines the request body for creating a transfer
type CreateTransferRequest struct {
	SourceBranchID      uint    `json:"sourceBranchId"`
	DestinationBranchID uint    `json:"destinationBranchId"`
	Amount              float64 `json:"amount"`
	Currency            string  `json:"currency"`
	Description         string  `json:"description"`
}

// CreateTransferHandler handles creating a new transfer
// @Summary Create a new transfer
// @Description Create a new transfer between branches
// @Tags Transfers
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateTransferRequest true "Transfer details"
// @Success 200 {object} models.Transfer
// @Router /transfers [post]
func (h *TransferHandler) CreateTransferHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	userID := r.Context().Value("userID").(uint)

	var req CreateTransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	transfer, err := h.transferService.CreateTransfer(
		tenantID,
		req.SourceBranchID,
		req.DestinationBranchID,
		req.Amount,
		req.Currency,
		req.Description,
		userID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transfer)
}

// AcceptTransferHandler handles accepting a transfer
// @Summary Accept a transfer
// @Description Accept a pending transfer
// @Tags Transfers
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Transfer ID"
// @Success 200 {object} models.Transfer
// @Router /transfers/{id}/accept [post]
func (h *TransferHandler) AcceptTransferHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	userID := r.Context().Value("userID").(uint)

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid transfer ID", http.StatusBadRequest)
		return
	}

	transfer, err := h.transferService.AcceptTransfer(uint(id), tenantID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transfer)
}

// CancelTransferHandler handles cancelling a transfer
// @Summary Cancel a transfer
// @Description Cancel a pending transfer
// @Tags Transfers
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Transfer ID"
// @Success 200 {object} models.Transfer
// @Router /transfers/{id}/cancel [post]
func (h *TransferHandler) CancelTransferHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	userID := r.Context().Value("userID").(uint)

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid transfer ID", http.StatusBadRequest)
		return
	}

	transfer, err := h.transferService.CancelTransfer(uint(id), tenantID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transfer)
}

// GetTransfersHandler handles retrieving transfers
// @Summary Get transfers
// @Description Get transfers with optional filtering
// @Tags Transfers
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param branchId query int false "Branch ID"
// @Param status query string false "Status"
// @Success 200 {array} models.Transfer
// @Router /transfers [get]
func (h *TransferHandler) GetTransfersHandler(w http.ResponseWriter, r *http.Request) {
	tenantIDVal := r.Context().Value("tenantID")
	if tenantIDVal == nil {
		http.Error(w, "Unauthorized: No tenant ID found", http.StatusUnauthorized)
		return
	}
	tenantID := tenantIDVal.(uint)

	var branchID *uint
	if branchIDStr := r.URL.Query().Get("branchId"); branchIDStr != "" {
		if id, err := strconv.Atoi(branchIDStr); err == nil {
			uid := uint(id)
			branchID = &uid
		}
	}

	status := r.URL.Query().Get("status")

	transfers, err := h.transferService.GetTransfers(tenantID, branchID, status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transfers)
}
