package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
)

// NavasanRate represents an exchange rate from Navasan
type NavasanRate struct {
	Currency      string          `json:"currency"`
	CurrencyFA    string          `json:"currency_fa"`
	Value         decimal.Decimal `json:"value"`  // Rate in Toman
	Change        decimal.Decimal `json:"change"` // Change from yesterday
	ChangePercent string          `json:"change_percent"`
	UpdatedAt     string          `json:"updated_at"` // Time string from Navasan
	FetchedAt     time.Time       `json:"fetched_at"`
}

// NavasanService fetches exchange rates from navasan.tech
type NavasanService struct {
	client          *http.Client
	cachedRates     map[string]NavasanRate
	cachedRaw       map[string]NavasanItem
	cacheMutex      sync.RWMutex
	cacheExpiry     time.Time
	cacheTTL        time.Duration
	updateThreshold float64
}

// NewNavasanService creates a new Navasan service
func NewNavasanService() *NavasanService {
	return &NavasanService{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		cachedRates:     make(map[string]NavasanRate),
		cachedRaw:       make(map[string]NavasanItem),
		cacheTTL:        60 * time.Second,
		updateThreshold: 0.25,
	}
}

// NavasanAPIResponse represents the map response from the API
type NavasanAPIResponse map[string]NavasanItem

// NavasanItem represents a single item in the API response
type NavasanItem struct {
	Value     string      `json:"value"`
	Change    float64     `json:"change"`
	Timestamp int64       `json:"timestamp"`
	Date      interface{} `json:"date"`
}

// GetRates returns all Navasan rates (from cache if valid, otherwise fetches fresh)
func (s *NavasanService) GetRates() (map[string]NavasanRate, error) {
	s.cacheMutex.RLock()
	if time.Now().Before(s.cacheExpiry) && len(s.cachedRates) > 0 {
		rates := make(map[string]NavasanRate)
		for k, v := range s.cachedRates {
			rates[k] = v
		}
		s.cacheMutex.RUnlock()
		return rates, nil
	}
	s.cacheMutex.RUnlock()

	return s.FetchRates()
}

// GetRawRates returns all Navasan items (from cache if valid, otherwise fetches fresh)
func (s *NavasanService) GetRawRates() (map[string]NavasanItem, error) {
	s.cacheMutex.RLock()
	if time.Now().Before(s.cacheExpiry) && len(s.cachedRaw) > 0 {
		raw := s.cloneCachedRaw()
		s.cacheMutex.RUnlock()
		return raw, nil
	}
	s.cacheMutex.RUnlock()

	if _, err := s.FetchRates(); err != nil {
		return nil, err
	}

	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()
	return s.cloneCachedRaw(), nil
}

// FetchRates fetches fresh rates from Navasan API
func (s *NavasanService) FetchRates() (map[string]NavasanRate, error) {
	previousRates := s.cloneCachedRates()

	apiKey := os.Getenv("NAVASAN_API_KEY")
	if apiKey == "" {
		// Fallback or error? For now error to prompt configuration
		return nil, fmt.Errorf("NAVASAN_API_KEY not set")
	}

	url := fmt.Sprintf("http://api.navasan.tech/latest/?api_key=%s", apiKey)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	// Set headers
	req.Header.Set("User-Agent", "Velopay-Backend/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error fetching URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading body: %w", err)
	}

	var apiResponse NavasanAPIResponse
	if err := json.Unmarshal(bodyBytes, &apiResponse); err != nil {
		return nil, fmt.Errorf("error parsing JSON: %w", err)
	}

	rates := s.mapAPIResponseToRates(apiResponse)
	now := time.Now()

	updates := s.detectSignificantChanges(previousRates, rates)
	if len(updates) > 0 {
		s.broadcastRateUpdates(updates)
	}

	// Update cache
	s.cacheMutex.Lock()
	s.cachedRates = rates
	s.cachedRaw = s.cloneRawRates(apiResponse)
	s.cacheExpiry = now.Add(s.cacheTTL)
	s.cacheMutex.Unlock()

	return rates, nil
}

func (s *NavasanService) cloneCachedRates() map[string]NavasanRate {
	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()

	if len(s.cachedRates) == 0 {
		return nil
	}

	clone := make(map[string]NavasanRate, len(s.cachedRates))
	for k, v := range s.cachedRates {
		clone[k] = v
	}
	return clone
}

func (s *NavasanService) cloneCachedRaw() map[string]NavasanItem {
	if len(s.cachedRaw) == 0 {
		return nil
	}

	clone := make(map[string]NavasanItem, len(s.cachedRaw))
	for k, v := range s.cachedRaw {
		clone[k] = v
	}
	return clone
}

