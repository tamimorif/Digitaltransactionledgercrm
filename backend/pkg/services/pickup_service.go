package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"

	"gorm.io/gorm"
)

type PickupService struct {
	DB *gorm.DB
}

func NewPickupService(db *gorm.DB) *PickupService {
	return &PickupService{DB: db}
}

// generatePickupCode generates a unique 4-digit code with letter prefix (e.g., T-1234, B-2753)
func (s *PickupService) generatePickupCode(tenantID uint) (string, error) {
	maxAttempts := 10

	// Letters to use as prefix
	letters := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

	for attempt := 0; attempt < maxAttempts; attempt++ {
		// Create new random source for each attempt to ensure randomness
		source := rand.NewSource(time.Now().UnixNano() + int64(attempt))
		rng := rand.New(source)

		// Generate random letter prefix
		letterPrefix := string(letters[rng.Intn(len(letters))])

		// Generate 4-digit code (1000 to 9999)
		digits := rng.Intn(9000) + 1000

		// Combine: T-1234
		code := fmt.Sprintf("%s-%d", letterPrefix, digits)

		// Check if code exists for this tenant
		var count int64
		err := s.DB.Model(&models.PickupTransaction{}).
			Where("tenant_id = ? AND pickup_code = ?", tenantID, code).
			Count(&count).Error
		if err != nil {
			return "", err
		}

		if count == 0 {
			return code, nil
		}
	}

	return "", errors.New("failed to generate unique pickup code after multiple attempts")
}

// CreatePickupTransaction creates a new pickup transaction with auto-generated code
func (s *PickupService) CreatePickupTransaction(pickup *models.PickupTransaction) error {
	// Validate required fields
	if pickup.TenantID == 0 {
		return errors.New("tenant_id is required")
	}
	if pickup.SenderBranchID == 0 {
		return errors.New("sender_branch_id is required")
	}
	// Allow receiver to be omitted for in-person transactions (treat as same branch)
	// INCOMING_FUNDS transactions are always to the same branch (receiving money into own branch)
	inPerson := pickup.TransactionType == "CASH_PICKUP" || pickup.TransactionType == "CARD_SWAP_IRR" || pickup.TransactionType == "INCOMING_FUNDS"
	if pickup.ReceiverBranchID == 0 {
		if inPerson || pickup.TransactionType == "CASH_EXCHANGE" {
			pickup.ReceiverBranchID = pickup.SenderBranchID
		} else {
			return errors.New("receiver_branch_id is required")
		}
	}

	// Recipient name is optional for in-person exchanges (CASH_PICKUP, CARD_SWAP_IRR, INCOMING_FUNDS)
	// Required for transfers (CASH_EXCHANGE, BANK_TRANSFER)
	if !inPerson && pickup.RecipientName == "" {
		return errors.New("recipient_name is required")
	}

	// Phone is required for transfers (CASH_EXCHANGE), optional for in-person (CASH_PICKUP, CARD_SWAP_IRR, INCOMING_FUNDS) and BANK_TRANSFER
	if pickup.TransactionType == "CASH_EXCHANGE" {
		if pickup.RecipientPhone == nil || *pickup.RecipientPhone == "" {
			return errors.New("recipient_phone is required")
		}
	}

	// IBAN is required for BANK_TRANSFER
	if pickup.TransactionType == "BANK_TRANSFER" {
		if pickup.RecipientIBAN == nil || *pickup.RecipientIBAN == "" {
			return errors.New("recipient_iban is required for bank transfers")
		}
	}

	if pickup.Amount <= 0 {
		return errors.New("amount must be greater than zero")
	}
	if pickup.Currency == "" {
		return errors.New("currency is required")
	}

	// Validate branches exist and belong to tenant
	var senderBranch, receiverBranch models.Branch
	if err := s.DB.Where("id = ? AND tenant_id = ?", pickup.SenderBranchID, pickup.TenantID).First(&senderBranch).Error; err != nil {
		return errors.New("invalid sender_branch_id")
	}
	if err := s.DB.Where("id = ? AND tenant_id = ?", pickup.ReceiverBranchID, pickup.TenantID).First(&receiverBranch).Error; err != nil {
		return errors.New("invalid receiver_branch_id")
	}

	// Validate branches are active
	if senderBranch.Status != models.BranchStatusActive {
		return errors.New("sender branch is not active")
	}
	if receiverBranch.Status != models.BranchStatusActive {
		return errors.New("receiver branch is not active")
	}

	// For non in-person transfers, sender and receiver must be different.
	if !inPerson && pickup.SenderBranchID == pickup.ReceiverBranchID {
		return errors.New("sender and receiver branches must be different")
	}

	// Generate unique pickup code
	code, err := s.generatePickupCode(pickup.TenantID)
	if err != nil {
		return err
	}
	pickup.PickupCode = code

	// Set initial status
	pickup.Status = models.PickupStatusPending

	// Create pickup transaction
	if err := s.DB.Create(pickup).Error; err != nil {
		return err
	}

	return nil
}

