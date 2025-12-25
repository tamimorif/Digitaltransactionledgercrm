package api

import (
	"encoding/json"
	"io"
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
}

type OpenERResponse struct {
	Result string             `json:"result"`
	Rates  map[string]float64 `json:"rates"`
}

// FetchExternalRatesHandler fetches rates from open.er-api.com instead of scraping
// @Summary Fetch external exchange rates
// @Description Fetches current exchange rates from Open Exchange Rates
// @Tags Rates
// @Produce json
// @Success 200 {object} ExternalRatesResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/rates/fetch-external [get]
func (h *Handler) FetchExternalRatesHandler(w http.ResponseWriter, r *http.Request) {
	// Fetch from Open Exchange Rates (Free, unlimited)
	resp, err := http.Get("https://open.er-api.com/v6/latest/USD")
	if err != nil {
		http.Error(w, "Failed to fetch external rates: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read external rates: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var erResp OpenERResponse
	if err := json.Unmarshal(bodyBytes, &erResp); err != nil {
		http.Error(w, "Failed to parse external rates: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if erResp.Result != "success" {
		http.Error(w, "External API returned error", http.StatusInternalServerError)
		return
	}

	rates := erResp.Rates
	// Calculate rates relative to conventions or just return available rates
	// Sarafibahmani provided CAD/IRR etc.
	// OpenER provides USD base.
	// We want Price of 1 Unit of Currency in IRR.
	// IRR = 42000 (USD->IRR).
	// CAD = 1.36 (USD->CAD).
	// 1 CAD = (1/1.36) USD = (1/1.36) * 42000 IRR = 42000/1.36.

	getRate := func(target string) float64 {
		return rates[target]
	}

	// usdRate := 1.0 // Base
	// cadRate := getRate("CAD")
	// eurRate := getRate("EUR")
	// gbpRate := getRate("GBP")
	irrRate := getRate("IRR") // Official rate.

	// Calculate cross rates against IRR
	calculateCrossRate := func(currencyCode string) float64 {
		rate := getRate(currencyCode)
		if rate <= 0 {
			return 0
		}
		// Base is USD.
		// X Rate = (USD->IRR) / (USD->X)
		return irrRate / rate
	}

	cadInIrr := calculateCrossRate("CAD")
	eurInIrr := calculateCrossRate("EUR")
	gbpInIrr := calculateCrossRate("GBP")
	usdInIrr := irrRate // Since base is USD, 1 USD = irrRate

	// We set Buy = Sell for official rates (mid-market)
	response := ExternalRatesResponse{
		CAD_BUY:  cadInIrr,
		CAD_SELL: cadInIrr,
		EUR_BUY:  eurInIrr,
		EUR_SELL: eurInIrr,
		GBP_BUY:  gbpInIrr,
		GBP_SELL: gbpInIrr,
		USD_BUY:  usdInIrr,
		USD_SELL: usdInIrr,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
