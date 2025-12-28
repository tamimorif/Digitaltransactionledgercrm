package services

import (
	"api/pkg/models"
	"fmt"
	"sync"
	"time"

	"gorm.io/gorm"
)

// CacheEntry represents a cached item with expiration
type CacheEntry struct {
	Value      interface{}
	ExpiresAt  time.Time
	LastAccess time.Time
}

// IsExpired checks if the cache entry has expired
func (e *CacheEntry) IsExpired() bool {
	return time.Now().After(e.ExpiresAt)
}

// CacheService provides in-memory caching for frequently accessed data
type CacheService struct {
	db            *gorm.DB
	mu            sync.RWMutex
	exchangeRates map[string]*CacheEntry // key: tenantID:baseCurrency:targetCurrency
	licenses      map[uint]*CacheEntry   // key: tenantID
	tenants       map[uint]*CacheEntry   // key: tenantID
	users         map[uint]*CacheEntry   // key: userID

	// Configuration
	exchangeRateTTL time.Duration
	licenseTTL      time.Duration
	tenantTTL       time.Duration
	userTTL         time.Duration
}

// CacheConfig holds cache configuration
type CacheConfig struct {
	ExchangeRateTTL time.Duration
	LicenseTTL      time.Duration
	TenantTTL       time.Duration
	UserTTL         time.Duration
}

// DefaultCacheConfig returns default cache configuration
func DefaultCacheConfig() CacheConfig {
	return CacheConfig{
		ExchangeRateTTL: 1 * time.Minute,  // Exchange rates cached for 1 minute
		LicenseTTL:      10 * time.Minute, // Licenses cached for 10 minutes
		TenantTTL:       15 * time.Minute, // Tenant info cached for 15 minutes
		UserTTL:         5 * time.Minute,  // User info cached for 5 minutes
	}
}

var (
	globalCacheService *CacheService
	cacheOnce          sync.Once
)

// ResetGlobalCacheService resets the singleton for testing
func ResetGlobalCacheService() {
	globalCacheService = nil
	cacheOnce = sync.Once{}
}

// GetCacheService returns the singleton cache service instance
func GetCacheService(db *gorm.DB) *CacheService {
	cacheOnce.Do(func() {
		config := DefaultCacheConfig()
		globalCacheService = &CacheService{
			db:              db,
			exchangeRates:   make(map[string]*CacheEntry),
			licenses:        make(map[uint]*CacheEntry),
			tenants:         make(map[uint]*CacheEntry),
			users:           make(map[uint]*CacheEntry),
			exchangeRateTTL: config.ExchangeRateTTL,
			licenseTTL:      config.LicenseTTL,
			tenantTTL:       config.TenantTTL,
			userTTL:         config.UserTTL,
		}
		// Start background cleanup
		go globalCacheService.cleanupLoop()
	})
	return globalCacheService
}

// NewCacheService creates a new cache service (for testing)
func NewCacheService(db *gorm.DB, config CacheConfig) *CacheService {
	return &CacheService{
		db:              db,
		exchangeRates:   make(map[string]*CacheEntry),
		licenses:        make(map[uint]*CacheEntry),
		tenants:         make(map[uint]*CacheEntry),
		users:           make(map[uint]*CacheEntry),
		exchangeRateTTL: config.ExchangeRateTTL,
		licenseTTL:      config.LicenseTTL,
		tenantTTL:       config.TenantTTL,
		userTTL:         config.UserTTL,
	}
}

// =============================================================================
// Exchange Rate Caching
// =============================================================================

