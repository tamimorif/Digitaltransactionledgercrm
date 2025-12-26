package models

// This file is deprecated. Use disbursement.go instead.
// The PickupTransaction type alias is defined there for backward compatibility.

// Re-export legacy constants for backward compatibility
const (
	// Deprecated: Use DisbursementTypeCashPayout
	TransactionTypeCashPickup = LegacyTypeCashPickup
	// Deprecated: Use DisbursementTypeFXConversion
	TransactionTypeCashExchange = LegacyTypeCashExchange
	// Deprecated: Use DisbursementTypeBankTransfer
	TransactionTypeBankTransfer = "BANK_TRANSFER"
	// Deprecated: Use DisbursementTypeCardCredit
	TransactionTypeCardSwapIRR = LegacyTypeCardSwapIRR
	// Deprecated: Use DisbursementTypeIncomingFunds
	TransactionTypeIncomingFunds = "INCOMING_FUNDS"
)

// Deprecated pickup status constants - use DisbursementStatus* instead
const (
	PickupStatusPending   = DisbursementStatusPending
	PickupStatusPickedUp  = LegacyStatusPickedUp // Legacy value still in DB
	PickupStatusCancelled = DisbursementStatusCancelled
)
