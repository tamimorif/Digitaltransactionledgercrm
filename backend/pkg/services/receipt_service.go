package services

import (
	"api/pkg/models"
	"bytes"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"
	"gorm.io/gorm"
)

// ReceiptService handles PDF receipt generation
type ReceiptService struct {
	db *gorm.DB
}

// NewReceiptService creates a new ReceiptService
func NewReceiptService(db *gorm.DB) *ReceiptService {
	return &ReceiptService{db: db}
}

// ReceiptData contains all data needed for a receipt
type ReceiptData struct {
	// Receipt Info
	ReceiptNumber string    `json:"receiptNumber"`
	ReceiptDate   time.Time `json:"receiptDate"`
	ReceiptType   string    `json:"receiptType"` // OUTGOING_REMITTANCE, INCOMING_REMITTANCE, TRANSACTION

	// Business Info
	BusinessName    string `json:"businessName"`
	BusinessAddress string `json:"businessAddress"`
	BranchName      string `json:"branchName"`
	StaffName       string `json:"staffName"`

	// Sender Info
	SenderName  string `json:"senderName"`
	SenderPhone string `json:"senderPhone"`
	SenderEmail string `json:"senderEmail,omitempty"`

	// Recipient Info
	RecipientName    string `json:"recipientName"`
	RecipientPhone   string `json:"recipientPhone,omitempty"`
	RecipientIBAN    string `json:"recipientIban,omitempty"`
	RecipientBank    string `json:"recipientBank,omitempty"`
	RecipientAddress string `json:"recipientAddress,omitempty"`

	// Amount Info
	SendAmount      float64 `json:"sendAmount"`
	SendCurrency    string  `json:"sendCurrency"`
	ReceiveAmount   float64 `json:"receiveAmount"`
	ReceiveCurrency string  `json:"receiveCurrency"`
	ExchangeRate    float64 `json:"exchangeRate"`
	Fee             float64 `json:"fee"`
	FeeCurrency     string  `json:"feeCurrency"`
	TotalPaid       float64 `json:"totalPaid"`
	TotalCurrency   string  `json:"totalCurrency"`

	// Additional
	Notes      string `json:"notes,omitempty"`
	QRCodeData string `json:"qrCodeData,omitempty"` // URL or data for QR code
	Disclaimer string `json:"disclaimer,omitempty"`
}

// GenerateOutgoingRemittanceReceipt generates a PDF receipt for an outgoing remittance
func (s *ReceiptService) GenerateOutgoingRemittanceReceipt(tenantID, remittanceID uint) ([]byte, error) {
	var remittance models.OutgoingRemittance
	if err := s.db.Preload("Branch").Preload("Creator").Preload("Tenant").
		Where("id = ? AND tenant_id = ?", remittanceID, tenantID).
		First(&remittance).Error; err != nil {
		return nil, err
	}

	// Get tenant info
	var tenant models.Tenant
	s.db.First(&tenant, tenantID)

	branchName := "Main Branch"
	if remittance.Branch != nil {
		branchName = remittance.Branch.Name
	}

	staffName := "Staff"
	if remittance.Creator != nil {
		staffName = remittance.Creator.Email
	}

	recipientPhone := ""
	if remittance.RecipientPhone != nil {
		recipientPhone = *remittance.RecipientPhone
	}
	recipientIBAN := ""
	if remittance.RecipientIBAN != nil {
		recipientIBAN = *remittance.RecipientIBAN
	}
	recipientBank := ""
	if remittance.RecipientBank != nil {
		recipientBank = *remittance.RecipientBank
	}

	data := ReceiptData{
		ReceiptNumber:   remittance.RemittanceCode,
		ReceiptDate:     remittance.CreatedAt,
		ReceiptType:     "OUTGOING_REMITTANCE",
		BusinessName:    tenant.Name,
		BranchName:      branchName,
		StaffName:       staffName,
		SenderName:      remittance.SenderName,
		SenderPhone:     remittance.SenderPhone,
		RecipientName:   remittance.RecipientName,
		RecipientPhone:  recipientPhone,
		RecipientIBAN:   recipientIBAN,
		RecipientBank:   recipientBank,
		SendAmount:      remittance.AmountIRR.Float64(),
		SendCurrency:    "IRR",
		ReceiveAmount:   remittance.ReceivedCAD.Float64(),
		ReceiveCurrency: "CAD",
		ExchangeRate:    remittance.BuyRateCAD.Float64(),
		Fee:             remittance.FeeCAD.Float64(),
		FeeCurrency:     "CAD",
		TotalPaid:       remittance.ReceivedCAD.Float64(),
		TotalCurrency:   "CAD",
		QRCodeData:      fmt.Sprintf("remittance:%s", remittance.RemittanceCode),
		Disclaimer:      "This receipt is for record keeping purposes. Please keep it safe.",
	}

	return s.generatePDF(data)
}