// GetPickupTransactions retrieves pickup transactions with optional filters
func (s *PickupService) GetPickupTransactions(tenantID uint, branchID *uint, status *string, limit, offset int) ([]models.PickupTransaction, int64, error) {
	var pickups []models.PickupTransaction
	var total int64

	query := s.DB.Model(&models.PickupTransaction{}).Where("tenant_id = ?", tenantID)

	// Filter by branch (either sender or receiver)
	if branchID != nil {
		query = query.Where("sender_branch_id = ? OR receiver_branch_id = ?", *branchID, *branchID)
	}

	// Filter by status
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get paginated results with relations
	err := query.
		Preload("SenderBranch").
		Preload("ReceiverBranch").
		Preload("EditedByBranch").
		Preload("EditedByUser").
		Preload("PickedUpByUser").
		Preload("CancelledByUser").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&pickups).Error

	if err != nil {
		return nil, 0, err
	}

	return pickups, total, nil
}

// GetPickupTransactionByID retrieves a single pickup transaction by ID
func (s *PickupService) GetPickupTransactionByID(id uint, tenantID uint) (*models.PickupTransaction, error) {
	var pickup models.PickupTransaction
	err := s.DB.Where("id = ? AND tenant_id = ?", id, tenantID).
		Preload("SenderBranch").
		Preload("ReceiverBranch").
		Preload("EditedByBranch").
		Preload("EditedByUser").
		Preload("PickedUpByUser").
		Preload("CancelledByUser").
		First(&pickup).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("pickup transaction not found")
		}
		return nil, err
	}

	return &pickup, nil
}

// SearchPickupByCode searches for pickup transaction by code
func (s *PickupService) SearchPickupByCode(code string, tenantID uint) (*models.PickupTransaction, error) {
	var pickup models.PickupTransaction
	err := s.DB.Where("pickup_code = ? AND tenant_id = ?", code, tenantID).
		Preload("SenderBranch").
		Preload("ReceiverBranch").
		Preload("EditedByBranch").
		Preload("EditedByUser").
		Preload("PickedUpByUser").
		Preload("CancelledByUser").
		First(&pickup).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("pickup transaction not found with this code")
		}
		return nil, err
	}

	return &pickup, nil
}

// SearchPickupsByQuery searches pickups by phone number or name
func (s *PickupService) SearchPickupsByQuery(query string, tenantID uint) ([]models.PickupTransaction, error) {
	var pickups []models.PickupTransaction

	// Search by recipient phone, recipient name, sender phone, or sender name
	searchPattern := "%" + query + "%"
	err := s.DB.Where("tenant_id = ? AND (recipient_phone LIKE ? OR recipient_name LIKE ? OR sender_phone LIKE ? OR sender_name LIKE ?)",
		tenantID, searchPattern, searchPattern, searchPattern, searchPattern).
		Where("status = ?", models.PickupStatusPending).
		Preload("SenderBranch").
		Preload("ReceiverBranch").
		Preload("EditedByBranch").
		Preload("EditedByUser").
		Order("created_at DESC").
		Limit(20).
		Find(&pickups).Error

	if err != nil {
		return nil, err
	}

	return pickups, nil
}

