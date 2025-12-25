package middleware

import (
	"log"
	"net/http"
	"runtime/debug"
)

// PanicRecoveryMiddleware recovers from panics in HTTP handlers and returns a 500 error
// This prevents the entire server from crashing on unhandled panics
func PanicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				// Log the panic with stack trace
				log.Printf("🔥 PANIC RECOVERED: %v\n%s", err, debug.Stack())

				// Return 500 Internal Server Error
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"error":"Internal server error"}`))
			}
		}()

		next.ServeHTTP(w, r)
	})
}