func (s *NavasanService) cloneRawRates(apiResp NavasanAPIResponse) map[string]NavasanItem {
	if len(apiResp) == 0 {
		return nil
	}

	clone := make(map[string]NavasanItem, len(apiResp))
	for k, v := range apiResp {
		clone[k] = v
	}
	return clone
}

func (s *NavasanService) detectSignificantChanges(previous, current map[string]NavasanRate) []NavasanRate {
	if len(previous) == 0 || len(current) == 0 {
		return nil
	}

	threshold := decimal.NewFromFloat(s.updateThreshold)
	updates := make([]NavasanRate, 0)

	for code, currentRate := range current {
		prevRate, ok := previous[code]
		if !ok || prevRate.Value.IsZero() {
			continue
		}

		diff := currentRate.Value.Sub(prevRate.Value).Abs()
		pct := diff.Div(prevRate.Value.Abs()).Mul(decimal.NewFromInt(100))

		if pct.GreaterThan(threshold) || pct.Equal(threshold) {
			updates = append(updates, currentRate)
		}
	}

	return updates
}

func (s *NavasanService) broadcastRateUpdates(rates []NavasanRate) {
	if len(rates) == 0 {
		return
	}

	payload := make([]map[string]interface{}, 0, len(rates))
	for _, rate := range rates {
		payload = append(payload, map[string]interface{}{
			"currency":       rate.Currency,
			"currency_fa":    rate.CurrencyFA,
			"value":          rate.Value.StringFixed(0),
			"change":         rate.Change.StringFixed(0),
			"change_percent": rate.ChangePercent,
			"updated_at":     rate.UpdatedAt,
			"fetched_at":     rate.FetchedAt.Format(time.RFC3339),
		})
	}

	hub := GetHub()
	hub.BroadcastRateUpdateAll(map[string]interface{}{
		"rates":             payload,
		"threshold_percent": s.updateThreshold,
	})
}

// mapAPIResponseToRates converts API response to our domain model
func (s *NavasanService) mapAPIResponseToRates(apiResp NavasanAPIResponse) map[string]NavasanRate {
	rates := make(map[string]NavasanRate)
	now := time.Now()

	// Mapping from API keys (using _sell for the rate) to our Currency Codes
	keyMap := map[string]struct {
		Code string
		Name string
	}{
		"usd_sell": {"USD", "دلار آمریکا"},
		"eur_sell": {"EUR", "یورو"},
		"gbp_sell": {"GBP", "پوند انگلیس"},
		"cad_sell": {"CAD", "دلار کانادا"},
		"aed_sell": {"AED", "درهم امارات"},
		"cny_sell": {"CNY", "یوان چین"},
		"aud_sell": {"AUD", "دلار استرالیا"},
		"try_sell": {"TRY", "لیر ترکیه"},
		"chf_sell": {"CHF", "فرانک سوئیس"},
		"sek_sell": {"SEK", "کرون سوئد"},
		"nok_sell": {"NOK", "کرون نروژ"},
		// Crypto (often plain keys like 'btc' or 'btc_sell' - Navasan varies, we check typical '_sell' first)
		"usdt_sell": {"USDT", "تتر"},
		// Some crypto might not have '_sell' suffix in standard response, but let's try standard first
		"btc_sell": {"BTC", "بیت کوین"},
		"eth_sell": {"ETH", "اتریوم"},
		"xrp_sell": {"XRP", "ریپل"},
		"trx_sell": {"TRX", "ترون"},
	}

	// Fallback keys if _sell doesn't exist
	fallbackMap := map[string]string{
		"usdt": "USDT",
		"usd":  "USD",
		"eur":  "EUR",
		"cad":  "CAD",
		"btc":  "BTC",
		"eth":  "ETH",
		"xrp":  "XRP",
		"trx":  "TRX",
	}

	for apiKey, info := range keyMap {
		if item, ok := apiResp[apiKey]; ok {
			rates[info.Code] = s.createNavasanRate(info.Code, info.Name, item, now)
		}
	}

	// Check fallbacks if not found
	for apiKey, code := range fallbackMap {
		if _, exists := rates[code]; !exists {
			if item, ok := apiResp[apiKey]; ok {
				// We don't have the Persian name readily available here for fallbacks easily, reuse code or generic
				name := code
				// Try to find name from keyMap if possible
				for _, info := range keyMap {
					if info.Code == code {
						name = info.Name
						break
					}
				}
				rates[code] = s.createNavasanRate(code, name, item, now)
			}
		}
	}

	return rates
}

