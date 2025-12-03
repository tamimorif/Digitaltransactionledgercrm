package api

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
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

// FetchExternalRatesHandler fetches rates from sarafibahmani.ca
// @Summary Fetch external exchange rates
// @Description Scrapes current exchange rates from sarafibahmani.ca
// @Tags Rates
// @Produce json
// @Success 200 {object} ExternalRatesResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/rates/fetch-external [get]
func (h *Handler) FetchExternalRatesHandler(w http.ResponseWriter, r *http.Request) {
	// Fetch the website content
	resp, err := http.Get("https://sarafibahmani.ca/")
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

	htmlContent := string(bodyBytes)
	rates := parseRatesFromHTML(htmlContent)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rates)
}

func parseRatesFromHTML(html string) ExternalRatesResponse {
	// Helper function to extract rates based on image alt marker
	extractRates := func(marker string) (string, string) {
		// Find the marker
		markerIdx := strings.Index(html, marker)
		if markerIdx == -1 {
			return "0", "0"
		}

		// Look ahead from the marker for Sell and Buy
		// We limit the search window to avoid jumping to the next currency
		// 2000 chars should be enough to cover the HTML block
		endIdx := markerIdx + 2000
		if endIdx > len(html) {
			endIdx = len(html)
		}
		searchWindow := html[markerIdx:endIdx]

		// Regex to find Sell and Buy
		// Matches: Sell : 81,300  or Sell : 1.41
		// We use [^:]* to match any character (like whitespace or &nbsp;) between Sell/Buy and :
		// We capture numbers with commas/decimals, or text like CALL/STOP
		sellRe := regexp.MustCompile(`Sell[^:]*:\s*([0-9,\.]+|CALL|STOP)`)
		buyRe := regexp.MustCompile(`Buy[^:]*:\s*([0-9,\.]+|CALL|STOP)`)

		sellMatch := sellRe.FindStringSubmatch(searchWindow)
		buyMatch := buyRe.FindStringSubmatch(searchWindow)

		sell := "0"
		if len(sellMatch) > 1 {
			sell = sellMatch[1]
		}

		buy := "0"
		if len(buyMatch) > 1 {
			buy = buyMatch[1]
		}

		return sell, buy
	}

	// Helper to parse rate string to float
	parseRate := func(rateStr string) float64 {
		// Remove commas
		cleanStr := strings.ReplaceAll(rateStr, ",", "")
		// Handle non-numeric values
		if cleanStr == "CALL" || cleanStr == "STOP" {
			return 0
		}
		val, err := strconv.ParseFloat(cleanStr, 64)
		if err != nil {
			return 0
		}
		return val
	}

	// Extract rates for each currency
	cadSellStr, cadBuyStr := extractRates("alt=\"CAD- CIRCLE\"")
	usdSellStr, usdBuyStr := extractRates("alt=\"USD- CIRCLE\"")
	eurSellStr, eurBuyStr := extractRates("alt=\"EUR- CIRCLE\"")
	gbpSellStr, gbpBuyStr := extractRates("alt=\"GBP- CIRCLE\"")
	// USDT is not yet supported by frontend structure, skipping for now or could add if frontend updated

	response := ExternalRatesResponse{
		CAD_BUY:  parseRate(cadBuyStr),
		CAD_SELL: parseRate(cadSellStr),
		USD_BUY:  parseRate(usdBuyStr),
		USD_SELL: parseRate(usdSellStr),
		EUR_BUY:  parseRate(eurBuyStr),
		EUR_SELL: parseRate(eurSellStr),
		GBP_BUY:  parseRate(gbpBuyStr),
		GBP_SELL: parseRate(gbpSellStr),
	}

	return response
}
