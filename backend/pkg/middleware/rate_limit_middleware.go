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

// RateLimiter manages rate limiting
type RateLimiter struct {
	db    *gorm.DB
	mu    sync.RWMutex
	cache map[string]*rateLimitInfo
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
			db:    db,
			cache: make(map[string]*rateLimitInfo),
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
