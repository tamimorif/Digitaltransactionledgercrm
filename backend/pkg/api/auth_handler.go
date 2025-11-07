package api

import (
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"log"
	"net/http"

	"gorm.io/gorm"
)

// AuthHandler handles authentication-related requests
type AuthHandler struct {
	AuthService *services.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{
		AuthService: services.NewAuthService(db),
	}
}

// RegisterHandler handles user registration
// @Summary Register a new user
// @Description Register a new user and create a tenant
// @Tags auth
// @Accept json
// @Produce json
// @Param request body services.RegisterRequest true "Registration details"
// @Success 201 {object} map[string]interface{} "User created successfully"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/register [post]
func (ah *AuthHandler) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req services.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate request
	if req.Email == "" || req.Password == "" || req.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Email, password, and name are required")
		return
	}

	if len(req.Password) < 8 {
		respondWithError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	user, err := ah.AuthService.Register(req)
	if err != nil {
		log.Printf("Registration error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Registration successful. Please check your email for verification code.",
		"user": map[string]interface{}{
			"id":            user.ID,
			"email":         user.Email,
			"emailVerified": user.EmailVerified,
			"role":          user.Role,
			"tenantId":      user.TenantID,
			"trialEndsAt":   user.TrialEndsAt,
		},
	})
}

// VerifyEmailHandler handles email verification
// @Summary Verify user email
// @Description Verify user email with verification code
// @Tags auth
// @Accept json
// @Produce json
// @Param request body services.VerifyEmailRequest true "Verification details"
// @Success 200 {object} map[string]string "Email verified successfully"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/verify-email [post]
func (ah *AuthHandler) VerifyEmailHandler(w http.ResponseWriter, r *http.Request) {
	var req services.VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" || req.Code == "" {
		respondWithError(w, http.StatusBadRequest, "Email and code are required")
		return
	}

	if len(req.Code) != 6 {
		respondWithError(w, http.StatusBadRequest, "Code must be 6 digits")
		return
	}

	err := ah.AuthService.VerifyEmail(req)
	if err != nil {
		log.Printf("Email verification error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Email verified successfully. You can now login.",
	})
}

// ResendVerificationCodeHandler handles resending verification code
// @Summary Resend verification code
// @Description Resend verification code to user email
// @Tags auth
// @Accept json
// @Produce json
// @Param request body map[string]string true "Email"
// @Success 200 {object} map[string]string "Verification code sent"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/resend-code [post]
func (ah *AuthHandler) ResendVerificationCodeHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" {
		respondWithError(w, http.StatusBadRequest, "Email is required")
		return
	}

	err := ah.AuthService.ResendVerificationCode(req.Email)
	if err != nil {
		log.Printf("Resend code error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Verification code sent successfully.",
	})
}

// LoginHandler handles user login
// @Summary Login user
// @Description Authenticate user and return JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body services.LoginRequest true "Login credentials"
// @Success 200 {object} map[string]interface{} "Login successful"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/login [post]
func (ah *AuthHandler) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req services.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	token, user, err := ah.AuthService.Login(req)
	if err != nil {
		log.Printf("Login error: %v", err)
		respondWithError(w, http.StatusUnauthorized, err.Error())
		return
	}

	// Get tenant info if exists
	var tenantInfo map[string]interface{}
	if user.TenantID != nil && user.Tenant != nil {
		tenantInfo = map[string]interface{}{
			"id":        user.Tenant.ID,
			"name":      user.Tenant.Name,
			"status":    user.Tenant.Status,
			"userLimit": user.Tenant.UserLimit,
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Login successful",
		"token":   token,
		"user": map[string]interface{}{
			"id":            user.ID,
			"email":         user.Email,
			"role":          user.Role,
			"tenantId":      user.TenantID,
			"status":        user.Status,
			"trialEndsAt":   user.TrialEndsAt,
			"emailVerified": user.EmailVerified,
		},
		"tenant": tenantInfo,
	})
}

// GetMeHandler returns current user info (requires authentication)
// @Summary Get current user
// @Description Get authenticated user information
// @Tags auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.User "User info"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/me [get]
func (ah *AuthHandler) GetMeHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"id":            user.ID,
		"email":         user.Email,
		"role":          user.Role,
		"tenantId":      user.TenantID,
		"status":        user.Status,
		"trialEndsAt":   user.TrialEndsAt,
		"emailVerified": user.EmailVerified,
		"createdAt":     user.CreatedAt,
	})
}

// Helper functions
func respondWithJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

func respondWithError(w http.ResponseWriter, statusCode int, message string) {
	respondWithJSON(w, statusCode, map[string]string{"error": message})
}
