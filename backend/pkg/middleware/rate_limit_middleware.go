package middleware

import (
	"api/pkg/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// RateLimitConfig holds rate limit configuration per endpoint type
type RateLimitConfig struct {
	GeneralLimit     int           // Default limit for general endpoints
	GeneralWindow    time.Duration // Default window for general endpoints
	SensitiveLimit   int           // Stricter limit for sensitive endpoints (auth, payments)
	SensitiveWindow  time.Duration // Window for sensitive endpoints
	TenantMultiplier float64       // Multiplier for per-tenant limits (e.g., 2.0 = 2x normal limit)
}

// DefaultRateLimitConfig returns sensible defaults
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		GeneralLimit:     100,         // 100 requests
		GeneralWindow:    time.Minute, // per minute
		SensitiveLimit:   10,          // 10 requests
		SensitiveWindow:  time.Minute, // per minute
		TenantMultiplier: 1.5,         // 50% more for known tenants
	}
}

// RateLimiter manages rate limiting
type RateLimiter struct {
	db     *gorm.DB
	mu     sync.RWMutex
	cache  map[string]*rateLimitInfo
	config RateLimitConfig
}

type rateLimitInfo struct {
	count       int
	windowStart time.Time
}

var (
	globalLimiter *RateLimiter
	once          sync.Once
)

// GetRateLimiter returns the singleton rate limiter instance
func GetRateLimiter(db *gorm.DB) *RateLimiter {
	once.Do(func() {
		globalLimiter = &RateLimiter{
			db:     db,
			cache:  make(map[string]*rateLimitInfo),
			config: DefaultRateLimitConfig(),
		}
		// Start cleanup goroutine
		go globalLimiter.cleanupExpiredEntries()
	})
	return globalLimiter
}

