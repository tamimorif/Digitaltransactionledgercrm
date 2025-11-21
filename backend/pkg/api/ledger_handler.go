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

type LedgerHandler struct {
	ledgerService *services.LedgerService
	db            *gorm.DB
}

func NewLedgerHandler(db *gorm.DB) *LedgerHandler {
	return &LedgerHandler{
		ledgerService: services.NewLedgerService(db),
		db:            db,
	}
}

// GetClientBalances returns the current multi-currency balance for a client
func (h *LedgerHandler) GetClientBalances(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientID := vars["id"]
	tenantID := middleware.GetTenantID(r)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	balances, err := h.ledgerService.GetClientBalances(clientID, *tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, balances)
}

// GetClientEntries returns the ledger history for a client
func (h *LedgerHandler) GetClientEntries(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientID := vars["id"]
	tenantID := middleware.GetTenantID(r)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	limit := 50
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if val, err := strconv.Atoi(l); err == nil {
			limit = val
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if val, err := strconv.Atoi(o); err == nil {
			offset = val
		}
	}

	entries, err := h.ledgerService.GetEntries(clientID, *tenantID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, entries)
}

// AddEntry creates a manual ledger entry (Deposit/Withdrawal)
func (h *LedgerHandler) AddEntry(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientID := vars["id"]
	tenantID := middleware.GetTenantID(r)
	user := r.Context().Value("user").(*models.User)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Type        string  `json:"type"`
		Currency    string  `json:"currency"`
		Amount      float64 `json:"amount"`
		Description string  `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	entry := models.LedgerEntry{
		TenantID:    *tenantID,
		ClientID:    clientID,
		BranchID:    user.PrimaryBranchID,
		Type:        req.Type,
		Currency:    req.Currency,
		Amount:      req.Amount,
		Description: req.Description,
		CreatedBy:   user.ID,
	}

	createdEntry, err := h.ledgerService.AddEntry(entry)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, createdEntry)
}

// Exchange performs a currency exchange
func (h *LedgerHandler) Exchange(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientID := vars["id"]
	tenantID := middleware.GetTenantID(r)
	user := r.Context().Value("user").(*models.User)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		FromCurrency string  `json:"fromCurrency"`
		ToCurrency   string  `json:"toCurrency"`
		Amount       float64 `json:"amount"`
		Rate         float64 `json:"rate"`
		Description  string  `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	entries, err := h.ledgerService.Exchange(
		*tenantID,
		clientID,
		user.PrimaryBranchID,
		user.ID,
		req.FromCurrency,
		req.ToCurrency,
		req.Amount,
		req.Rate,
		req.Description,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, entries)
}
