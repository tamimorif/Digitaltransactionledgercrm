package migrations

import (
	"gorm.io/gorm"
)

// CreateRemittanceSettlementsTable creates the remittance_settlements table
func CreateRemittanceSettlementsTable(db *gorm.DB) error {
	type RemittanceSettlement struct {
		ID                   uint    `gorm:"primaryKey;autoIncrement"`
		TenantID             uint    `gorm:"not null;index"`
		OutgoingRemittanceID uint    `gorm:"not null;index"`
		IncomingRemittanceID uint    `gorm:"not null;index"`
		SettlementAmount     float64 `gorm:"type:decimal(15,2);not null"`
		SettlementCurrency   string  `gorm:"type:varchar(10);not null"`
		OutgoingRate         float64 `gorm:"type:decimal(10,4);not null"`
		IncomingRate         float64 `gorm:"type:decimal(10,4);not null"`
		OutgoingCADEquiv     float64 `gorm:"type:decimal(15,2)"`
		IncomingCADEquiv     float64 `gorm:"type:decimal(15,2)"`
		ProfitLoss           float64 `gorm:"type:decimal(15,2)"`
		SettledBy            *uint   `gorm:"index"`
		Notes                string  `gorm:"type:text"`
		CreatedAt            int64   `gorm:"autoCreateTime"`
		UpdatedAt            int64   `gorm:"autoUpdateTime"`
	}

	return db.AutoMigrate(&RemittanceSettlement{})
}

// AddSettlementFieldsToRemittances adds settlement tracking fields to remittances table
func AddSettlementFieldsToRemittances(db *gorm.DB) error {
	type Remittance struct {
		TotalSettledAmount float64 `gorm:"type:decimal(15,2);default:0"`
		RemainingAmount    float64 `gorm:"type:decimal(15,2)"`
		SettlementStatus   string  `gorm:"type:varchar(20);default:'pending'"`
	}

	return db.AutoMigrate(&Remittance{})
}