// RateLimitMiddleware limits requests per IP/user
func RateLimitMiddleware(db *gorm.DB, limit int, window time.Duration) func(http.Handler) http.Handler {
	limiter := GetRateLimiter(db)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get identifier (IP address or user ID if authenticated)
			identifier := getClientIP(r)

			// Try to get user from context if authenticated
			if user, ok := r.Context().Value("user").(*models.User); ok {
				identifier = fmt.Sprintf("user_%d", user.ID)
			}

			// Check rate limit
			allowed, resetTime := limiter.checkRateLimit(identifier, limit, window)

			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", resetTime.Unix()))
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error":      "Too many requests",
					"message":    fmt.Sprintf("Rate limit exceeded. Try again after %s", resetTime.Format(time.RFC3339)),
					"retryAfter": resetTime.Unix(),
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// TenantRateLimitMiddleware limits requests per tenant with configurable limits
func TenantRateLimitMiddleware(db *gorm.DB, limit int, window time.Duration) func(http.Handler) http.Handler {
	limiter := GetRateLimiter(db)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get tenant from context
			var tenantID uint
			var identifier string

			if tenant, ok := r.Context().Value("tenant").(*models.Tenant); ok && tenant != nil {
				tenantID = tenant.ID
				// Apply tenant multiplier for verified tenants
				effectiveLimit := int(float64(limit) * limiter.config.TenantMultiplier)
				identifier = fmt.Sprintf("tenant_%d", tenantID)

				// Check tenant-specific limit
				allowed, resetTime := limiter.checkRateLimit(identifier, effectiveLimit, window)
				if !allowed {
					respondRateLimited(w, effectiveLimit, resetTime, "Tenant rate limit exceeded")
					return
				}
			}

			// Also check user-level limit
			if user, ok := r.Context().Value("user").(*models.User); ok {
				userIdentifier := fmt.Sprintf("tenant_%d_user_%d", tenantID, user.ID)
				allowed, resetTime := limiter.checkRateLimit(userIdentifier, limit, window)
				if !allowed {
					respondRateLimited(w, limit, resetTime, "User rate limit exceeded")
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// SensitiveEndpointRateLimitMiddleware applies stricter limits for sensitive endpoints
func SensitiveEndpointRateLimitMiddleware(db *gorm.DB) func(http.Handler) http.Handler {
	limiter := GetRateLimiter(db)
	config := limiter.config

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Determine identifier based on authentication status
			identifier := "ip_" + getClientIP(r)

			if user, ok := r.Context().Value("user").(*models.User); ok {
				identifier = fmt.Sprintf("sensitive_user_%d", user.ID)
			}

			allowed, resetTime := limiter.checkRateLimit(identifier, config.SensitiveLimit, config.SensitiveWindow)
			if !allowed {
				respondRateLimited(w, config.SensitiveLimit, resetTime, "Too many requests to sensitive endpoint")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// AuthRateLimitMiddleware specifically limits authentication attempts (login, register, password reset)
func AuthRateLimitMiddleware(db *gorm.DB, limit int, window time.Duration) func(http.Handler) http.Handler {
	limiter := GetRateLimiter(db)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			identifier := fmt.Sprintf("auth_ip_%s", ip)

			allowed, resetTime := limiter.checkRateLimit(identifier, limit, window)

			if !allowed {
				// Log potential brute force attempt
				go logSecurityEvent(db, ip, r.URL.Path, "rate_limit_exceeded")

				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", resetTime.Unix()))
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error":      "Too many authentication attempts",
					"message":    fmt.Sprintf("Please wait before trying again. Reset at %s", resetTime.Format(time.RFC3339)),
					"retryAfter": resetTime.Unix(),
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// PaymentRateLimitMiddleware limits payment-related operations
func PaymentRateLimitMiddleware(db *gorm.DB, limit int, window time.Duration) func(http.Handler) http.Handler {
	limiter := GetRateLimiter(db)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var identifier string

			// For payments, we want to limit by tenant + user
			if tenant, ok := r.Context().Value("tenant").(*models.Tenant); ok && tenant != nil {
				if user, ok := r.Context().Value("user").(*models.User); ok {
					identifier = fmt.Sprintf("payment_tenant_%d_user_%d", tenant.ID, user.ID)
				} else {
					identifier = fmt.Sprintf("payment_tenant_%d", tenant.ID)
				}
			} else {
				identifier = "payment_ip_" + getClientIP(r)
			}

			allowed, resetTime := limiter.checkRateLimit(identifier, limit, window)

			if !allowed {
				respondRateLimited(w, limit, resetTime, "Too many payment requests")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// checkRateLimit checks if request is allowed and returns reset time
func (rl *RateLimiter) checkRateLimit(identifier string, limit int, window time.Duration) (bool, time.Time) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	info, exists := rl.cache[identifier]

	if !exists || now.Sub(info.windowStart) > window {
		// New window
		rl.cache[identifier] = &rateLimitInfo{
			count:       1,
			windowStart: now,
		}
		return true, now.Add(window)
	}

	if info.count >= limit {
		// Rate limit exceeded
		resetTime := info.windowStart.Add(window)
		return false, resetTime
	}

	// Increment count
	info.count++
	return true, info.windowStart.Add(window)
}

// cleanupExpiredEntries periodically cleans up old entries from cache
func (rl *RateLimiter) cleanupExpiredEntries() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, info := range rl.cache {
			if now.Sub(info.windowStart) > 10*time.Minute {
				delete(rl.cache, key)
			}
		}
		rl.mu.Unlock()
	}
}

// getClientIP extracts the real client IP address
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip := r.RemoteAddr
	if colonIndex := strings.LastIndex(ip, ":"); colonIndex != -1 {
		ip = ip[:colonIndex]
	}
	return ip
}

// IPRateLimitMiddleware specifically limits by IP address
func IPRateLimitMiddleware(db *gorm.DB, limit int, window time.Duration) func(http.Handler) http.Handler {
	limiter := GetRateLimiter(db)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			identifier := fmt.Sprintf("ip_%s", ip)

			allowed, resetTime := limiter.checkRateLimit(identifier, limit, window)

			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", resetTime.Unix()))
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error":      "Too many requests from this IP",
					"message":    fmt.Sprintf("IP rate limit exceeded. Try again after %s", resetTime.Format(time.RFC3339)),
					"retryAfter": resetTime.Unix(),
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// =============================================================================
// Helper Functions
// =============================================================================

// respondRateLimited sends a rate limit exceeded response
func respondRateLimited(w http.ResponseWriter, limit int, resetTime time.Time, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
	w.Header().Set("X-RateLimit-Remaining", "0")
	w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", resetTime.Unix()))
	w.Header().Set("Retry-After", fmt.Sprintf("%d", int(time.Until(resetTime).Seconds())))
	w.WriteHeader(http.StatusTooManyRequests)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":      message,
		"message":    fmt.Sprintf("Rate limit exceeded. Try again after %s", resetTime.Format(time.RFC3339)),
		"retryAfter": resetTime.Unix(),
	})
}

// logSecurityEvent logs potential security events to the database
func logSecurityEvent(db *gorm.DB, ip string, endpoint string, eventType string) {
	// Create a rate limit entry in the database for auditing
	entry := &models.RateLimitEntry{
		Identifier:  fmt.Sprintf("security_%s_%s", eventType, ip),
		Endpoint:    endpoint,
		Count:       1,
		WindowStart: time.Now(),
	}

	// Use UpdateOrCreate pattern
	result := db.Where("identifier = ?", entry.Identifier).FirstOrCreate(entry)
	if result.RowsAffected == 0 {
		// Entry exists, increment count
		db.Model(entry).Update("count", gorm.Expr("count + 1"))
	}
}
