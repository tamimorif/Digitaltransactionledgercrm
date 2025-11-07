package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AuthService handles authentication operations
type AuthService struct {
	DB           *gorm.DB
	EmailService *EmailService
	JWTSecret    string
}

// NewAuthService creates a new auth service instance
func NewAuthService(db *gorm.DB) *AuthService {
	return &AuthService{
		DB:           db,
		EmailService: NewEmailService(),
		JWTSecret:    getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
	}
}

// JWTClaims represents the JWT token claims
type JWTClaims struct {
	UserID   uint   `json:"userId"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	TenantID *uint  `json:"tenantId"`
	jwt.RegisteredClaims
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

// VerifyEmailRequest represents an email verification request
type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register creates a new user and tenant, sends verification email
func (as *AuthService) Register(req RegisterRequest) (*models.User, error) {
	// Check if user already exists
	var existingUser models.User
	if err := as.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Generate verification code
	verificationCode, err := GenerateVerificationCode()
	if err != nil {
		return nil, fmt.Errorf("failed to generate verification code: %w", err)
	}

	codeExpiresAt := time.Now().Add(10 * time.Minute)

	// Start transaction
	tx := as.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create user
	trialEndsAt := time.Now().Add(7 * 24 * time.Hour) // 7 days trial
	user := &models.User{
		Email:            req.Email,
		PasswordHash:     string(hashedPassword),
		EmailVerified:    false,
		VerificationCode: &verificationCode,
		CodeExpiresAt:    &codeExpiresAt,
		Role:             models.RoleTenantOwner, // First user is owner of their tenant
		TrialEndsAt:      &trialEndsAt,
		Status:           models.StatusActive,
	}

	if err := tx.Create(user).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Create tenant for the user
	tenant := &models.Tenant{
		Name:      fmt.Sprintf("%s's Organization", req.Name),
		OwnerID:   user.ID,
		UserLimit: 1, // Trial: only 1 user
		Status:    models.TenantStatusTrial,
	}

	if err := tx.Create(tenant).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	// Update user's tenant ID
	user.TenantID = &tenant.ID
	if err := tx.Save(user).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update user tenant: %w", err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Send verification email (don't fail registration if email fails)
	if err := as.EmailService.SendVerificationEmail(user.Email, verificationCode); err != nil {
		log.Printf("Warning: Failed to send verification email: %v", err)
	}

	return user, nil
}

// VerifyEmail verifies a user's email with the provided code
func (as *AuthService) VerifyEmail(req VerifyEmailRequest) error {
	var user models.User
	if err := as.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if already verified
	if user.EmailVerified {
		return errors.New("email already verified")
	}

	// Check if code exists
	if user.VerificationCode == nil {
		return errors.New("no verification code found")
	}

	// Check if code expired
	if user.CodeExpiresAt != nil && time.Now().After(*user.CodeExpiresAt) {
		return errors.New("verification code expired")
	}

	// Verify code
	if *user.VerificationCode != req.Code {
		return errors.New("invalid verification code")
	}

	// Update user as verified
	user.EmailVerified = true
	user.VerificationCode = nil
	user.CodeExpiresAt = nil

	if err := as.DB.Save(&user).Error; err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	log.Printf("✅ Email verified successfully for user: %s", user.Email)
	return nil
}

// ResendVerificationCode resends a verification code
func (as *AuthService) ResendVerificationCode(email string) error {
	var user models.User
	if err := as.DB.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	if user.EmailVerified {
		return errors.New("email already verified")
	}

	// Generate new code
	verificationCode, err := GenerateVerificationCode()
	if err != nil {
		return fmt.Errorf("failed to generate verification code: %w", err)
	}

	codeExpiresAt := time.Now().Add(10 * time.Minute)
	user.VerificationCode = &verificationCode
	user.CodeExpiresAt = &codeExpiresAt

	if err := as.DB.Save(&user).Error; err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	// Send verification email
	if err := as.EmailService.SendVerificationEmail(user.Email, verificationCode); err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	return nil
}

// Login authenticates a user and returns a JWT token
func (as *AuthService) Login(req LoginRequest) (string, *models.User, error) {
	var user models.User
	if err := as.DB.Preload("Tenant").Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.New("invalid email or password")
		}
		return "", nil, fmt.Errorf("database error: %w", err)
	}

	// Check if email is verified
	if !user.EmailVerified {
		return "", nil, errors.New("email not verified. Please verify your email first")
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return "", nil, errors.New("invalid email or password")
	}

	// Check if account is active
	if user.Status == models.StatusSuspended {
		return "", nil, errors.New("account is suspended. Please contact support")
	}

	// Check trial expiration (if not SuperAdmin)
	if user.Role != models.RoleSuperAdmin && user.TenantID != nil {
		var tenant models.Tenant
		if err := as.DB.First(&tenant, user.TenantID).Error; err == nil {
			if tenant.Status == models.TenantStatusTrial && user.TrialEndsAt != nil && time.Now().After(*user.TrialEndsAt) {
				user.Status = models.StatusTrialExpired
				tenant.Status = models.TenantStatusExpired
				as.DB.Save(&user)
				as.DB.Save(&tenant)
				return "", nil, errors.New("trial period expired. Please activate a license")
			}
		}
	}

	// Generate JWT token
	token, err := as.GenerateJWT(&user)
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate token: %w", err)
	}

	log.Printf("✅ User logged in successfully: %s", user.Email)
	return token, &user, nil
}

// GenerateJWT generates a JWT token for a user
func (as *AuthService) GenerateJWT(user *models.User) (string, error) {
	claims := JWTClaims{
		UserID:   user.ID,
		Email:    user.Email,
		Role:     user.Role,
		TenantID: user.TenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)), // 24 hours
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "digital-transaction-ledger",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(as.JWTSecret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// ValidateJWT validates a JWT token and returns the claims
func (as *AuthService) ValidateJWT(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(as.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}