// GenerateIncomingRemittanceReceipt generates a PDF receipt for an incoming remittance
func (s *ReceiptService) GenerateIncomingRemittanceReceipt(tenantID, remittanceID uint) ([]byte, error) {
	var remittance models.IncomingRemittance
	if err := s.db.Preload("Branch").Preload("Creator").Preload("Tenant").
		Where("id = ? AND tenant_id = ?", remittanceID, tenantID).
		First(&remittance).Error; err != nil {
		return nil, err
	}

	var tenant models.Tenant
	s.db.First(&tenant, tenantID)

	branchName := "Main Branch"
	if remittance.Branch != nil {
		branchName = remittance.Branch.Name
	}

	staffName := "Staff"
	if remittance.Creator != nil {
		staffName = remittance.Creator.Email
	}

	recipientPhone := ""
	if remittance.RecipientPhone != nil {
		recipientPhone = *remittance.RecipientPhone
	}

	data := ReceiptData{
		ReceiptNumber:   remittance.RemittanceCode,
		ReceiptDate:     remittance.CreatedAt,
		ReceiptType:     "INCOMING_REMITTANCE",
		BusinessName:    tenant.Name,
		BranchName:      branchName,
		StaffName:       staffName,
		SenderName:      remittance.SenderName,
		SenderPhone:     remittance.SenderPhone,
		RecipientName:   remittance.RecipientName,
		RecipientPhone:  recipientPhone,
		SendAmount:      remittance.AmountIRR.Float64(),
		SendCurrency:    "IRR",
		ReceiveAmount:   remittance.EquivalentCAD.Float64(),
		ReceiveCurrency: "CAD",
		ExchangeRate:    remittance.SellRateCAD.Float64(),
		Fee:             remittance.FeeCAD.Float64(),
		FeeCurrency:     "CAD",
		TotalPaid:       remittance.PaidCAD.Float64(),
		TotalCurrency:   "CAD",
		QRCodeData:      fmt.Sprintf("remittance:%s", remittance.RemittanceCode),
	}

	return s.generatePDF(data)
}

// GenerateTransactionReceipt generates a PDF receipt for a transaction
func (s *ReceiptService) GenerateTransactionReceipt(tenantID uint, transactionID string) ([]byte, error) {
	var txn models.Transaction
	if err := s.db.Preload("Branch").Preload("Client").Preload("Tenant").
		Where("id = ? AND tenant_id = ?", transactionID, tenantID).
		First(&txn).Error; err != nil {
		return nil, err
	}

	var tenant models.Tenant
	s.db.First(&tenant, tenantID)

	branchName := "Main Branch"
	if txn.Branch != nil {
		branchName = txn.Branch.Name
	}

	beneficiaryName := ""
	if txn.BeneficiaryName != nil {
		beneficiaryName = *txn.BeneficiaryName
	}

	data := ReceiptData{
		ReceiptNumber:   txn.ID,
		ReceiptDate:     txn.TransactionDate,
		ReceiptType:     "TRANSACTION",
		BusinessName:    tenant.Name,
		BranchName:      branchName,
		SenderName:      txn.Client.Name,
		SenderPhone:     txn.Client.PhoneNumber,
		RecipientName:   beneficiaryName,
		SendAmount:      txn.SendAmount,
		SendCurrency:    txn.SendCurrency,
		ReceiveAmount:   txn.ReceiveAmount,
		ReceiveCurrency: txn.ReceiveCurrency,
		ExchangeRate:    txn.RateApplied,
		Fee:             txn.FeeCharged,
		FeeCurrency:     txn.SendCurrency,
		TotalPaid:       txn.SendAmount + txn.FeeCharged,
		TotalCurrency:   txn.SendCurrency,
		QRCodeData:      fmt.Sprintf("transaction:%s", txn.ID),
	}

	return s.generatePDF(data)
}