// MarkAsPickedUp marks a pickup transaction as picked up
func (s *PickupService) MarkAsPickedUp(id uint, tenantID uint, userID uint) error {
	var pickup models.PickupTransaction
	if err := s.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&pickup).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("pickup transaction not found")
		}
		return err
	}

	// Validate status
	if pickup.Status != models.PickupStatusPending {
		return fmt.Errorf("cannot mark as picked up: current status is %s", pickup.Status)
	}

	// Update status
	now := time.Now()
	updates := map[string]interface{}{
		"status":               models.PickupStatusPickedUp,
		"picked_up_at":         &now,
		"picked_up_by_user_id": &userID,
		"updated_at":           now,
	}

	if err := s.DB.Model(&pickup).Updates(updates).Error; err != nil {
		return err
	}

	return nil
}

// CancelPickupTransaction cancels a pickup transaction
func (s *PickupService) CancelPickupTransaction(id uint, tenantID uint, userID uint, reason string) error {
	var pickup models.PickupTransaction
	if err := s.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&pickup).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("pickup transaction not found")
		}
		return err
	}

	// Validate status
	if pickup.Status != models.PickupStatusPending {
		return fmt.Errorf("cannot cancel: current status is %s", pickup.Status)
	}

	// Update status
	now := time.Now()
	updates := map[string]interface{}{
		"status":               models.PickupStatusCancelled,
		"cancelled_at":         &now,
		"cancelled_by_user_id": &userID,
		"cancellation_reason":  &reason,
		"updated_at":           now,
	}

	if err := s.DB.Model(&pickup).Updates(updates).Error; err != nil {
		return err
	}

	return nil
}

// EditPickupTransaction edits a pickup transaction (amount, currency, fees, etc.)
// EditPickupTransaction edits a pickup transaction (amount, currency, fees, etc.)
func (s *PickupService) EditPickupTransaction(id uint, tenantID uint, userID uint, branchID *uint, amount *float64, currency *string, receiverCurrency *string, exchangeRate *float64, receiverAmount *float64, fees *float64, allowPartialPayment *bool, editReason string) error {
	var pickup models.PickupTransaction
	if err := s.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&pickup).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("pickup transaction not found")
		}
		return err
	}

	// Only allow editing PENDING pickups
	if pickup.Status != models.PickupStatusPending {
		return fmt.Errorf("cannot edit: current status is %s (only PENDING pickups can be edited)", pickup.Status)
	}

	// Build updates map
	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}

	now := time.Now()
	updates["edited_at"] = &now
	updates["edited_by_user_id"] = &userID
	if branchID != nil {
		updates["edited_by_branch_id"] = branchID
	}
	updates["edit_reason"] = &editReason

	if amount != nil {
		updates["amount"] = *amount
	}
	if currency != nil {
		updates["currency"] = *currency
	}
	if receiverCurrency != nil {
		updates["receiver_currency"] = *receiverCurrency
	}
	if exchangeRate != nil {
		updates["exchange_rate"] = *exchangeRate
	}
	if receiverAmount != nil {
		updates["receiver_amount"] = *receiverAmount
	}
	if fees != nil {
		updates["fees"] = *fees
	}
	if allowPartialPayment != nil {
		updates["allow_partial_payment"] = *allowPartialPayment
		// If enabling partial payment, ensure payment status is initialized if nil
		if *allowPartialPayment && (pickup.PaymentStatus == nil || *pickup.PaymentStatus == "SINGLE") {
			status := "OPEN"
			updates["payment_status"] = &status
		} else if !*allowPartialPayment {
			// If disabling, revert to SINGLE
			status := "SINGLE"
			updates["payment_status"] = &status
		}
	}

	if err := s.DB.Model(&pickup).Updates(updates).Error; err != nil {
		return err
	}

	log.Printf("✏️ Pickup #%d edited by user #%d. Reason: %s", id, userID, editReason)
	return nil
}

// GetPendingPickupsCount returns count of pending pickups for a branch
func (s *PickupService) GetPendingPickupsCount(branchID uint, tenantID uint) (int64, error) {
	var count int64
	err := s.DB.Model(&models.PickupTransaction{}).
		Where("tenant_id = ? AND receiver_branch_id = ? AND status = ?",
			tenantID, branchID, models.PickupStatusPending).
		Count(&count).Error

	return count, err
}
