package models

import (
	"time"

	"gorm.io/gorm"
)

// ReceiptTemplate represents a customizable receipt template
type ReceiptTemplate struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID    uint   `gorm:"type:bigint;not null;index" json:"tenantId"`
	Name        string `gorm:"type:varchar(100);not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`

	// Template Type
	TemplateType string `gorm:"type:varchar(30);not null;default:'transaction'" json:"templateType"` // transaction, remittance, pickup, general

	// Template Content
	HeaderHTML string `gorm:"type:text" json:"headerHtml"` // Business name, logo, address
	BodyHTML   string `gorm:"type:text" json:"bodyHtml"`   // Main content area with variables
	FooterHTML string `gorm:"type:text" json:"footerHtml"` // Terms, signature, etc.
	StyleCSS   string `gorm:"type:text" json:"styleCss"`   // Custom CSS styling

	// Layout Settings
	PageSize     string `gorm:"type:varchar(20);default:'A4'" json:"pageSize"`          // A4, Letter, Receipt
	Orientation  string `gorm:"type:varchar(20);default:'portrait'" json:"orientation"` // portrait, landscape
	MarginTop    int    `gorm:"type:int;default:20" json:"marginTop"`
	MarginRight  int    `gorm:"type:int;default:20" json:"marginRight"`
	MarginBottom int    `gorm:"type:int;default:20" json:"marginBottom"`
	MarginLeft   int    `gorm:"type:int;default:20" json:"marginLeft"`

	// Logo
	LogoPath     string `gorm:"type:text" json:"logoPath"`
	LogoPosition string `gorm:"type:varchar(20);default:'center'" json:"logoPosition"` // left, center, right

	// Status
	IsDefault bool `gorm:"type:boolean;default:false" json:"isDefault"`
	IsActive  bool `gorm:"type:boolean;default:true" json:"isActive"`

	// Metadata
	Version   int            `gorm:"type:int;default:1" json:"version"`
	CreatedBy *uint          `gorm:"type:bigint" json:"createdBy"`
	UpdatedBy *uint          `gorm:"type:bigint" json:"updatedBy"`
	CreatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`

	// Relations
	Tenant *Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
}

func (ReceiptTemplate) TableName() string {
	return "receipt_templates"
}

// ReceiptVariable represents available template variables
// This is used for documentation/UI, not stored in DB
type ReceiptVariable struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Example     string `json:"example"`
	Category    string `json:"category"`
}

// GetTransactionVariables returns all available variables for transaction receipts
func GetTransactionVariables() []ReceiptVariable {
	return []ReceiptVariable{
		// Business Info
		{Name: "{{business.name}}", Description: "Business/Company name", Example: "Torontex Exchange", Category: "Business"},
		{Name: "{{business.address}}", Description: "Business address", Example: "123 King St W, Toronto", Category: "Business"},
		{Name: "{{business.phone}}", Description: "Business phone number", Example: "+1 416-555-1234", Category: "Business"},
		{Name: "{{business.email}}", Description: "Business email", Example: "info@torontex.com", Category: "Business"},
		{Name: "{{business.license}}", Description: "Business license number", Example: "MSB-12345", Category: "Business"},

		// Transaction Details
		{Name: "{{transaction.id}}", Description: "Transaction ID", Example: "TXN-20231220-0001", Category: "Transaction"},
		{Name: "{{transaction.date}}", Description: "Transaction date", Example: "December 20, 2023", Category: "Transaction"},
		{Name: "{{transaction.time}}", Description: "Transaction time", Example: "2:30 PM", Category: "Transaction"},
		{Name: "{{transaction.type}}", Description: "Transaction type", Example: "Exchange", Category: "Transaction"},
		{Name: "{{transaction.status}}", Description: "Transaction status", Example: "Completed", Category: "Transaction"},

		// Amounts
		{Name: "{{send.amount}}", Description: "Amount sent by customer", Example: "1000.00", Category: "Amounts"},
		{Name: "{{send.currency}}", Description: "Currency sent", Example: "CAD", Category: "Amounts"},
		{Name: "{{receive.amount}}", Description: "Amount received by customer", Example: "42,500,000", Category: "Amounts"},
		{Name: "{{receive.currency}}", Description: "Currency received", Example: "IRR", Category: "Amounts"},
		{Name: "{{exchange.rate}}", Description: "Exchange rate applied", Example: "42,500", Category: "Amounts"},
		{Name: "{{fee.amount}}", Description: "Service fee charged", Example: "15.00", Category: "Amounts"},
		{Name: "{{fee.currency}}", Description: "Fee currency", Example: "CAD", Category: "Amounts"},
		{Name: "{{total.amount}}", Description: "Total amount paid", Example: "1015.00", Category: "Amounts"},

		// Customer Info
		{Name: "{{customer.name}}", Description: "Customer full name", Example: "John Doe", Category: "Customer"},
		{Name: "{{customer.phone}}", Description: "Customer phone", Example: "+1 416-555-9999", Category: "Customer"},
		{Name: "{{customer.email}}", Description: "Customer email", Example: "john@example.com", Category: "Customer"},
		{Name: "{{customer.id}}", Description: "Customer ID", Example: "C-001234", Category: "Customer"},

		// Agent Info
		{Name: "{{agent.name}}", Description: "Agent name", Example: "Jane Smith", Category: "Agent"},
		{Name: "{{branch.name}}", Description: "Branch name", Example: "Downtown Branch", Category: "Agent"},
		{Name: "{{branch.address}}", Description: "Branch address", Example: "456 Bay St", Category: "Agent"},

		// Reference
		{Name: "{{reference.number}}", Description: "Reference number", Example: "REF-2023122001234", Category: "Reference"},
		{Name: "{{confirmation.code}}", Description: "Confirmation code", Example: "ABCD1234", Category: "Reference"},

		// Date/Time Formats
		{Name: "{{current.date}}", Description: "Current date", Example: "2023-12-20", Category: "DateTime"},
		{Name: "{{current.datetime}}", Description: "Current date and time", Example: "2023-12-20 14:30:00", Category: "DateTime"},
	}
}

// GetRemittanceVariables returns additional variables for remittance receipts
func GetRemittanceVariables() []ReceiptVariable {
	base := GetTransactionVariables()
	remittance := []ReceiptVariable{
		// Beneficiary
		{Name: "{{beneficiary.name}}", Description: "Beneficiary name", Example: "Ali Mohammadi", Category: "Beneficiary"},
		{Name: "{{beneficiary.phone}}", Description: "Beneficiary phone", Example: "+98 912-345-6789", Category: "Beneficiary"},
		{Name: "{{beneficiary.bank}}", Description: "Beneficiary bank", Example: "Bank Melli", Category: "Beneficiary"},
		{Name: "{{beneficiary.account}}", Description: "Account/IBAN", Example: "IR12 0170 0000 0012 3456 7890", Category: "Beneficiary"},
		{Name: "{{beneficiary.country}}", Description: "Destination country", Example: "Iran", Category: "Beneficiary"},

		// Remittance Status
		{Name: "{{remittance.status}}", Description: "Remittance status", Example: "Processing", Category: "Remittance"},
		{Name: "{{remittance.eta}}", Description: "Estimated delivery", Example: "1-2 business days", Category: "Remittance"},
		{Name: "{{pickup.location}}", Description: "Pickup location", Example: "Bank Mellat - Vanak Branch", Category: "Remittance"},
		{Name: "{{pickup.code}}", Description: "Pickup code", Example: "PU1234567890", Category: "Remittance"},
	}

	return append(base, remittance...)
}
