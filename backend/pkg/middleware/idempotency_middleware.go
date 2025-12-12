package middleware

import (
	"api/pkg/models"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// WithIdempotency wraps an http.Handler with IdempotencyMiddleware.
func WithIdempotency(db *gorm.DB, ttl time.Duration, next http.Handler) http.Handler {
	return IdempotencyMiddleware(db, ttl)(next)
}

// IdempotencyMiddleware provides DB-backed idempotency for unsafe methods (primarily POST).
//
// Contract:
// - Client sends: X-Idempotency-Key
// - Uniqueness is scoped by tenant + key + route template + method.
// - A completed response is replayed for subsequent identical requests.
// - If the same key is reused with a different request body, return 409.
func IdempotencyMiddleware(db *gorm.DB, ttl time.Duration) func(http.Handler) http.Handler {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				next.ServeHTTP(w, r)
				return
			}

			key := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
			if key == "" {
				next.ServeHTTP(w, r)
				return
			}

			tenantID := GetTenantID(r)
			if tenantID == nil {
				// Keep the behavior conservative for super-admin / unscoped requests.
				next.ServeHTTP(w, r)
				return
			}

			route := resolveRouteTemplate(r)

			// Read + restore body so downstream handlers can read it.
			bodyBytes, _ := io.ReadAll(r.Body)
			_ = r.Body.Close()
			r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

			sum := sha256.Sum256(bodyBytes)
			reqHash := hex.EncodeToString(sum[:])

			now := time.Now()

			rec := models.IdempotencyRecord{
				TenantID:     *tenantID,
				Key:          key,
				Route:        route,
				Method:       r.Method,
				RequestHash:  reqHash,
				State:        models.IdemStateInProgress,
				StatusCode:   0,
				ResponseBody: nil,
				CreatedAt:    now,
				ExpiresAt:    now.Add(ttl),
				CompletedAt:  nil,
			}

			if user, ok := r.Context().Value("user").(*models.User); ok && user != nil {
				rec.UserID = &user.ID
			}

			// Insert first to claim the key.
			createErr := db.Create(&rec).Error
			if createErr != nil {
				existing, err := loadIdempotencyRecord(db, *tenantID, key, route, r.Method)
				if err != nil {
					respondWithError(w, http.StatusInternalServerError, "Idempotency check failed")
					return
				}

				// Expired: delete and retry once.
				if existing.ExpiresAt.Before(now) {
					_ = db.Delete(&existing).Error
					retryErr := db.Create(&rec).Error
					if retryErr != nil {
						existing2, err2 := loadIdempotencyRecord(db, *tenantID, key, route, r.Method)
						if err2 != nil {
							respondWithError(w, http.StatusInternalServerError, "Idempotency check failed")
							return
						}
						existing = existing2
					} else {
						// Claimed successfully on retry.
						captureAndPersist(db, &rec, w, r, next)
						return
					}
				}

				// If same key with different request payload, return conflict.
				if existing.RequestHash != reqHash {
					respondWithError(w, http.StatusConflict, "Idempotency key reuse with different request")
					return
				}

				if existing.State == models.IdemStateInProgress {
					respondWithError(w, http.StatusConflict, "Request with this idempotency key is in progress")
					return
				}

				if existing.State == models.IdemStateCompleted {
					w.Header().Set("Content-Type", "application/json")
					if existing.StatusCode > 0 {
						w.WriteHeader(existing.StatusCode)
					} else {
						w.WriteHeader(http.StatusOK)
					}
					_, _ = w.Write(existing.ResponseBody)
					return
				}

				respondWithError(w, http.StatusConflict, "Idempotency key is not available")
				return
			}

			// Claimed successfully.
			captureAndPersist(db, &rec, w, r, next)
		})
	}
}

type captureResponseWriter struct {
	http.ResponseWriter
	statusCode int
	wroteHdr   bool
	buf        bytes.Buffer
}

func (w *captureResponseWriter) WriteHeader(statusCode int) {
	if w.wroteHdr {
		return
	}
	w.statusCode = statusCode
	w.wroteHdr = true
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *captureResponseWriter) Write(p []byte) (int, error) {
	if !w.wroteHdr {
		w.WriteHeader(http.StatusOK)
	}
	w.buf.Write(p)
	return w.ResponseWriter.Write(p)
}

func captureAndPersist(db *gorm.DB, rec *models.IdempotencyRecord, w http.ResponseWriter, r *http.Request, next http.Handler) {
	crw := &captureResponseWriter{ResponseWriter: w}
	next.ServeHTTP(crw, r)

	if crw.statusCode == 0 {
		crw.statusCode = http.StatusOK
	}

	// Only persist successful responses; allow retries on failures.
	if crw.statusCode >= 200 && crw.statusCode < 300 {
		completedAt := time.Now()
		updates := map[string]interface{}{
			"state":         models.IdemStateCompleted,
			"status_code":   crw.statusCode,
			"response_body": crw.buf.Bytes(),
			"completed_at":  &completedAt,
			"expires_at":    time.Now().Add(24 * time.Hour),
		}
		_ = db.Model(&models.IdempotencyRecord{}).Where("id = ?", rec.ID).Updates(updates).Error
		return
	}

	_ = db.Delete(&models.IdempotencyRecord{}, rec.ID).Error
}

func loadIdempotencyRecord(db *gorm.DB, tenantID uint, key, route, method string) (models.IdempotencyRecord, error) {
	var existing models.IdempotencyRecord
	err := db.Where("tenant_id = ? AND key = ? AND route = ? AND method = ?", tenantID, key, route, method).
		First(&existing).Error
	if err == nil {
		return existing, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.IdempotencyRecord{}, err
	}
	return models.IdempotencyRecord{}, err
}

func resolveRouteTemplate(r *http.Request) string {
	if rt := mux.CurrentRoute(r); rt != nil {
		if tpl, err := rt.GetPathTemplate(); err == nil && tpl != "" {
			return tpl
		}
	}
	return r.URL.Path
}
