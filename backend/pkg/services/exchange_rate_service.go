package services

import (
	"api/pkg/models"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"gorm.io/gorm"
)

type ExchangeRateService struct {
	DB *gorm.DB
}

func NewExchangeRateService(db *gorm.DB) *ExchangeRateService {
	return &ExchangeRateService{DB: db}
}

// FrankfurterAPIResponse represents the response from frankfurter.app
type FrankfurterAPIResponse struct {
	Amount float64            `json:"amount"`
	Base   string             `json:"base"`
	Date   string             `json:"date"`
	Rates  map[string]float64 `json:"rates"`
}

// FetchRatesFromAPI fetches latest rates from frankfurter.app (free ECB-backed API, no auth required)
// Invalidates cache for all fetched rates
func (s *ExchangeRateService) FetchRatesFromAPI(tenantID uint, baseCurrency string) error {
	// Using the free frankfurter.app API (maintained by European Central Bank, no authentication required)
	url := fmt.Sprintf("https://api.frankfurter.app/latest?from=%s", baseCurrency)

	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("failed to fetch rates: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	var apiResp FrankfurterAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	// Get cache service for invalidation
	cache := GetCacheService(s.DB)

	// Store rates in database and invalidate cache
	for targetCurrency, rate := range apiResp.Rates {
		exchangeRate := models.ExchangeRate{
			TenantID:       tenantID,
			BaseCurrency:   baseCurrency,
			TargetCurrency: targetCurrency,
			Rate:           rate,
			Source:         models.RateSourceAPI,
		}

		if err := s.DB.Create(&exchangeRate).Error; err != nil {
			fmt.Printf("Error saving rate for %s/%s: %v\n", baseCurrency, targetCurrency, err)
			return fmt.Errorf("failed to save rate: %w", err)
		}

		// Invalidate cache for this rate
		cache.InvalidateExchangeRate(tenantID, baseCurrency, targetCurrency)
	}

	return nil
}

// UpdateRate manually sets a custom exchange rate
// Also invalidates the cache for this rate
func (s *ExchangeRateService) UpdateRate(tenantID uint, baseCurrency, targetCurrency string, rate float64) error {
	exchangeRate := models.ExchangeRate{
		TenantID:       tenantID,
		BaseCurrency:   baseCurrency,
		TargetCurrency: targetCurrency,
		Rate:           rate,
		Source:         models.RateSourceManual,
	}

	if err := s.DB.Create(&exchangeRate).Error; err != nil {
		return err
	}

	// Invalidate cache for this rate
	cache := GetCacheService(s.DB)
	cache.InvalidateExchangeRate(tenantID, baseCurrency, targetCurrency)

	return nil
}

// GetCurrentRate retrieves the most recent rate for a currency pair
// Uses cache for frequently accessed rates
func (s *ExchangeRateService) GetCurrentRate(tenantID uint, baseCurrency, targetCurrency string) (*models.ExchangeRate, error) {
	// Try cache first via cache service
	cache := GetCacheService(s.DB)
	return cache.GetExchangeRate(tenantID, baseCurrency, targetCurrency)
}

// GetAllCurrentRates gets the latest rate for each currency pair
func (s *ExchangeRateService) GetAllCurrentRates(tenantID uint) ([]models.ExchangeRate, error) {
	var rates []models.ExchangeRate

	// Get distinct currency pairs
	var pairs []struct {
		BaseCurrency   string
		TargetCurrency string
	}

	err := s.DB.Model(&models.ExchangeRate{}).
		Select("DISTINCT base_currency, target_currency").
		Where("tenant_id = ?", tenantID).
		Scan(&pairs).Error

	if err != nil {
		return nil, err
	}

	// Get latest rate for each pair
	for _, pair := range pairs {
		var rate models.ExchangeRate
		err := s.DB.Where("tenant_id = ? AND base_currency = ? AND target_currency = ?",
			tenantID, pair.BaseCurrency, pair.TargetCurrency).
			Order("created_at DESC").
			First(&rate).Error

		if err == nil {
			rates = append(rates, rate)
		}
	}

	return rates, nil
}

// GetRateHistory retrieves historical rates for charting
func (s *ExchangeRateService) GetRateHistory(tenantID uint, baseCurrency, targetCurrency string, days int) ([]models.ExchangeRate, error) {
	var rates []models.ExchangeRate

	startDate := time.Now().AddDate(0, 0, -days)

	err := s.DB.Where("tenant_id = ? AND base_currency = ? AND target_currency = ? AND created_at >= ?",
		tenantID, baseCurrency, targetCurrency, startDate).
		Order("created_at ASC").
		Find(&rates).Error

	return rates, err
}
