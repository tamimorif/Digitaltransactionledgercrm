package api

import (
	"api/pkg/middleware"
	"api/pkg/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

type ExchangeRateHandler struct {
	ExchangeRateService *services.ExchangeRateService
}

func NewExchangeRateHandler(service *services.ExchangeRateService) *ExchangeRateHandler {
	return &ExchangeRateHandler{ExchangeRateService: service}
}

// GetAllRatesHandler retrieves all current exchange rates
func (h *ExchangeRateHandler) GetAllRatesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	rates, err := h.ExchangeRateService.GetAllCurrentRates(*tenantID)
	if err != nil {
		http.Error(w, "Failed to retrieve rates", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rates)
}

// RefreshRatesHandler manually triggers rate update from API
func (h *ExchangeRateHandler) RefreshRatesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		BaseCurrency string `json:"baseCurrency"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.BaseCurrency == "" {
		req.BaseCurrency = "USD" // Default to USD
	}

	err := h.ExchangeRateService.FetchRatesFromAPI(*tenantID, req.BaseCurrency)
	if err != nil {
		fmt.Printf("RefreshRatesHandler error: %v\n", err)
		http.Error(w, "Failed to fetch rates from API: "+err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Rates refreshed successfully"})
}

// SetManualRateHandler sets a custom exchange rate
func (h *ExchangeRateHandler) SetManualRateHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		BaseCurrency   string  `json:"baseCurrency"`
		TargetCurrency string  `json:"targetCurrency"`
		Rate           float64 `json:"rate"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.BaseCurrency == "" || req.TargetCurrency == "" || req.Rate <= 0 {
		http.Error(w, "Invalid rate data", http.StatusBadRequest)
		return
	}

	err := h.ExchangeRateService.UpdateRate(*tenantID, req.BaseCurrency, req.TargetCurrency, req.Rate)
	if err != nil {
		http.Error(w, "Failed to set rate", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Rate set successfully"})
}

// GetRateHistoryHandler retrieves historical rates for charting
func (h *ExchangeRateHandler) GetRateHistoryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	baseCurrency := r.URL.Query().Get("base")
	targetCurrency := r.URL.Query().Get("target")
	daysStr := r.URL.Query().Get("days")

	if baseCurrency == "" || targetCurrency == "" {
		http.Error(w, "Base and target currencies required", http.StatusBadRequest)
		return
	}

	days := 30 // Default to 30 days
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil {
			days = d
		}
	}

	rates, err := h.ExchangeRateService.GetRateHistory(*tenantID, baseCurrency, targetCurrency, days)
	if err != nil {
		http.Error(w, "Failed to retrieve rate history", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rates)
}
