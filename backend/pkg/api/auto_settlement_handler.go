package api

import (
	"api/pkg/services"
	"api/pkg/validation"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// AutoSettlementHandler handles auto-settlement API requests
type AutoSettlementHandler struct {
	autoSettlementService *services.AutoSettlementService
}

// NewAutoSettlementHandler creates a new AutoSettlementHandler
func NewAutoSettlementHandler(db *gorm.DB) *AutoSettlementHandler {
	return &AutoSettlementHandler{
		autoSettlementService: services.NewAutoSettlementService(db),
	}
}

// GetSettlementSuggestionsHandler returns settlement suggestions for an incoming remittance
// @Summary Get settlement suggestions
// @Description Returns suggested settlements for an incoming remittance based on strategy
// @Tags Auto-Settlement
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Incoming Remittance ID"
// @Param strategy query string false "Settlement strategy: FIFO, LIFO, BEST_RATE" default(FIFO)
// @Param limit query int false "Maximum number of suggestions"
// @Success 200 {array} services.SettlementSuggestion
// @Router /remittances/incoming/{id}/suggestions [get]
func (h *AutoSettlementHandler) GetSettlementSuggestionsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)

	incomingID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid remittance ID", http.StatusBadRequest)
		return
	}

	strategy := services.SettlementStrategy(r.URL.Query().Get("strategy"))
	if strategy == "" {
		strategy = services.StrategyFIFO
	}

	limit := 0
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		limitVal, _ := strconv.Atoi(limitStr)
		limit = limitVal
	}

	suggestions, err := h.autoSettlementService.GetSettlementSuggestions(tenantID, uint(incomingID), strategy, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suggestions)
}

// AutoSettleHandler automatically settles an incoming remittance
// @Summary Auto-settle incoming remittance
// @Description Automatically settles an incoming remittance using the specified strategy
// @Tags Auto-Settlement
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body validation.AutoSettleRequest true "Auto-settle request"
// @Success 200 {object} services.AutoSettlementResult
// @Router /remittances/auto-settle [post]
func (h *AutoSettlementHandler) AutoSettleHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	userID := r.Context().Value("userID").(uint)

	var req validation.AutoSettleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate
	if errors := validation.ValidateStruct(req); errors != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{"errors": errors})
		return
	}

	strategy := services.SettlementStrategy(req.Strategy)
	if strategy == "" {
		strategy = services.StrategyFIFO
	}

	result, err := h.autoSettlementService.AutoSettle(tenantID, req.IncomingRemittanceID, userID, strategy)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetUnsettledSummaryHandler returns summary of unsettled remittances
// @Summary Get unsettled remittances summary
// @Description Returns aging and status breakdown of unsettled outgoing remittances
// @Tags Auto-Settlement
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Router /remittances/unsettled-summary [get]
func (h *AutoSettlementHandler) GetUnsettledSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)

	summary, err := h.autoSettlementService.GetUnsettledSummary(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}
