package models

import (
	"time"

	"gorm.io/gorm"
)

// ComplianceStatus represents KYC/AML verification states
type ComplianceStatus string

const (
	ComplianceStatusPending   ComplianceStatus = "PENDING"   // Initial state, awaiting verification
	ComplianceStatusInReview  ComplianceStatus = "IN_REVIEW" // Documents submitted, under review
	ComplianceStatusApproved  ComplianceStatus = "APPROVED"  // Fully verified
	ComplianceStatusRejected  ComplianceStatus = "REJECTED"  // Verification failed
	ComplianceStatusExpired   ComplianceStatus = "EXPIRED"   // Verification expired, needs renewal
	ComplianceStatusSuspended ComplianceStatus = "SUSPENDED" // Temporarily suspended
)

// RiskLevel represents the AML risk classification
type RiskLevel string

const (
	RiskLevelLow    RiskLevel = "LOW"
	RiskLevelMedium RiskLevel = "MEDIUM"
	RiskLevelHigh   RiskLevel = "HIGH"
)

// CustomerCompliance tracks KYC/AML status for customers
type CustomerCompliance struct {
	ID         uint             `gorm:"primaryKey;autoIncrement" json:"id"`
	CustomerID uint             `gorm:"type:bigint;not null;uniqueIndex" json:"customerId"`
	TenantID   uint             `gorm:"type:bigint;not null;index" json:"tenantId"`
	Status     ComplianceStatus `gorm:"type:varchar(20);not null;default:'PENDING'" json:"status"`
	RiskLevel  RiskLevel        `gorm:"type:varchar(10);default:'LOW'" json:"riskLevel"`

	// Identity Verification
	IDType         string     `gorm:"type:varchar(30)" json:"idType"`   // passport, national_id, drivers_license
	IDNumber       string     `gorm:"type:varchar(50)" json:"idNumber"` // Encrypted/hashed
	IDExpiryDate   *time.Time `gorm:"type:date" json:"idExpiryDate"`
	IDVerifiedAt   *time.Time `gorm:"type:timestamp" json:"idVerifiedAt"`
	IDDocumentPath string     `gorm:"type:text" json:"idDocumentPath"` // Secure path to document
	SelfieDocPath  string     `gorm:"type:text" json:"selfieDocPath"`  // For liveness check

	// Address Verification
	AddressLine1        string     `gorm:"type:text" json:"addressLine1"`
	AddressLine2        string     `gorm:"type:text" json:"addressLine2"`
	City                string     `gorm:"type:varchar(100)" json:"city"`
	State               string     `gorm:"type:varchar(100)" json:"state"`
	PostalCode          string     `gorm:"type:varchar(20)" json:"postalCode"`
	Country             string     `gorm:"type:varchar(3)" json:"country"` // ISO country code
	AddressVerifiedAt   *time.Time `gorm:"type:timestamp" json:"addressVerifiedAt"`
	AddressDocumentPath string     `gorm:"type:text" json:"addressDocumentPath"`

	// Source of Funds
	SourceOfFunds      string `gorm:"type:text" json:"sourceOfFunds"`
	ExpectedVolume     string `gorm:"type:varchar(50)" json:"expectedVolume"` // e.g., "$1,000-5,000/month"
	PurposeOfTransfers string `gorm:"type:text" json:"purposeOfTransfers"`

	// External Verification Provider
	ExternalProviderID       string     `gorm:"type:varchar(100)" json:"externalProviderId"` // Sumsub/Onfido ID
	ExternalVerificationData string     `gorm:"type:json" json:"externalVerificationData"`
	ExternalVerifiedAt       *time.Time `gorm:"type:timestamp" json:"externalVerifiedAt"`

	// AML Screening
	AMLScreeningResult string     `gorm:"type:text" json:"amlScreeningResult"`
	PEPMatch           bool       `gorm:"type:boolean;default:false" json:"pepMatch"` // Politically Exposed Person
	SanctionsMatch     bool       `gorm:"type:boolean;default:false" json:"sanctionsMatch"`
	AdverseMediaMatch  bool       `gorm:"type:boolean;default:false" json:"adverseMediaMatch"`
	AMLScreenedAt      *time.Time `gorm:"type:timestamp" json:"amlScreenedAt"`
	AMLNotes           string     `gorm:"type:text" json:"amlNotes"`

	// Compliance Lifecycle
	ApprovedAt          *time.Time `gorm:"type:timestamp" json:"approvedAt"`
	ApprovedByUserID    *uint      `gorm:"type:bigint" json:"approvedByUserId"`
	RejectedAt          *time.Time `gorm:"type:timestamp" json:"rejectedAt"`
	RejectedByUserID    *uint      `gorm:"type:bigint" json:"rejectedByUserId"`
	RejectionReason     string     `gorm:"type:text" json:"rejectionReason"`
	ExpiresAt           *time.Time `gorm:"type:timestamp" json:"expiresAt"`
	RenewalReminderSent bool       `gorm:"type:boolean;default:false" json:"renewalReminderSent"`

	// Transaction Limits
	DailyLimit          float64 `gorm:"type:real;default:0" json:"dailyLimit"` // 0 = no limit
	MonthlyLimit        float64 `gorm:"type:real;default:0" json:"monthlyLimit"`
	PerTransactionLimit float64 `gorm:"type:real;default:0" json:"perTransactionLimit"`

	// Metadata
	Notes        string         `gorm:"type:text" json:"notes"`
	LastReviewAt *time.Time     `gorm:"type:timestamp" json:"lastReviewAt"`
	NextReviewAt *time.Time     `gorm:"type:timestamp" json:"nextReviewAt"`
	CreatedAt    time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt    time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`

	// Relations
	Customer *Customer `gorm:"foreignKey:CustomerID;constraint:OnDelete:CASCADE" json:"customer,omitempty"`
	Tenant   *Tenant   `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
}