// GetExchangeRate retrieves an exchange rate from cache or database
func (cs *CacheService) GetExchangeRate(tenantID uint, baseCurrency, targetCurrency string) (*models.ExchangeRate, error) {
	key := exchangeRateKey(tenantID, baseCurrency, targetCurrency)

	// Try cache first
	cs.mu.RLock()
	entry, exists := cs.exchangeRates[key]
	cs.mu.RUnlock()

	if exists && !entry.IsExpired() {
		entry.LastAccess = time.Now()
		if rate, ok := entry.Value.(*models.ExchangeRate); ok {
			return rate, nil
		}
	}

	// Fetch from database
	var rate models.ExchangeRate
	err := cs.db.Where("tenant_id = ? AND base_currency = ? AND target_currency = ?",
		tenantID, baseCurrency, targetCurrency).
		Order("created_at DESC").
		First(&rate).Error

	if err != nil {
		return nil, err
	}

	// Cache the result
	cs.mu.Lock()
	cs.exchangeRates[key] = &CacheEntry{
		Value:      &rate,
		ExpiresAt:  time.Now().Add(cs.exchangeRateTTL),
		LastAccess: time.Now(),
	}
	cs.mu.Unlock()

	return &rate, nil
}

// InvalidateExchangeRate removes an exchange rate from cache
func (cs *CacheService) InvalidateExchangeRate(tenantID uint, baseCurrency, targetCurrency string) {
	key := exchangeRateKey(tenantID, baseCurrency, targetCurrency)
	cs.mu.Lock()
	delete(cs.exchangeRates, key)
	cs.mu.Unlock()
}

// InvalidateAllExchangeRates clears all exchange rate cache for a tenant
func (cs *CacheService) InvalidateAllExchangeRates(tenantID uint) {
	prefix := exchangeRateTenantPrefix(tenantID)
	cs.mu.Lock()
	for key := range cs.exchangeRates {
		if len(key) > len(prefix) && key[:len(prefix)] == prefix {
			delete(cs.exchangeRates, key)
		}
	}
	cs.mu.Unlock()
}

// =============================================================================
// License Caching
// =============================================================================

// GetLicensesForTenant retrieves licenses from cache or database
func (cs *CacheService) GetLicensesForTenant(tenantID uint) ([]models.License, error) {
	// Try cache first
	cs.mu.RLock()
	entry, exists := cs.licenses[tenantID]
	cs.mu.RUnlock()

	if exists && !entry.IsExpired() {
		entry.LastAccess = time.Now()
		if licenses, ok := entry.Value.([]models.License); ok {
			return licenses, nil
		}
	}

	// Fetch from database
	var licenses []models.License
	err := cs.db.Where("tenant_id = ?", tenantID).
		Order("created_at DESC").
		Find(&licenses).Error

	if err != nil {
		return nil, err
	}

	// Cache the result
	cs.mu.Lock()
	cs.licenses[tenantID] = &CacheEntry{
		Value:      licenses,
		ExpiresAt:  time.Now().Add(cs.licenseTTL),
		LastAccess: time.Now(),
	}
	cs.mu.Unlock()

	return licenses, nil
}

// GetActiveLicense retrieves the active license for a tenant
func (cs *CacheService) GetActiveLicense(tenantID uint) (*models.License, error) {
	licenses, err := cs.GetLicensesForTenant(tenantID)
	if err != nil {
		return nil, err
	}

	for _, license := range licenses {
		if license.Status == models.LicenseStatusActive &&
			(license.ExpiresAt == nil || license.ExpiresAt.After(time.Now())) {
			return &license, nil
		}
	}

	return nil, gorm.ErrRecordNotFound
}

// InvalidateLicenseCache removes license cache for a tenant
func (cs *CacheService) InvalidateLicenseCache(tenantID uint) {
	cs.mu.Lock()
	delete(cs.licenses, tenantID)
	cs.mu.Unlock()
}

// =============================================================================
// Tenant Caching
// =============================================================================

