package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type TransferService struct {
	db                 *gorm.DB
	cashBalanceService *CashBalanceService
}

func NewTransferService(db *gorm.DB, cashBalanceService *CashBalanceService) *TransferService {
	return &TransferService{
		db:                 db,
		cashBalanceService: cashBalanceService,
	}
}

// CreateTransfer initiates a transfer from source branch to destination branch
func (s *TransferService) CreateTransfer(tenantID, sourceBranchID, destBranchID uint, amount float64, currency, description string, createdBy uint) (*models.Transfer, error) {
	if sourceBranchID == destBranchID {
		return nil, errors.New("cannot transfer to the same branch")
	}

	if amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	// Start transaction
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 1. Check sufficient funds in source branch
	// We need to check the balance first.
	// Note: CreateManualAdjustment doesn't strictly enforce non-negative balance,
	// but for transfers we should probably enforce it.
	balance, err := s.cashBalanceService.GetBalanceByCurrency(tenantID, &sourceBranchID, currency)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if balance.FinalBalance.LessThan(models.NewDecimal(amount)) {
		tx.Rollback()
		return nil, errors.New("insufficient funds in source branch")
	}

	// 2. Create Transfer record
	transfer := models.Transfer{
		TenantID:            tenantID,
		SourceBranchID:      sourceBranchID,
		DestinationBranchID: destBranchID,
		Amount:              amount,
		Currency:            currency,
		Status:              models.TransferStatusPending,
		Description:         description,
		CreatedByID:         createdBy,
	}

	if err := tx.Create(&transfer).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 3. Deduct from Source Branch immediately (Vault logic: money leaves the vault)
	// We use the cashBalanceService but we need to pass the transaction context if possible.
	// Since CashBalanceService doesn't accept a tx, we might have a consistency issue if we don't refactor.
	// Ideally CashBalanceService should accept a DB interface or we replicate logic here.
	// For now, let's assume we can use the service but we risk partial failure if the service succeeds but commit fails.
	// A better approach is to instantiate a new CashBalanceService with the tx.

	txCashService := NewCashBalanceService(tx)

	_, err = txCashService.CreateManualAdjustment(
		tenantID,
		&sourceBranchID,
		currency,
		-amount,
		fmt.Sprintf("Transfer OUT #%d to Branch %d", transfer.ID, destBranchID),
		createdBy,
	)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return &transfer, nil
}

// AcceptTransfer completes a pending transfer
func (s *TransferService) AcceptTransfer(transferID, tenantID, acceptedBy uint) (*models.Transfer, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var transfer models.Transfer
	if err := tx.First(&transfer, transferID).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if transfer.TenantID != tenantID {
		tx.Rollback()
		return nil, errors.New("unauthorized")
	}

	if transfer.Status != models.TransferStatusPending {
		tx.Rollback()
		return nil, errors.New("transfer is not pending")
	}

	// Update transfer status
	now := time.Now()
	transfer.Status = models.TransferStatusCompleted
	transfer.AcceptedByID = &acceptedBy
	transfer.AcceptedAt = &now

	if err := tx.Save(&transfer).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Add to Destination Branch
	txCashService := NewCashBalanceService(tx)
	_, err := txCashService.CreateManualAdjustment(
		tenantID,
		&transfer.DestinationBranchID,
		transfer.Currency,
		transfer.Amount,
		fmt.Sprintf("Transfer IN #%d from Branch %d", transfer.ID, transfer.SourceBranchID),
		acceptedBy,
	)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return &transfer, nil
}

// CancelTransfer cancels a pending transfer and refunds the source branch
func (s *TransferService) CancelTransfer(transferID, tenantID, cancelledBy uint) (*models.Transfer, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var transfer models.Transfer
	if err := tx.First(&transfer, transferID).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if transfer.TenantID != tenantID {
		tx.Rollback()
		return nil, errors.New("unauthorized")
	}

	if transfer.Status != models.TransferStatusPending {
		tx.Rollback()
		return nil, errors.New("transfer is not pending")
	}

	// Update transfer status
	transfer.Status = models.TransferStatusCancelled

	if err := tx.Save(&transfer).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Refund Source Branch
	txCashService := NewCashBalanceService(tx)
	_, err := txCashService.CreateManualAdjustment(
		tenantID,
		&transfer.SourceBranchID,
		transfer.Currency,
		transfer.Amount,
		fmt.Sprintf("Transfer #%d CANCELLED (Refund)", transfer.ID),
		cancelledBy,
	)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return &transfer, nil
}

// GetTransfers retrieves transfers with filtering
func (s *TransferService) GetTransfers(tenantID uint, branchID *uint, status string) ([]models.Transfer, error) {
	var transfers []models.Transfer

	query := s.db.Where("tenant_id = ?", tenantID)

	if branchID != nil {
		query = query.Where("source_branch_id = ? OR destination_branch_id = ?", *branchID, *branchID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Preload("SourceBranch").
		Preload("DestinationBranch").
		Preload("CreatedBy").
		Preload("AcceptedBy").
		Order("created_at DESC").
		Find(&transfers).Error

	return transfers, err
}
