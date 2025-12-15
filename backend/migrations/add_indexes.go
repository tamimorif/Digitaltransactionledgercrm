package migrations

import (
	"log"

	"gorm.io/gorm"
)

// AddIndexes adds performance indexes to common query patterns
func AddIndexes(db *gorm.DB) error {
	log.Println("Adding database indexes for performance...")

	// Outgoing Remittances - common query patterns
	indexes := []struct {
		table   string
		name    string
		columns string
	}{
		// Remittance indexes
		{"outgoing_remittances", "idx_outgoing_tenant_status_created", "tenant_id, status, created_at DESC"},
		{"outgoing_remittances", "idx_outgoing_tenant_remaining", "tenant_id, remaining_irr"},
		{"outgoing_remittances", "idx_outgoing_sender_phone", "sender_phone"},
		{"outgoing_remittances", "idx_outgoing_recipient_phone", "recipient_phone"},

		{"incoming_remittances", "idx_incoming_tenant_status_created", "tenant_id, status, created_at DESC"},
		{"incoming_remittances", "idx_incoming_tenant_remaining", "tenant_id, remaining_irr"},
		{"incoming_remittances", "idx_incoming_sender_phone", "sender_phone"},

		{"remittance_settlements", "idx_settlement_tenant_created", "tenant_id, created_at DESC"},
		{"remittance_settlements", "idx_settlement_outgoing", "outgoing_remittance_id"},
		{"remittance_settlements", "idx_settlement_incoming", "incoming_remittance_id"},

		// Transaction indexes
		{"transactions", "idx_txn_tenant_status_date", "tenant_id, status, transaction_date DESC"},
		{"transactions", "idx_txn_tenant_client", "tenant_id, client_id"},
		{"transactions", "idx_txn_tenant_branch", "tenant_id, branch_id"},
		{"transactions", "idx_txn_payment_status", "tenant_id, payment_status"},

		// Client indexes
		{"clients", "idx_client_tenant_phone", "tenant_id, phone_number"},
		{"clients", "idx_client_tenant_name", "tenant_id, name"},

		// Payment indexes
		{"payments", "idx_payment_tenant_txn", "tenant_id, transaction_id"},
		{"payments", "idx_payment_status", "tenant_id, status"},
		{"payments", "idx_payment_paid_at", "tenant_id, paid_at DESC"},

		// Ledger indexes
		{"ledger_entries", "idx_ledger_client_currency", "tenant_id, client_id, currency"},
		{"ledger_entries", "idx_ledger_created", "tenant_id, created_at DESC"},

		// Audit log indexes
		{"audit_logs", "idx_audit_tenant_created", "tenant_id, created_at DESC"},
		{"audit_logs", "idx_audit_entity", "tenant_id, entity_type, entity_id"},

		// Cash balance indexes
		{"cash_balances", "idx_cash_tenant_currency", "tenant_id, currency"},
		{"cash_balances", "idx_cash_branch", "tenant_id, branch_id"},

		// Pickup transaction indexes
		{"pickup_transactions", "idx_pickup_tenant_status", "tenant_id, status"},
		{"pickup_transactions", "idx_pickup_code", "pickup_code"},

		// Idempotency indexes
		{"idempotency_records", "idx_idem_expires", "expires_at"},
		{"idempotency_records", "idx_idem_state", "state"},
	}

	for _, idx := range indexes {
		// Check if table exists first
		if db.Migrator().HasTable(idx.table) {
			// Create index if it doesn't exist
			sql := "CREATE INDEX IF NOT EXISTS " + idx.name + " ON " + idx.table + " (" + idx.columns + ")"
			if err := db.Exec(sql).Error; err != nil {
				log.Printf("Warning: Failed to create index %s: %v", idx.name, err)
				// Continue with other indexes
			} else {
				log.Printf("Created index: %s on %s", idx.name, idx.table)
			}
		}
	}

	log.Println("Database indexes added successfully")
	return nil
}