func (s *NavasanService) createNavasanRate(code, name string, item NavasanItem, fetchedAt time.Time) NavasanRate {
	// Parse value (remove commas if any)
	cleanValue := strings.ReplaceAll(item.Value, ",", "")
	value, _ := decimal.NewFromString(cleanValue)

	// Change is a float in API response
	change := decimal.NewFromFloat(item.Change)

	var changePercent string
	if !value.IsZero() && !change.IsZero() {
		prevValue := value.Sub(change)
		if !prevValue.IsZero() {
			pct := change.Div(prevValue).Mul(decimal.NewFromInt(100))
			prefix := ""
			if pct.IsPositive() {
				prefix = "+"
			}
			changePercent = prefix + pct.StringFixed(2) + "%"
		} else {
			changePercent = "0%"
		}
	} else {
		changePercent = "0%"
	}

	// Handle Date which can be string or number (for some items)
	var dateStr string
	if v, ok := item.Date.(string); ok {
		dateStr = v
	} else {
		dateStr = fmt.Sprintf("%v", item.Date)
	}

	return NavasanRate{
		Currency:      code,
		CurrencyFA:    name,
		Value:         value,
		Change:        change,
		ChangePercent: changePercent,
		UpdatedAt:     dateStr,
		FetchedAt:     fetchedAt,
	}
}

// GetRate returns the rate for a specific currency
func (s *NavasanService) GetRate(currency string) (*NavasanRate, error) {
	rates, err := s.GetRates()
	if err != nil {
		return nil, err
	}

	rate, ok := rates[strings.ToUpper(currency)]
	if !ok {
		return nil, fmt.Errorf("rate for %s not found", currency)
	}

	return &rate, nil
}

// GetUSDToIRR returns the USD to IRR (Toman) rate
func (s *NavasanService) GetUSDToIRR() (*NavasanRate, error) {
	return s.GetRate("USD")
}

// ConvertToIRR converts an amount from a currency to IRR (Toman) using Navasan rates
func (s *NavasanService) ConvertToIRR(amount decimal.Decimal, fromCurrency string) (decimal.Decimal, error) {
	rate, err := s.GetRate(fromCurrency)
	if err != nil {
		return decimal.Zero, err
	}

	return amount.Mul(rate.Value), nil
}

// ConvertFromIRR converts an amount from IRR (Toman) to a currency
func (s *NavasanService) ConvertFromIRR(amountIRR decimal.Decimal, toCurrency string) (decimal.Decimal, error) {
	rate, err := s.GetRate(toCurrency)
	if err != nil {
		return decimal.Zero, err
	}

	if rate.Value.IsZero() {
		return decimal.Zero, fmt.Errorf("rate for %s is zero", toCurrency)
	}

	return amountIRR.Div(rate.Value), nil
}

// formatWithCommas adds thousand separators to a number - Helper for display if needed
func formatWithCommas(n float64) string {
	str := fmt.Sprintf("%.0f", n)
	if len(str) <= 3 {
		return str
	}

	var result strings.Builder
	startOffset := len(str) % 3
	if startOffset > 0 {
		result.WriteString(str[:startOffset])
		if len(str) > startOffset {
			result.WriteString(",")
		}
	}

	for i := startOffset; i < len(str); i += 3 {
		if i > startOffset {
			result.WriteString(",")
		}
		result.WriteString(str[i : i+3])
	}

	return result.String()
}

// FormatRatesForDisplay formats Navasan rates for API response
func (s *NavasanService) FormatRatesForDisplay() ([]map[string]interface{}, error) {
	rates, err := s.GetRates()
	if err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0, len(rates))
	for _, rate := range rates {
		item := map[string]interface{}{
			"currency":        rate.Currency,
			"currency_fa":     rate.CurrencyFA,
			"value":           rate.Value.StringFixed(0),
			"value_formatted": formatWithCommas(rate.Value.InexactFloat64()),
			"change":          rate.Change.StringFixed(0),
			"change_percent":  rate.ChangePercent,
			"updated_at":      rate.UpdatedAt,
			"fetched_at":      rate.FetchedAt.Format(time.RFC3339),
			"source":          "navasan.tech (API)",
		}
		result = append(result, item)
	}

	return result, nil
}

// FormatRawRatesForDisplay returns the full list of API items for client use.
func (s *NavasanService) FormatRawRatesForDisplay() ([]map[string]interface{}, error) {
	rawRates, err := s.GetRawRates()
	if err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0, len(rawRates))
	for itemKey, item := range rawRates {
		name := navasanItemNames[itemKey]
		if name == "" {
			name = itemKey
		}
		result = append(result, map[string]interface{}{
			"item":        itemKey,
			"currency":    itemKey,
			"currency_fa": name,
			"value":       item.Value,
			"change":      item.Change,
			"timestamp":   item.Timestamp,
			"date":        item.Date,
			"source":      "navasan.tech (API)",
		})
	}

	return result, nil
}
