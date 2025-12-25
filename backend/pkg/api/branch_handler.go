package api

import (
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// BranchHandler handles branch-related requests
type BranchHandler struct {
	BranchService *services.BranchService
}

// NewBranchHandler creates a new branch handler
func NewBranchHandler(db *gorm.DB) *BranchHandler {
	return &BranchHandler{
		BranchService: services.NewBranchService(db),
	}
}

// CreateBranchHandler handles branch creation
// @Summary Create a new branch
// @Description Create a new branch for the tenant (requires tenant_owner role)
// @Tags branches
// @Accept json
// @Produce json
// @Param request body services.CreateBranchRequest true "Branch details"
// @Success 201 {object} models.Branch
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /branches [post]
func (bh *BranchHandler) CreateBranchHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Only tenant owner can create branches
	if user.Role != models.RoleTenantOwner {
		respondWithError(w, http.StatusForbidden, "Only organization owner can create branches")
		return
	}

	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User has no tenant assigned")
		return
	}

	// Parse request
	var req services.CreateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Create branch
	branch, err := bh.BranchService.CreateBranch(*user.TenantID, req, user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, branch)
}

// GetBranchesHandler retrieves all branches for the tenant
// @Summary Get all branches
// @Description Get all branches for the user's tenant
// @Tags branches
// @Produce json
// @Success 200 {array} models.Branch
// @Failure 500 {object} map[string]string
// @Router /branches [get]
func (bh *BranchHandler) GetBranchesHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.TenantID == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	branches, err := bh.BranchService.GetBranches(*user.TenantID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, branches)
}

// GetBranchHandler retrieves a single branch
// @Summary Get a branch
// @Description Get a specific branch by ID
// @Tags branches
// @Produce json
// @Param id path int true "Branch ID"
// @Success 200 {object} models.Branch
// @Failure 404 {object} map[string]string
// @Router /branches/{id} [get]
func (bh *BranchHandler) GetBranchHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.TenantID == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	branchID, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid branch ID")
		return
	}

	branch, err := bh.BranchService.GetBranchByID(uint(branchID), *user.TenantID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, branch)
}

// UpdateBranchHandler updates branch details
// @Summary Update a branch
// @Description Update branch details (requires tenant_owner role)
// @Tags branches
// @Accept json
// @Produce json
// @Param id path int true "Branch ID"
// @Param request body services.UpdateBranchRequest true "Updated branch details"
// @Success 200 {object} models.Branch
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /branches/{id} [put]
func (bh *BranchHandler) UpdateBranchHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.TenantID == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Only tenant owner can update branches
	if user.Role != models.RoleTenantOwner {
		respondWithError(w, http.StatusForbidden, "Only organization owner can update branches")
		return
	}

	vars := mux.Vars(r)
	branchID, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid branch ID")
		return
	}

	var req services.UpdateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	branch, err := bh.BranchService.UpdateBranch(uint(branchID), *user.TenantID, req)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, branch)
}

// DeactivateBranchHandler deactivates a branch
// @Summary Deactivate a branch
// @Description Deactivate a branch (requires tenant_owner role)
// @Tags branches
// @Param id path int true "Branch ID"
// @Success 200 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /branches/{id}/deactivate [post]
func (bh *BranchHandler) DeactivateBranchHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.TenantID == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Only tenant owner can deactivate branches
	if user.Role != models.RoleTenantOwner {
		respondWithError(w, http.StatusForbidden, "Only organization owner can deactivate branches")
		return
	}

	vars := mux.Vars(r)
	branchID, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid branch ID")
		return
	}

	if err := bh.BranchService.DeactivateBranch(uint(branchID), *user.TenantID); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Branch deactivated successfully"})
}

// AssignUserToBranchHandler assigns a user to a branch
// @Summary Assign user to branch
// @Description Assign a user to a branch with specified access level
// @Tags branches
// @Accept json
// @Produce json
// @Param id path int true "Branch ID"
// @Param request body map[string]interface{} true "Assignment details"
// @Success 200 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Router /branches/{id}/assign-user [post]
func (bh *BranchHandler) AssignUserToBranchHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.TenantID == nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Only tenant owner can assign users
	if user.Role != models.RoleTenantOwner {
		respondWithError(w, http.StatusForbidden, "Only organization owner can assign users to branches")
		return
	}

	vars := mux.Vars(r)
	branchID, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid branch ID")
		return
	}

	var req struct {
		UserID      uint   `json:"userId"`
		AccessLevel string `json:"accessLevel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := bh.BranchService.AssignUserToBranch(req.UserID, uint(branchID), req.AccessLevel); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "User assigned to branch successfully"})
}

// GetUserBranchesHandler gets all branches a user has access to
// @Summary Get user's branches
// @Description Get all branches the current user has access to
// @Tags branches
// @Produce json
// @Success 200 {array} models.Branch
// @Router /branches/my-branches [get]
func (bh *BranchHandler) GetUserBranchesHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	branches, err := bh.BranchService.GetUserBranches(user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, branches)
}

// SetBranchCredentialsHandler sets username and password for a branch
// @Summary Set branch credentials
// @Description Set or update username and password for branch login
// @Tags branches
// @Accept json
// @Produce json
// @Param id path int true "Branch ID"
// @Param request body object{username=string,password=string} true "Branch credentials"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Router /branches/{id}/credentials [put]
func (bh *BranchHandler) SetBranchCredentialsHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Only tenant owner or superadmin can set branch credentials
	if user.Role != models.RoleTenantOwner && user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only organization owner can set branch credentials")
		return
	}

	vars := mux.Vars(r)
	branchID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid branch ID")
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Username and password are required")
		return
	}

	if len(req.Password) < 6 {
		respondWithError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	// Get tenant ID from context or user
	var tenantID uint
	if tid, ok := r.Context().Value("tenant_id").(*uint); ok && tid != nil {
		tenantID = *tid
	} else if user.TenantID != nil {
		// For tenant_owner, get from user
		tenantID = *user.TenantID
	} else if user.Role == models.RoleSuperAdmin {
		// For superadmin, get tenant from the branch itself
		var branch models.Branch
		if err := bh.BranchService.DB.First(&branch, branchID).Error; err != nil {
			respondWithError(w, http.StatusNotFound, "Branch not found")
			return
		}
		tenantID = branch.TenantID
	} else {
		respondWithError(w, http.StatusUnauthorized, "Tenant ID not found")
		return
	}

	if err := bh.BranchService.SetBranchCredentials(uint(branchID), tenantID, req.Username, req.Password); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Branch credentials set successfully"})
}
