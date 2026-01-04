package api

import (
	"api/pkg/services"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/shopspring/decimal"
)

// NavasanHandler handles Navasan exchange rate endpoints
type NavasanHandler struct {
	navasanService *services.NavasanService
}

// NewNavasanHandler creates a new NavasanHandler
func NewNavasanHandler() *NavasanHandler {
	return &NavasanHandler{
		navasanService: services.NewNavasanService(),
	}
}

// GetNavasanRates returns all Navasan exchange rates (Tehran market)
// @Summary Get Navasan exchange rates
// @Description Get live exchange rates from Navasan (Tehran market rates in Toman)
// @Tags Navasan
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /rates/navasan [get]
func (h *NavasanHandler) GetNavasanRates(w http.ResponseWriter, r *http.Request) {
	rates, err := h.navasanService.FormatRatesForDisplay()
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch Navasan rates",
			"details": err.Error(),
		})
		return
	}

	payload := map[string]interface{}{
		"success": true,
		"data":    rates,
		"source":  "navasan.tech",
		"note":    "Rates are in Iranian Toman (1 Toman = 10 Rial)",
	}

	if items, itemsErr := h.navasanService.FormatRawRatesForDisplay(); itemsErr == nil {
		payload["items"] = items
	}

	respondJSON(w, http.StatusOK, payload)
}

// RefreshNavasanRates forces a refresh of cached rates
// @Summary Refresh Navasan exchange rates
// @Description Force refresh of Navasan exchange rates from source
// @Tags Navasan
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /rates/navasan/refresh [post]
func (h *NavasanHandler) RefreshNavasanRates(w http.ResponseWriter, r *http.Request) {
	rates, err := h.navasanService.FetchRates()
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to refresh Navasan rates",
			"details": err.Error(),
		})
		return
	}

	// Format for display
	result := make([]map[string]interface{}, 0, len(rates))
	for _, rate := range rates {
		item := map[string]interface{}{
			"currency":       rate.Currency,
			"currency_fa":    rate.CurrencyFA,
			"value":          rate.Value.StringFixed(0),
			"change":         rate.Change.StringFixed(0),
			"change_percent": rate.ChangePercent,
			"updated_at":     rate.UpdatedAt,
			"fetched_at":     rate.FetchedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		result = append(result, item)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
		"source":  "navasan.tech",
		"message": "Rates refreshed successfully",
	})
}

// GetNavasanRate returns the rate for a specific currency
// @Summary Get Navasan rate for a currency
// @Description Get live exchange rate for a specific currency from Navasan (Tehran market)
// @Tags Navasan
// @Accept json
// @Produce json
// @Param currency path string true "Currency code (e.g., USD, EUR, GBP, CAD)"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /rates/navasan/{currency} [get]
func (h *NavasanHandler) GetNavasanRate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	currency := vars["currency"]

	rate, err := h.navasanService.GetRate(currency)
	if err != nil {
		respondJSON(w, http.StatusNotFound, map[string]interface{}{
			"error":   "Currency not found",
			"details": err.Error(),
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"currency":       rate.Currency,
			"currency_fa":    rate.CurrencyFA,
			"value":          rate.Value.StringFixed(0),
			"change":         rate.Change.StringFixed(0),
			"change_percent": rate.ChangePercent,
			"updated_at":     rate.UpdatedAt,
			"fetched_at":     rate.FetchedAt.Format("2006-01-02T15:04:05Z07:00"),
		},
		"source": "navasan.tech",
		"note":   "Rate is in Iranian Toman (1 Toman = 10 Rial)",
	})
}

// GetUSDToIRR returns the USD to IRR conversion rate
// @Summary Get USD to IRR rate
// @Description Get live USD to Iranian Toman rate from Navasan (Tehran market)
// @Tags Navasan
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /rates/usd-irr [get]
func (h *NavasanHandler) GetUSDToIRR(w http.ResponseWriter, r *http.Request) {
	rate, err := h.navasanService.GetUSDToIRR()
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch USD rate",
			"details": err.Error(),
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":        true,
		"currency":       "USD",
		"currency_fa":    rate.CurrencyFA,
		"rate_toman":     rate.Value.StringFixed(0),
		"rate_rial":      rate.Value.Mul(decimal.NewFromInt(10)).StringFixed(0),
		"buyRate":        rate.Value.Mul(decimal.NewFromInt(10)).StringFixed(0),
		"sellRate":       rate.Value.Mul(decimal.NewFromInt(10)).StringFixed(0),
		"change":         rate.Change.StringFixed(0),
		"change_percent": rate.ChangePercent,
		"updated_at":     rate.UpdatedAt,
		"fetched_at":     rate.FetchedAt.Format("2006-01-02T15:04:05Z07:00"),
		"source":         "navasan.tech",
	})
}

// GetCADToIRR returns the CAD to IRR conversion rate
// @Summary Get CAD to IRR rate
// @Description Get live CAD to Iranian Toman rate from Navasan (Tehran market)
// @Tags Navasan
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /rates/cad-irr [get]
func (h *NavasanHandler) GetCADToIRR(w http.ResponseWriter, r *http.Request) {
	// Use GetRate for CAD
	rate, err := h.navasanService.GetRate("CAD")
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to fetch CAD rate",
			"details": err.Error(),
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":        true,
		"currency":       "CAD",
		"currency_fa":    rate.CurrencyFA,
		"rate_toman":     rate.Value.StringFixed(0),
		"rate_rial":      rate.Value.Mul(decimal.NewFromInt(10)).StringFixed(0),
		"buyRate":        rate.Value.Mul(decimal.NewFromInt(10)).StringFixed(0),
		"sellRate":       rate.Value.Mul(decimal.NewFromInt(10)).StringFixed(0),
		"change":         rate.Change.StringFixed(0),
		"change_percent": rate.ChangePercent,
		"updated_at":     rate.UpdatedAt,
		"fetched_at":     rate.FetchedAt.Format("2006-01-02T15:04:05Z07:00"),
		"source":         "navasan.tech",
	})
}
