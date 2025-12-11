package middleware

import (
	"api/pkg/models"
	"api/pkg/services"
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"gorm.io/gorm"
)

// contextKey is a custom type for context keys to avoid collisions
type contextKey string

// Context key constants for type-safe context value storage
const (
	UserContextKey   contextKey = "user"
	ClaimsContextKey contextKey = "claims"
)

// GetUserFromContext safely retrieves the user from request context
func GetUserFromContext(r *http.Request) (*models.User, bool) {
	user, ok := r.Context().Value(UserContextKey).(*models.User)
	return user, ok
}

// GetClaimsFromContext safely retrieves the JWT claims from request context
func GetClaimsFromContext(r *http.Request) (*services.JWTClaims, bool) {
	claims, ok := r.Context().Value(ClaimsContextKey).(*services.JWTClaims)
	return claims, ok
}

// AuthMiddleware verifies JWT token and adds user to context
func AuthMiddleware(db *gorm.DB) func(http.Handler) http.Handler {
	authService := services.NewAuthService(db)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get token from Authorization header or fallback to query param (for WebSocket)
			tokenString := ""
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				// Check if it's a Bearer token
				parts := strings.Split(authHeader, " ")
				if len(parts) != 2 || parts[0] != "Bearer" {
					respondWithError(w, http.StatusUnauthorized, "Invalid authorization header format")
					return
				}

				tokenString = parts[1]
			} else {
				tokenString = r.URL.Query().Get("token")
				if tokenString == "" {
					respondWithError(w, http.StatusUnauthorized, "Authorization header required")
					return
				}
			}

			// Validate token
			claims, err := authService.ValidateJWT(tokenString)
			if err != nil {
				respondWithError(w, http.StatusUnauthorized, "Invalid or expired token")
				return
			}

			// Get user from database
			var user models.User
			if err := db.Preload("Tenant").First(&user, claims.UserID).Error; err != nil {
				respondWithError(w, http.StatusUnauthorized, "User not found")
				return
			}

			// Check if user is active
			if user.Status == models.StatusSuspended {
				respondWithError(w, http.StatusForbidden, "Account is suspended")
				return
			}

			// Add user to context using typed keys
			ctx := context.WithValue(r.Context(), UserContextKey, &user)
			ctx = context.WithValue(ctx, ClaimsContextKey, claims)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole middleware ensures user has the required role
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := GetUserFromContext(r)
			if !ok {
				respondWithError(w, http.StatusUnauthorized, "Unauthorized")
				return
			}

			// Check if user has allowed role
			hasRole := false
			for _, role := range allowedRoles {
				if user.Role == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				respondWithError(w, http.StatusForbidden, "Insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireSuperAdmin middleware ensures user is a super admin
func RequireSuperAdmin(next http.Handler) http.Handler {
	return RequireRole(models.RoleSuperAdmin)(next)
}

// RequireTenantOwner middleware ensures user is a tenant owner or super admin
func RequireTenantOwner(next http.Handler) http.Handler {
	return RequireRole(models.RoleSuperAdmin, models.RoleTenantOwner)(next)
}

// RequireFeature middleware checks if user has access to a specific feature
func RequireFeature(db *gorm.DB, feature string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := GetUserFromContext(r)
			if !ok {
				respondWithError(w, http.StatusUnauthorized, "Unauthorized")
				return
			}

			// SuperAdmin has access to everything
			if user.Role == models.RoleSuperAdmin {
				next.ServeHTTP(w, r)
				return
			}

			// Check role permissions
			var role models.Role
			if err := db.Where("name = ?", user.Role).First(&role).Error; err != nil {
				respondWithError(w, http.StatusForbidden, "Role not found")
				return
			}

			var permission models.RolePermission
			err := db.Where("role_id = ? AND feature = ?", role.ID, feature).First(&permission).Error
			if err != nil || !permission.CanAccess {
				respondWithError(w, http.StatusForbidden, "You don't have permission to access this feature")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func respondWithError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
