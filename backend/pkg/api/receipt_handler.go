package api

import (
	"api/pkg/services"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// ReceiptHandler handles receipt generation API requests
type ReceiptHandler struct {
	receiptService *services.ReceiptService
}

// NewReceiptHandler creates a new ReceiptHandler
func NewReceiptHandler(db *gorm.DB) *ReceiptHandler {
	return &ReceiptHandler{
		receiptService: services.NewReceiptService(db),
	}
}

// GetOutgoingRemittanceReceiptHandler generates a PDF receipt for an outgoing remittance
// @Summary Generate outgoing remittance receipt
// @Description Generates a PDF receipt for the specified outgoing remittance
// @Tags Receipts
// @Accept json
// @Produce application/pdf
// @Security BearerAuth
// @Param id path int true "Outgoing Remittance ID"
// @Success 200 {file} binary
// @Router /receipts/outgoing/{id} [get]
func (h *ReceiptHandler) GetOutgoingRemittanceReceiptHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)

	remittanceID, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid remittance ID", http.StatusBadRequest)
		return
	}

	pdfBytes, err := h.receiptService.GenerateOutgoingRemittanceReceipt(tenantID, uint(remittanceID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=receipt-"+vars["id"]+".pdf")
	w.Header().Set("Content-Length", strconv.Itoa(len(pdfBytes)))
	w.Write(pdfBytes)
}

// GetIncomingRemittanceReceiptHandler generates a PDF receipt for an incoming remittance
// @Summary Generate incoming remittance receipt
// @Description Generates a PDF receipt for the specified incoming remittance
// @Tags Receipts
// @Accept json
// @Produce application/pdf
// @Security BearerAuth
// @Param id path int true "Incoming Remittance ID"
// @Success 200 {file} binary
// @Router /receipts/incoming/{id} [get]
func (h *ReceiptHandler) GetIncomingRemittanceReceiptHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)

	remittanceID, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid remittance ID", http.StatusBadRequest)
		return
	}

	pdfBytes, err := h.receiptService.GenerateIncomingRemittanceReceipt(tenantID, uint(remittanceID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=receipt-"+vars["id"]+".pdf")
	w.Header().Set("Content-Length", strconv.Itoa(len(pdfBytes)))
	w.Write(pdfBytes)
}

// GetTransactionReceiptHandler generates a PDF receipt for a transaction
// @Summary Generate transaction receipt
// @Description Generates a PDF receipt for the specified transaction
// @Tags Receipts
// @Accept json
// @Produce application/pdf
// @Security BearerAuth
// @Param id path string true "Transaction ID"
// @Success 200 {file} binary
// @Router /receipts/transaction/{id} [get]
func (h *ReceiptHandler) GetTransactionReceiptHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)
	transactionID := vars["id"]

	pdfBytes, err := h.receiptService.GenerateTransactionReceipt(tenantID, transactionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=receipt-"+transactionID+".pdf")
	w.Header().Set("Content-Length", strconv.Itoa(len(pdfBytes)))
	w.Write(pdfBytes)
}