func (CustomerCompliance) TableName() string {
	return "customer_compliance"
}

// ComplianceDocument tracks individual documents uploaded for verification
type ComplianceDocument struct {
	ID                   uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	CustomerComplianceID uint       `gorm:"type:bigint;not null;index" json:"customerComplianceId"`
	TenantID             uint       `gorm:"type:bigint;not null;index" json:"tenantId"`
	DocumentType         string     `gorm:"type:varchar(50);not null" json:"documentType"` // ID_FRONT, ID_BACK, SELFIE, ADDRESS_PROOF
	FileName             string     `gorm:"type:varchar(255);not null" json:"fileName"`
	FilePath             string     `gorm:"type:text;not null" json:"filePath"`
	FileSize             int64      `gorm:"type:bigint" json:"fileSize"`
	MimeType             string     `gorm:"type:varchar(100)" json:"mimeType"`
	Status               string     `gorm:"type:varchar(20);default:'PENDING'" json:"status"` // PENDING, APPROVED, REJECTED
	ReviewedAt           *time.Time `gorm:"type:timestamp" json:"reviewedAt"`
	ReviewedByUserID     *uint      `gorm:"type:bigint" json:"reviewedByUserId"`
	ReviewNotes          string     `gorm:"type:text" json:"reviewNotes"`
	UploadedAt           time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"uploadedAt"`

	// Relations
	CustomerCompliance *CustomerCompliance `gorm:"foreignKey:CustomerComplianceID;constraint:OnDelete:CASCADE" json:"compliance,omitempty"`
}

func (ComplianceDocument) TableName() string {
	return "compliance_documents"
}

// ComplianceAuditLog tracks all compliance-related actions for regulatory purposes
type ComplianceAuditLog struct {
	ID                   uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	CustomerComplianceID uint      `gorm:"type:bigint;not null;index" json:"customerComplianceId"`
	TenantID             uint      `gorm:"type:bigint;not null;index" json:"tenantId"`
	Action               string    `gorm:"type:varchar(50);not null" json:"action"` // STATUS_CHANGE, DOCUMENT_UPLOAD, REVIEW, etc.
	Description          string    `gorm:"type:text" json:"description"`
	PreviousValue        string    `gorm:"type:text" json:"previousValue"`
	NewValue             string    `gorm:"type:text" json:"newValue"`
	PerformedByUserID    *uint     `gorm:"type:bigint" json:"performedByUserId"`
	PerformedBySystem    bool      `gorm:"type:boolean;default:false" json:"performedBySystem"`
	IPAddress            string    `gorm:"type:varchar(45)" json:"ipAddress"`
	UserAgent            string    `gorm:"type:text" json:"userAgent"`
	CreatedAt            time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
}

func (ComplianceAuditLog) TableName() string {
	return "compliance_audit_logs"
}

// TransactionComplianceCheck records compliance checks performed on transactions
type TransactionComplianceCheck struct {
	ID               uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	TransactionID    uint       `gorm:"type:bigint;not null;index" json:"transactionId"`
	TenantID         uint       `gorm:"type:bigint;not null;index" json:"tenantId"`
	CheckType        string     `gorm:"type:varchar(50);not null" json:"checkType"` // AMOUNT_LIMIT, VOLUME_CHECK, SANCTIONS, etc.
	Result           string     `gorm:"type:varchar(20);not null" json:"result"`    // PASS, FAIL, REVIEW_REQUIRED
	Details          string     `gorm:"type:json" json:"details"`
	BlockedReason    string     `gorm:"type:text" json:"blockedReason"`
	ResolvedAt       *time.Time `gorm:"type:timestamp" json:"resolvedAt"`
	ResolvedByUserID *uint      `gorm:"type:bigint" json:"resolvedByUserId"`
	CreatedAt        time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
}

func (TransactionComplianceCheck) TableName() string {
	return "transaction_compliance_checks"
}