// GetTenant retrieves a tenant from cache or database
func (cs *CacheService) GetTenant(tenantID uint) (*models.Tenant, error) {
	// Try cache first
	cs.mu.RLock()
	entry, exists := cs.tenants[tenantID]
	cs.mu.RUnlock()

	if exists && !entry.IsExpired() {
		entry.LastAccess = time.Now()
		if tenant, ok := entry.Value.(*models.Tenant); ok {
			return tenant, nil
		}
	}

	// Fetch from database
	var tenant models.Tenant
	err := cs.db.First(&tenant, tenantID).Error

	if err != nil {
		return nil, err
	}

	// Cache the result
	cs.mu.Lock()
	cs.tenants[tenantID] = &CacheEntry{
		Value:      &tenant,
		ExpiresAt:  time.Now().Add(cs.tenantTTL),
		LastAccess: time.Now(),
	}
	cs.mu.Unlock()

	return &tenant, nil
}

// InvalidateTenantCache removes tenant from cache
func (cs *CacheService) InvalidateTenantCache(tenantID uint) {
	cs.mu.Lock()
	delete(cs.tenants, tenantID)
	cs.mu.Unlock()
}

// =============================================================================
// User Caching
// =============================================================================

// GetUser retrieves a user from cache or database
func (cs *CacheService) GetUser(userID uint) (*models.User, error) {
	// Try cache first
	cs.mu.RLock()
	entry, exists := cs.users[userID]
	cs.mu.RUnlock()

	if exists && !entry.IsExpired() {
		entry.LastAccess = time.Now()
		if user, ok := entry.Value.(*models.User); ok {
			return user, nil
		}
	}

	// Fetch from database
	var user models.User
	err := cs.db.First(&user, userID).Error

	if err != nil {
		return nil, err
	}

	// Cache the result
	cs.mu.Lock()
	cs.users[userID] = &CacheEntry{
		Value:      &user,
		ExpiresAt:  time.Now().Add(cs.userTTL),
		LastAccess: time.Now(),
	}
	cs.mu.Unlock()

	return &user, nil
}

// InvalidateUserCache removes user from cache
func (cs *CacheService) InvalidateUserCache(userID uint) {
	cs.mu.Lock()
	delete(cs.users, userID)
	cs.mu.Unlock()
}

// =============================================================================
// Cache Management
// =============================================================================

// ClearAll clears all cached data
func (cs *CacheService) ClearAll() {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	cs.exchangeRates = make(map[string]*CacheEntry)
	cs.licenses = make(map[uint]*CacheEntry)
	cs.tenants = make(map[uint]*CacheEntry)
	cs.users = make(map[uint]*CacheEntry)
}

// Stats returns cache statistics
func (cs *CacheService) Stats() map[string]int {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	return map[string]int{
		"exchangeRates": len(cs.exchangeRates),
		"licenses":      len(cs.licenses),
		"tenants":       len(cs.tenants),
		"users":         len(cs.users),
	}
}

// cleanupLoop periodically removes expired entries
func (cs *CacheService) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		cs.cleanup()
	}
}

// cleanup removes expired entries from all caches
func (cs *CacheService) cleanup() {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	now := time.Now()

	// Cleanup exchange rates
	for key, entry := range cs.exchangeRates {
		if now.After(entry.ExpiresAt) {
			delete(cs.exchangeRates, key)
		}
	}

	// Cleanup licenses
	for key, entry := range cs.licenses {
		if now.After(entry.ExpiresAt) {
			delete(cs.licenses, key)
		}
	}

	// Cleanup tenants
	for key, entry := range cs.tenants {
		if now.After(entry.ExpiresAt) {
			delete(cs.tenants, key)
		}
	}

	// Cleanup users
	for key, entry := range cs.users {
		if now.After(entry.ExpiresAt) {
			delete(cs.users, key)
		}
	}
}

// =============================================================================
// Helper Functions
// =============================================================================

func exchangeRateKey(tenantID uint, baseCurrency, targetCurrency string) string {
	return fmt.Sprintf("%d:%s:%s", tenantID, baseCurrency, targetCurrency)
}

func exchangeRateTenantPrefix(tenantID uint) string {
	return fmt.Sprintf("%d:", tenantID)
}
