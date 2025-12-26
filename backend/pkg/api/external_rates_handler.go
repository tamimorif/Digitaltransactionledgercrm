package api

import (
	"encoding/json"
	"net/http"
)

type ExternalRatesResponse struct {
	CAD_BUY  float64 `json:"CAD_BUY"`
	CAD_SELL float64 `json:"CAD_SELL"`
	EUR_BUY  float64 `json:"EUR_BUY"`
	EUR_SELL float64 `json:"EUR_SELL"`
	GBP_BUY  float64 `json:"GBP_BUY"`
	GBP_SELL float64 `json:"GBP_SELL"`
	USD_BUY  float64 `json:"USD_BUY"`
	USD_SELL float64 `json:"USD_SELL"`
	AED_BUY  float64 `json:"AED_BUY"`
	AED_SELL float64 `json:"AED_SELL"`
	TRY_BUY  float64 `json:"TRY_BUY"`
	TRY_SELL float64 `json:"TRY_SELL"`
	// Crypto
	USDT_BUY  float64 `json:"USDT_BUY"`
	USDT_SELL float64 `json:"USDT_SELL"`
	BTC_BUY   float64 `json:"BTC_BUY"`
	BTC_SELL  float64 `json:"BTC_SELL"`
	ETH_BUY   float64 `json:"ETH_BUY"`
	ETH_SELL  float64 `json:"ETH_SELL"`
	XRP_BUY   float64 `json:"XRP_BUY"`
	XRP_SELL  float64 `json:"XRP_SELL"`
	TRX_BUY   float64 `json:"TRX_BUY"`
	TRX_SELL  float64 `json:"TRX_SELL"`
}

type OpenERResponse struct {
	Result string             `json:"result"`
	Rates  map[string]float64 `json:"rates"`
}

// FetchExternalRatesHandler fetches rates from Navasan API (Street Rates)
// @Summary Fetch external exchange rates
// @Description Fetches current street exchange rates from Navasan
// @Tags Rates
// @Produce json
// @Success 200 {object} ExternalRatesResponse
// @Failure 500 {object} map[string]string
// @Router /api/rates/fetch-external [get]
func (h *Handler) FetchExternalRatesHandler(w http.ResponseWriter, r *http.Request) {
	// Use Navasan Service to get Real Market Rates
	rates, err := h.navasanService.GetRates()
	if err != nil {
		http.Error(w, "Failed to fetch external rates: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Helper to safely get value as float64
	getRateValue := func(currencyCode string) float64 {
		if rate, ok := rates[currencyCode]; ok {
			val, _ := rate.Value.Float64()
			return val
		}
		return 0
	}

	// Map Navasan rates (in Toman) to the response structure
	response := ExternalRatesResponse{
		CAD_BUY:   getRateValue("CAD"),
		CAD_SELL:  getRateValue("CAD"),
		EUR_BUY:   getRateValue("EUR"),
		EUR_SELL:  getRateValue("EUR"),
		GBP_BUY:   getRateValue("GBP"),
		GBP_SELL:  getRateValue("GBP"),
		USD_BUY:   getRateValue("USD"),
		USD_SELL:  getRateValue("USD"),
		AED_BUY:   getRateValue("AED"),
		AED_SELL:  getRateValue("AED"),
		TRY_BUY:   getRateValue("TRY"),
		TRY_SELL:  getRateValue("TRY"),
		USDT_BUY:  getRateValue("USDT"),
		USDT_SELL: getRateValue("USDT"),
		BTC_BUY:   getRateValue("BTC"),
		BTC_SELL:  getRateValue("BTC"),
		ETH_BUY:   getRateValue("ETH"),
		ETH_SELL:  getRateValue("ETH"),
		XRP_BUY:   getRateValue("XRP"),
		XRP_SELL:  getRateValue("XRP"),
		TRX_BUY:   getRateValue("TRX"),
		TRX_SELL:  getRateValue("TRX"),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
