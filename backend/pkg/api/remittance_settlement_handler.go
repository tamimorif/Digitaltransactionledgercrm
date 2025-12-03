package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

type RemittanceSettlementHandler struct {
	SettlementService *services.RemittanceSettlementService
}

func NewRemittanceSettlementHandler(db *gorm.DB) *RemittanceSettlementHandler {
	return &RemittanceSettlementHandler{
		SettlementService: services.NewRemittanceSettlementService(db),
	}
}

// CreateSettlementHandler creates a new settlement
// POST /remittances/settlements
func (h *RemittanceSettlementHandler) CreateSettlementHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	userVal := r.Context().Value("user")
	if userVal == nil {
		http.Error(w, "User ID required", http.StatusUnauthorized)
		return
	}
	user := userVal.(*models.User)

	var req struct {
		OutgoingRemittanceID uint    `json:"outgoingRemittanceId"`
		IncomingRemittanceID uint    `json:"incomingRemittanceId"`
		SettlementAmount     float64 `json:"settlementAmount"`
		Notes                string  `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.OutgoingRemittanceID == 0 || req.IncomingRemittanceID == 0 {
		http.Error(w, "Outgoing and incoming remittance IDs are required", http.StatusBadRequest)
		return
	}

	if req.SettlementAmount <= 0 {
		http.Error(w, "Settlement amount must be greater than zero", http.StatusBadRequest)
		return
	}

	settlement, err := h.SettlementService.CreateSettlement(
		*tenantID,
		req.OutgoingRemittanceID,
		req.IncomingRemittanceID,
		req.SettlementAmount,
		req.Notes,
		user.ID,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusCreated, settlement)
}

// GetSettlementHistoryHandler retrieves settlement history for a remittance
// GET /remittances/:id/settlements
func (h *RemittanceSettlementHandler) GetSettlementHistoryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid remittance ID", http.StatusBadRequest)
		return
	}

	settlements, err := h.SettlementService.GetSettlementHistory(*tenantID, uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, settlements)
}

// GetSettlementSummaryHandler retrieves settlement summary for a remittance
// GET /remittances/:id/settlement-summary
func (h *RemittanceSettlementHandler) GetSettlementSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid remittance ID", http.StatusBadRequest)
		return
	}

	summary, err := h.SettlementService.GetSettlementSummary(*tenantID, uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, summary)
}

// GetUnsettledRemittancesHandler retrieves unsettled remittances
// GET /remittances/unsettled?type=outgoing
func (h *RemittanceSettlementHandler) GetUnsettledRemittancesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	remittanceType := r.URL.Query().Get("type")
	if remittanceType == "" {
		remittanceType = "outgoing"
	}

	remittances, err := h.SettlementService.GetUnsettledRemittances(*tenantID, remittanceType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, remittances)
}
