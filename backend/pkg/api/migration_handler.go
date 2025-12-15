package api

import (
	"log"
	"net/http"

	"api/pkg/models"

	"gorm.io/gorm"
)

// MigrationHandler handles one-time migration operations
type MigrationHandler struct {
	DB *gorm.DB
}

func NewMigrationHandler(db *gorm.DB) *MigrationHandler {
	return &MigrationHandler{DB: db}
}

// FixOwnerBranchHandler creates Head Office branches for owners without primary branches
// This is a one-time migration endpoint for existing accounts
// POST /api/migrations/fix-owner-branch
func (mh *MigrationHandler) FixOwnerBranchHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow tenant_owner to run this
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if user.Role != models.RoleTenantOwner {
		respondWithError(w, http.StatusForbidden, "Only owner can run migrations")
		return
	}

	// Check if this owner already has a primary branch
	if user.PrimaryBranchID != nil {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"message":  "You already have a primary branch",
			"branchId": *user.PrimaryBranchID,
		})
		return
	}

	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "No tenant associated with user")
		return
	}

	// Check if tenant already has branches
	var existingBranches []models.Branch
	if err := mh.DB.Where("tenant_id = ?", *user.TenantID).Find(&existingBranches).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check existing branches")
		return
	}

	var headOffice *models.Branch

	if len(existingBranches) > 0 {
		// Use first existing branch as Head Office
		headOffice = &existingBranches[0]

		updates := map[string]interface{}{
			"is_primary": true,
		}

		if headOffice.Name != "Head Office" {
			updates["name"] = "Head Office"
		}
		if headOffice.BranchCode == "" || headOffice.BranchCode != "HQ" {
			updates["branch_code"] = "HQ"
		}

		if err := mh.DB.Model(headOffice).Updates(updates).Error; err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to update existing branch")
			return
		}

		log.Printf("✅ Updated existing branch '%s' to Head Office for %s", existingBranches[0].Name, user.Email)
	} else {
		// Create new Head Office branch
		headOffice = &models.Branch{
			TenantID:   *user.TenantID,
			Name:       "Head Office",
			Location:   "",
			BranchCode: "HQ",
			IsPrimary:  true,
			Status:     models.BranchStatusActive,
		}

		if err := mh.DB.Create(headOffice).Error; err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to create Head Office")
			return
		}

		log.Printf("✅ Created new Head Office branch for %s", user.Email)
	}

	// Assign the branch to the owner
	if err := mh.DB.Model(user).Update("primary_branch_id", headOffice.ID).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to assign Head Office to owner")
		return
	}

	log.Printf("✅ Assigned Head Office (ID: %d) to owner %s (ID: %d)", headOffice.ID, user.Email, user.ID)

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Head Office branch created and assigned successfully",
		"branch": map[string]interface{}{
			"id":         headOffice.ID,
			"name":       headOffice.Name,
			"branchCode": headOffice.BranchCode,
			"isPrimary":  headOffice.IsPrimary,
		},
	})
}
