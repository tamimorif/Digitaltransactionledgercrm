package services

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
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
	client      *http.Client
	cachedRates map[string]NavasanRate
	cacheMutex  sync.RWMutex
	cacheExpiry time.Time
	cacheTTL    time.Duration
}

// NewNavasanService creates a new Navasan service
func NewNavasanService() *NavasanService {
	return &NavasanService{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		cachedRates: make(map[string]NavasanRate),
		cacheTTL:    5 * time.Minute,
	}
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

// FetchRates fetches fresh rates from Navasan widget
func (s *NavasanService) FetchRates() (map[string]NavasanRate, error) {
	// Request rates for: USD, EUR, GBP, CAD, AED, USDT, AUD, TRY
	url := "https://www.navasan.tech/wp-navasan.php?usd&eur&gbp&cad&aed&usdt&aud&try"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	// Set headers to mimic browser
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Referer", "https://www.navasan.net/")

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

	body := string(bodyBytes)
	now := time.Now()

	// Parse the JSONP response
	// Format: navasanret('<HTML content>')
	rates := s.parseNavasanResponse(body, now)

	// Update cache
	s.cacheMutex.Lock()
	s.cachedRates = rates
	s.cacheExpiry = now.Add(s.cacheTTL)
	s.cacheMutex.Unlock()

	return rates, nil
}

// parseNavasanResponse extracts rates from the JSONP/HTML response
func (s *NavasanService) parseNavasanResponse(body string, fetchedAt time.Time) map[string]NavasanRate {
	rates := make(map[string]NavasanRate)

	// The response is: navasanret('<escaped HTML>')
	// First, extract the HTML content
	html := s.extractHTMLFromJSONP(body)
	if html == "" {
		return rates
	}

	// Currency mappings - the id attribute in HTML corresponds to currency code
	currencyMap := map[string]string{
		"usd":  "دلار آمریکا",
		"eur":  "یورو",
		"gbp":  "پوند انگلیس",
		"cad":  "دلار کانادا",
		"aed":  "درهم امارات",
		"usdt": "تتر",
		"aud":  "دلار استرالیا",
		"try":  "لیر ترکیه",
	}

	// Parse each currency row from the HTML table
	for code, faName := range currencyMap {
		rate := s.extractCurrencyRate(html, code, faName, fetchedAt)
		if rate != nil {
			rates[strings.ToUpper(code)] = *rate
		}
	}

	return rates
}

// extractHTMLFromJSONP extracts the HTML content from the JSONP response
func (s *NavasanService) extractHTMLFromJSONP(body string) string {
	// Response format: navasanret('"<HTML content>"');
	// The HTML is double-escaped with literal backslashes: \\" means "

	// Remove the function wrapper - looking for navasanret('
	start := strings.Index(body, "navasanret('")
	if start == -1 {
		return ""
	}
	start += len("navasanret('")

	// Find the ending ');
	end := strings.LastIndex(body, "');")
	if end == -1 {
		end = strings.LastIndex(body, "')")
	}
	if end == -1 || end <= start {
		return ""
	}

	jsonStr := body[start:end]

	// The content has LITERAL double backslashes like \\" which means escaped quote
	// Remove leading and trailing escaped quotes
	jsonStr = strings.TrimPrefix(jsonStr, `\"`)
	jsonStr = strings.TrimSuffix(jsonStr, `\"`)

	// Unescape sequences - these are LITERAL backslash sequences in the source
	html := jsonStr
	// Handle double-escaped quotes: \\" -> "
	html = strings.ReplaceAll(html, `\\"`, `"`)
	// Handle escaped slashes: \\/ -> /
	html = strings.ReplaceAll(html, `\\/`, `/`)
	// Handle newlines: \\r\\n -> newline
	html = strings.ReplaceAll(html, `\\r\\n`, "\n")
	html = strings.ReplaceAll(html, `\\r`, "")
	html = strings.ReplaceAll(html, `\\n`, "\n")
	html = strings.ReplaceAll(html, `\\t`, "\t")
	// Handle remaining single backslash escapes
	html = strings.ReplaceAll(html, `\"`, `"`)
	html = strings.ReplaceAll(html, `\/`, `/`)
	html = strings.ReplaceAll(html, `\r\n`, "\n")
	html = strings.ReplaceAll(html, `\n`, "\n")

	return html
}

// extractCurrencyRate extracts rate data for a specific currency from HTML
func (s *NavasanService) extractCurrencyRate(html, currencyCode, currencyFA string, fetchedAt time.Time) *NavasanRate {
	// Find the row with id="currencyCode"
	// Format: <tr id="usd">...<td class="val">۱۱۹,۰۵۰</td>...<td class="chg ...">...</td>...<td class="dat">۱۹:۵۹</td>...

	rowPattern := fmt.Sprintf(`<tr id="%s">(.*?)</tr>`, currencyCode)
	rowRe := regexp.MustCompile(`(?s)` + rowPattern)
	rowMatch := rowRe.FindStringSubmatch(html)

	if len(rowMatch) < 2 {
		return nil
	}

	rowContent := rowMatch[1]

	// Extract value from <td class="val">...</td>
	valRe := regexp.MustCompile(`<td class="val">([^<]+)</td>`)
	valMatch := valRe.FindStringSubmatch(rowContent)

	var value decimal.Decimal
	if len(valMatch) > 1 {
		value = s.parsePersianNumber(valMatch[1])
	}

	if value.IsZero() {
		return nil
	}

	// Extract change from <td class="chg ...">...</td>
	chgRe := regexp.MustCompile(`<td class="chg[^"]*">([^<]+)</td>`)
	chgMatch := chgRe.FindStringSubmatch(rowContent)

	var change decimal.Decimal
	var changeType string
	if len(chgMatch) > 1 {
		change = s.parsePersianNumber(chgMatch[1])
		// Check if it's negative (class contains "neg")
		if strings.Contains(rowContent, `class="chg neg"`) {
			change = change.Neg()
			changeType = "neg"
		} else if strings.Contains(rowContent, `class="chg pos"`) {
			changeType = "pos"
		} else {
			changeType = "zer"
		}
	}

	// Extract time from <td class="dat">...</td>
	datRe := regexp.MustCompile(`<td class="dat">([^<]+)</td>`)
	datMatch := datRe.FindStringSubmatch(rowContent)

	var updatedAt string
	if len(datMatch) > 1 {
		updatedAt = s.convertPersianDigitsToEnglish(datMatch[1])
	}

	// Calculate change percent
	var changePercent string
	if !value.IsZero() && !change.IsZero() {
		prevValue := value.Sub(change)
		if !prevValue.IsZero() {
			pct := change.Div(prevValue).Mul(decimal.NewFromInt(100))
			if changeType == "pos" {
				changePercent = "+" + pct.StringFixed(2) + "%"
			} else if changeType == "neg" {
				changePercent = pct.StringFixed(2) + "%"
			} else {
				changePercent = "0%"
			}
		}
	} else {
		changePercent = "0%"
	}

	return &NavasanRate{
		Currency:      strings.ToUpper(currencyCode),
		CurrencyFA:    currencyFA,
		Value:         value,
		Change:        change,
		ChangePercent: changePercent,
		UpdatedAt:     updatedAt,
		FetchedAt:     fetchedAt,
	}
}

// parsePersianNumber converts Persian numerals to decimal
func (s *NavasanService) parsePersianNumber(persian string) decimal.Decimal {
	// First, decode unicode escape sequences (\\uXXXX)
	decoded := s.decodeUnicodeEscapes(persian)
	// Then convert Persian/Arabic digits to English
	english := s.convertPersianDigitsToEnglish(decoded)
	// Remove commas
	english = strings.ReplaceAll(english, ",", "")
	// Remove negative sign for parsing, we'll handle it separately
	english = strings.TrimPrefix(english, "-")
	english = strings.TrimSpace(english)

	if english == "" {
		return decimal.Zero
	}

	val, err := decimal.NewFromString(english)
	if err != nil {
		return decimal.Zero
	}
	return val
}

// decodeUnicodeEscapes converts \\uXXXX sequences to actual unicode characters
// The input has LITERAL double backslashes (two \ characters) before 'u'
func (s *NavasanService) decodeUnicodeEscapes(input string) string {
	result := input

	// Pattern is two literal backslash characters followed by 'u' and 4 hex digits
	// In the actual string: \\u06f1 (where \\ is two \ characters)
	searchPattern := `\\u` // This is the Go string literal for two backslashes followed by 'u'

	for strings.Contains(result, searchPattern) {
		idx := strings.Index(result, searchPattern)
		if idx == -1 {
			break
		}

		// We need 4 hex characters after "\\u" (which is 3 characters: \, \, u)
		// idx points to first \, so hex starts at idx+3
		if idx+7 > len(result) {
			break
		}

		hexStr := result[idx+3 : idx+7]

		// Try to parse as hex
		var codePoint int64
		_, err := fmt.Sscanf(hexStr, "%x", &codePoint)
		if err == nil && codePoint >= 0 && codePoint <= 0x10FFFF {
			// Replace the escape sequence (3 chars for \\u + 4 chars for hex = 7 chars)
			unicodeChar := string(rune(codePoint))
			result = result[:idx] + unicodeChar + result[idx+7:]
		} else {
			// If parsing fails, skip this sequence
			break
		}
	}

	return result
}

// convertPersianDigitsToEnglish converts Persian/Arabic digits to English
func (s *NavasanService) convertPersianDigitsToEnglish(persian string) string {
	// First decode any unicode escapes
	decoded := s.decodeUnicodeEscapes(persian)

	// Persian digits: ۰۱۲۳۴۵۶۷۸۹
	// Arabic digits: ٠١٢٣٤٥٦٧٨٩
	persianDigits := []rune{'۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'}
	arabicDigits := []rune{'٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'}
	englishDigits := []rune{'0', '1', '2', '3', '4', '5', '6', '7', '8', '9'}

	result := []rune(decoded)
	for i, r := range result {
		for j, pd := range persianDigits {
			if r == pd {
				result[i] = englishDigits[j]
				break
			}
		}
		for j, ad := range arabicDigits {
			if r == ad {
				result[i] = englishDigits[j]
				break
			}
		}
	}

	return string(result)
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

// formatWithCommas adds thousand separators to a number
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
			"source":          "navasan.tech",
		}
		result = append(result, item)
	}

	return result, nil
}