// generatePDF creates the actual PDF document
func (s *ReceiptService) generatePDF(data ReceiptData) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A5", "")
	pdf.SetMargins(10, 10, 10)
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 10, data.BusinessName, "", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 5, data.BranchName, "", 1, "C", false, 0, "")

	// Receipt Title
	pdf.Ln(5)
	pdf.SetFont("Arial", "B", 14)
	receiptTitle := "EXCHANGE RECEIPT"
	if data.ReceiptType == "OUTGOING_REMITTANCE" {
		receiptTitle = "REMITTANCE RECEIPT - رسید حواله"
	} else if data.ReceiptType == "INCOMING_REMITTANCE" {
		receiptTitle = "INCOMING RECEIPT - رسید دریافت"
	}
	pdf.CellFormat(0, 8, receiptTitle, "", 1, "C", false, 0, "")

	// Line separator
	pdf.Ln(3)
	pdf.Line(10, pdf.GetY(), 138, pdf.GetY())
	pdf.Ln(5)

	// Receipt Info
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(40, 6, "Receipt #:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, data.ReceiptNumber, "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(40, 6, "Date:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, data.ReceiptDate.Format("2006-01-02 15:04"), "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(40, 6, "Staff:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, data.StaffName, "", 1, "", false, 0, "")

	// Sender Section
	pdf.Ln(5)
	pdf.SetFillColor(240, 240, 240)
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 7, "SENDER / فرستنده", "1", 1, "C", true, 0, "")

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(40, 6, "Name:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, data.SenderName, "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(40, 6, "Phone:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, data.SenderPhone, "", 1, "", false, 0, "")

	// Recipient Section
	if data.RecipientName != "" {
		pdf.Ln(3)
		pdf.SetFont("Arial", "B", 11)
		pdf.CellFormat(0, 7, "RECIPIENT / گیرنده", "1", 1, "C", true, 0, "")

		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(40, 6, "Name:", "", 0, "", false, 0, "")
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(0, 6, data.RecipientName, "", 1, "", false, 0, "")

		if data.RecipientPhone != "" {
			pdf.SetFont("Arial", "B", 10)
			pdf.CellFormat(40, 6, "Phone:", "", 0, "", false, 0, "")
			pdf.SetFont("Arial", "", 10)
			pdf.CellFormat(0, 6, data.RecipientPhone, "", 1, "", false, 0, "")
		}

		if data.RecipientIBAN != "" {
			pdf.SetFont("Arial", "B", 10)
			pdf.CellFormat(40, 6, "IBAN:", "", 0, "", false, 0, "")
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(0, 6, data.RecipientIBAN, "", 1, "", false, 0, "")
		}

		if data.RecipientBank != "" {
			pdf.SetFont("Arial", "B", 10)
			pdf.CellFormat(40, 6, "Bank:", "", 0, "", false, 0, "")
			pdf.SetFont("Arial", "", 10)
			pdf.CellFormat(0, 6, data.RecipientBank, "", 1, "", false, 0, "")
		}
	}

	// Amount Section
	pdf.Ln(3)
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 7, "AMOUNT DETAILS / جزئیات مبلغ", "1", 1, "C", true, 0, "")

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(60, 6, "Amount:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("%s %.2f", data.SendCurrency, data.SendAmount), "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(60, 6, "Exchange Rate:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("%.4f", data.ExchangeRate), "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(60, 6, "Equivalent:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("%s %.2f", data.ReceiveCurrency, data.ReceiveAmount), "", 1, "", false, 0, "")

	if data.Fee > 0 {
		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(60, 6, "Fee:", "", 0, "", false, 0, "")
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(0, 6, fmt.Sprintf("%s %.2f", data.FeeCurrency, data.Fee), "", 1, "", false, 0, "")
	}

	// Total
	pdf.Ln(2)
	pdf.SetDrawColor(0, 0, 0)
	pdf.Line(10, pdf.GetY(), 138, pdf.GetY())
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(60, 8, "TOTAL PAID:", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 8, fmt.Sprintf("%s %.2f", data.TotalCurrency, data.TotalPaid), "", 1, "", false, 0, "")

	// Footer
	pdf.Ln(10)
	pdf.SetFont("Arial", "I", 8)
	if data.Disclaimer != "" {
		pdf.MultiCell(0, 4, data.Disclaimer, "", "C", false)
	}

	pdf.Ln(5)
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(0, 4, "Thank you for your business!", "", 1, "C", false, 0, "")
	pdf.CellFormat(0, 4, "با تشکر از اعتماد شما", "", 1, "C", false, 0, "")

	// Generate PDF bytes
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// GenerateReceiptBase64 generates a receipt and returns it as base64 string
func (s *ReceiptService) GenerateReceiptBase64(tenantID uint, entityType string, entityID interface{}) (string, error) {
	var pdfBytes []byte
	var err error

	switch entityType {
	case "outgoing_remittance":
		pdfBytes, err = s.GenerateOutgoingRemittanceReceipt(tenantID, entityID.(uint))
	case "incoming_remittance":
		pdfBytes, err = s.GenerateIncomingRemittanceReceipt(tenantID, entityID.(uint))
	case "transaction":
		pdfBytes, err = s.GenerateTransactionReceipt(tenantID, entityID.(string))
	default:
		return "", fmt.Errorf("unknown entity type: %s", entityType)
	}

	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(pdfBytes), nil
}
