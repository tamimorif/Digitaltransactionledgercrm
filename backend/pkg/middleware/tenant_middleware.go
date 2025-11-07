package middleware

import (
	"api/pkg/models"
	"context"
	"net/http"

	"gorm.io/gorm"
)

// TenantIsolationMiddleware ensures users can only access their tenant's data
func TenantIsolationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := r.Context().Value("user").(*models.User)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		// SuperAdmin can access all tenants
		if user.Role == models.RoleSuperAdmin {
			ctx := context.WithValue(r.Context(), "tenantId", nil) // nil means all tenants
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Regular users can only access their tenant's data
		if user.TenantID == nil {
			respondWithError(w, http.StatusForbidden, "User has no tenant assigned")
			return
		}

		ctx := context.WithValue(r.Context(), "tenantId", user.TenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ApplyTenantScope applies tenant filtering to GORM queries
func ApplyTenantScope(db *gorm.DB, r *http.Request) *gorm.DB {
	tenantID := r.Context().Value("tenantId")
	
	// If tenantId is nil (SuperAdmin), don't apply scope
	if tenantID == nil {
		return db
	}

	// Apply tenant filter
	if id, ok := tenantID.(*uint); ok && id != nil {
		return db.Where("tenant_id = ?", *id)
	}

	return db
}

// GetTenantID extracts tenant ID from context
func GetTenantID(r *http.Request) *uint {
	tenantID := r.Context().Value("tenantId")
	if tenantID == nil {
		return nil
	}

	if id, ok := tenantID.(*uint); ok {
		return id
	}

	return nil
}
