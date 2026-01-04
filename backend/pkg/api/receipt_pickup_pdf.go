package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/gorilla/mux"
)

// GetPickupReceiptPDFHandler generates a static PDF receipt for a pickup transaction.
// @Summary Get pickup receipt PDF
// @Tags Receipts
// @Produce application/pdf
// @Router /receipts/pickup/{id}/pdf [get]
func (h *ReceiptHandler) GetPickupReceiptPDFHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	pickupID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid pickup ID", http.StatusBadRequest)
		return
	}

	var pickup models.PickupTransaction
	if err := h.db.
		Preload("SenderBranch").
		Preload("ReceiverBranch").
		Where("id = ? AND tenant_id = ?", pickupID, *tenantID).
		First(&pickup).Error; err != nil {
		http.Error(w, "Pickup transaction not found", http.StatusNotFound)
		return
	}

	companyName := "Digital Transaction Ledger"
	var tenant models.Tenant
	if err := h.db.Where("id = ?", *tenantID).First(&tenant).Error; err == nil && tenant.Name != "" {
		companyName = tenant.Name
	}

	receiverCurrency := pickup.Currency
	if pickup.ReceiverCurrency != nil && *pickup.ReceiverCurrency != "" {
		receiverCurrency = *pickup.ReceiverCurrency
	}
	exchangeRate := 1.0
	if pickup.ExchangeRate != nil {
		exchangeRate = *pickup.ExchangeRate
	}
	hasConversion := receiverCurrency != pickup.Currency
	pickupAmount := pickup.Amount
	if hasConversion {
		pickupAmount = pickup.Amount * exchangeRate
		if pickup.ReceiverAmount != nil {
			pickupAmount = *pickup.ReceiverAmount
		}
	}
	fees := pickup.Fees
	totalCost := pickup.Amount + fees

	statusLabel := "Pending"
	switch strings.ToUpper(pickup.Status) {
	case "PICKED_UP", "COMPLETED", "DISBURSED":
		statusLabel = "Completed"
	case "CANCELLED":
		statusLabel = "Cancelled"
	}

	// --- B&W PDF GENERATION STARTS HERE ---

	// Setup A4 Page with standard margins
	pdf := fpdf.New("P", "mm", "A4", "")
	margin := 20.0
	pdf.SetMargins(margin, margin, margin)
	pdf.SetAutoPageBreak(true, margin)
	pdf.SetTitle("Pickup Receipt "+pickup.PickupCode, false)
	pdf.AddPage()

	// Ensure pure black text everywhere
	pdf.SetTextColor(0, 0, 0)

	// Helper to draw a simple, thin black divider line
	drawDivider := func() {
		pdf.Ln(4)
		x := pdf.GetX()
		y := pdf.GetY()
		pdf.SetDrawColor(0, 0, 0)
		pdf.SetLineWidth(0.1) // Very thin line to save ink
		pdf.Line(x, y, x+170, y)
		pdf.Ln(6)
	}

	// Helper to draw key-value pairs (Label: **Value**)
	drawPair := func(label, value string, boldValue bool) {
		// Label (Regular font)
		pdf.SetFont("Helvetica", "", 10)
		pdf.CellFormat(50, 6, label, "", 0, "L", false, 0, "")

		// Value (Bold font for emphasis instead of color)

		// Value (Bold font for emphasis instead of color)
		style := ""
		if boldValue {
			style = "B"
		}
		pdf.SetFont("Helvetica", style, 10)

		// Use MultiCell handle long values cleanly

		y := pdf.GetY()
		pdf.MultiCell(0, 6, value, "", "L", false)
		if pdf.GetY() > y+6 {
			pdf.SetY(pdf.GetY())
		} else {
			pdf.Ln(6)
		}
	}

	// --- Header Section ---
	// Centered header looks professional on simple documents
	pdf.SetFont("Helvetica", "B", 18)
	pdf.CellFormat(0, 10, companyName, "", 1, "C", false, 0, "")

	pdf.SetFont("Helvetica", "B", 14)
	pdf.CellFormat(0, 8, "PICKUP RECEIPT", "", 1, "C", false, 0, "")

	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 6, "Date: "+time.Now().Format("Jan 02, 2006 15:04"), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	drawDivider()

	// --- Key Identifiers ---
	// Use size and bold for hierarchy instead of colored banners
	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(45, 8, "Transaction Code:")
	pdf.SetFont("Helvetica", "B", 14)
	pdf.Cell(0, 8, pickup.PickupCode)
	pdf.Ln(8)

	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(45, 8, "Status:")
	pdf.SetFont("Helvetica", "B", 12)
	pdf.Cell(0, 8, strings.ToUpper(statusLabel))
	pdf.Ln(10)

	// --- Transaction Details Section ---
	pdf.SetFont("Helvetica", "B", 12)
	pdf.Cell(0, 8, "TRANSACTION DETAILS")
	pdf.Ln(8)

	drawPair("Send Amount:", formatMoney(pickup.Amount, pickup.Currency), true)
	drawPair("Exchange Rate:", fmt.Sprintf("%.4f", exchangeRate), true)
	drawPair("Service Fee:", formatMoney(fees, pickup.Currency), true)
	// Add a small gap before total
	pdf.Ln(2)
	drawPair("Total Cost:", formatMoney(totalCost, pickup.Currency), true)
	pdf.Ln(8)

	drawDivider()

	// --- Participants Section (Side-by-Side Columns) ---
	startY := pdf.GetY()
	halfWidth := 85.0 // 170mm usable width / 2

	// Column 1: Sender
	pdf.SetFont("Helvetica", "B", 12)
	pdf.Cell(halfWidth, 8, "SENDER")
	pdf.Ln(8)
	// Temporarily set right margin for column 1
	pdf.SetRightMargin(margin + halfWidth)

	pdf.SetFont("Helvetica", "B", 10)
	pdf.MultiCell(0, 5, pickup.SenderName, "", "L", false)
	pdf.Ln(1)
	pdf.SetFont("Helvetica", "", 10)
	if phone := safeString(pickup.SenderPhone, ""); phone != "" {
		pdf.MultiCell(0, 5, phone, "", "L", false)
	}
	pdf.MultiCell(0, 5, safeString(branchName(pickup.SenderBranch), "Branch: N/A"), "", "L", false)

	// Column 2: Receiver
	// Reset margins and move cursor to the right
	pdf.SetRightMargin(margin)
	pdf.SetXY(margin+halfWidth, startY)

	pdf.SetFont("Helvetica", "B", 12)
	pdf.Cell(0, 8, "RECEIVER")
	pdf.Ln(8)
	pdf.SetX(margin + halfWidth) // Indent subsequent lines

	pdf.SetFont("Helvetica", "B", 10)
	pdf.MultiCell(0, 5, pickup.RecipientName, "", "L", false)
	pdf.Ln(1)
	pdf.SetX(margin + halfWidth)
	pdf.SetFont("Helvetica", "", 10)
	if phone := safeString(pointerToString(pickup.RecipientPhone), ""); phone != "" {
		pdf.MultiCell(0, 5, phone, "", "L", false)
		pdf.SetX(margin + halfWidth)
	}
	pdf.MultiCell(0, 5, safeString(branchName(pickup.ReceiverBranch), "Branch: N/A"), "", "L", false)

	// Move cursor below the tallest column
	pdf.SetY(pdf.GetY() + 15)

	drawDivider()

	// --- The "Hero" Pickup Amount Section ---
	// Simple, large, bold text. No boxes, no fills.
	// Centered for emphasis.
	pdf.SetFont("Helvetica", "B", 14)
	pdf.CellFormat(0, 10, "TOTAL PICKUP AMOUNT", "", 1, "C", false, 0, "")

	pdf.SetFont("Helvetica", "B", 28) // Very large font for the final number
	// Using the receiver currency symbol if available, otherwise code
	pdf.CellFormat(0, 15, formatMoney(pickupAmount, receiverCurrency), "", 1, "C", false, 0, "")
	pdf.Ln(10)

	drawDivider()

	// --- Notes Section ---
	if pickup.Notes != nil && strings.TrimSpace(*pickup.Notes) != "" {
		pdf.SetFont("Helvetica", "B", 10)
		pdf.Cell(0, 6, "NOTES")
		pdf.Ln(6)
		pdf.SetFont("Helvetica", "", 10)
		pdf.MultiCell(0, 5, strings.TrimSpace(*pickup.Notes), "", "L", false)
		pdf.Ln(8)
		drawDivider()
	}

	// --- Footer ---
	// Simple, small text at the bottom
	pdf.SetFont("Helvetica", "", 8)
	pdf.CellFormat(0, 4, "Created: "+pickup.CreatedAt.Format("Jan 02, 2006 15:04:05"), "", 1, "C", false, 0, "")
	pdf.CellFormat(0, 4, "Keep this receipt for your records.", "", 1, "C", false, 0, "")
	pdf.CellFormat(0, 4, "Thank you for your business!", "", 1, "C", false, 0, "")

	// --- Output ---
	var buffer bytes.Buffer
	if err := pdf.Output(&buffer); err != nil {
		fmt.Printf("Error generating PDF: %v\n", err) // Log the specific error
		http.Error(w, fmt.Sprintf("Failed to generate PDF: %v", err), http.StatusInternalServerError)
		return
	}

	filename := fmt.Sprintf("pickup_receipt_%s.pdf", pickup.PickupCode)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+filename+"\"")
	w.WriteHeader(http.StatusOK)
	w.Write(buffer.Bytes())
}

// --- Helper Functions (Keep these as they were) ---

func formatMoney(value float64, currency string) string {
	return fmt.Sprintf("%s %s", formatAmount(value), currency)
}

func formatAmount(value float64) string {
	formatted := fmt.Sprintf("%.2f", value)
	parts := strings.SplitN(formatted, ".", 2)
	integer := parts[0]
	decimal := "00"
	if len(parts) == 2 {
		decimal = parts[1]
	}

	negative := strings.HasPrefix(integer, "-")
	if negative {
		integer = strings.TrimPrefix(integer, "-")
	}

	var out strings.Builder
	for i, r := range integer {
		if i > 0 && (len(integer)-i)%3 == 0 {
			out.WriteByte(',')
		}
		out.WriteRune(r)
	}

	result := out.String() + "." + decimal
	if negative {
		return "-" + result
	}
	return result
}

func pointerToString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func safeString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func branchName(branch *models.Branch) string {
	if branch == nil {
		return ""
	}
	return branch.Name
}
