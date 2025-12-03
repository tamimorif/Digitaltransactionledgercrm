package validation

// CreateOutgoingRemittanceRequest represents the request to create an outgoing remittance
type CreateOutgoingRemittanceRequest struct {
	BranchID *uint `json:"branchId"`

	// Sender Info (in Canada)
	SenderName  string  `json:"senderName" validate:"required,min=2,max=255"`
	SenderPhone string  `json:"senderPhone" validate:"required,phone"`
	SenderEmail *string `json:"senderEmail" validate:"omitempty,email"`

	// Recipient Info (in Iran)
	RecipientName    string  `json:"recipientName" validate:"required,min=2,max=255"`
	RecipientPhone   *string `json:"recipientPhone" validate:"omitempty,phone"`
	RecipientIBAN    *string `json:"recipientIban" validate:"omitempty,iban_ir"`
	RecipientBank    *string `json:"recipientBank" validate:"omitempty,max=255"`
	RecipientAddress *string `json:"recipientAddress" validate:"omitempty,max=500"`

	// Amount Info
	AmountIRR   float64 `json:"amountIrr" validate:"required,gt=0"`
	BuyRateCAD  float64 `json:"buyRateCad" validate:"required,gt=0"`
	ReceivedCAD float64 `json:"receivedCad" validate:"required,gte=0"`
	FeeCAD      float64 `json:"feeCAD" validate:"gte=0"`

	// Notes
	Notes         *string `json:"notes" validate:"omitempty,max=1000"`
	InternalNotes *string `json:"internalNotes" validate:"omitempty,max=1000"`
}

// CreateIncomingRemittanceRequest represents the request to create an incoming remittance
type CreateIncomingRemittanceRequest struct {
	BranchID *uint `json:"branchId"`

	// Sender Info (in Iran)
	SenderName  string  `json:"senderName" validate:"required,min=2,max=255"`
	SenderPhone string  `json:"senderPhone" validate:"required,phone"`
	SenderIBAN  *string `json:"senderIban" validate:"omitempty,iban_ir"`
	SenderBank  *string `json:"senderBank" validate:"omitempty,max=255"`

	// Recipient Info (in Canada)
	RecipientName    string  `json:"recipientName" validate:"required,min=2,max=255"`
	RecipientPhone   *string `json:"recipientPhone" validate:"omitempty,phone"`
	RecipientEmail   *string `json:"recipientEmail" validate:"omitempty,email"`
	RecipientAddress *string `json:"recipientAddress" validate:"omitempty,max=500"`

	// Amount Info
	AmountIRR   float64 `json:"amountIrr" validate:"required,gt=0"`
	SellRateCAD float64 `json:"sellRateCad" validate:"required,gt=0"`
	FeeCAD      float64 `json:"feeCAD" validate:"gte=0"`

	// Payment Info
	PaymentMethod    string  `json:"paymentMethod" validate:"omitempty,payment_method"`
	PaymentReference *string `json:"paymentReference" validate:"omitempty,max=255"`

	// Notes
	Notes         *string `json:"notes" validate:"omitempty,max=1000"`
	InternalNotes *string `json:"internalNotes" validate:"omitempty,max=1000"`
}

// CreateSettlementRequest represents the request to create a settlement
type CreateSettlementRequest struct {
	OutgoingRemittanceID uint    `json:"outgoingRemittanceId" validate:"required,gt=0"`
	IncomingRemittanceID uint    `json:"incomingRemittanceId" validate:"required,gt=0"`
	AmountIRR            float64 `json:"amountIrr" validate:"required,gt=0"`
	Notes                *string `json:"notes" validate:"omitempty,max=1000"`
}

// AutoSettleRequest represents a request for auto-settlement
type AutoSettleRequest struct {
	IncomingRemittanceID uint   `json:"incomingRemittanceId" validate:"required,gt=0"`
	Strategy             string `json:"strategy" validate:"omitempty,oneof=FIFO LIFO BEST_RATE MANUAL"`
}

// CreateTransactionRequest represents the request to create a transaction
type CreateTransactionRequest struct {
	ClientID            string  `json:"clientId" validate:"required"`
	Type                string  `json:"type" validate:"required,oneof=CASH_EXCHANGE BANK_TRANSFER MONEY_PICKUP WALK_IN_CUSTOMER"`
	SendCurrency        string  `json:"sendCurrency" validate:"required,currency"`
	SendAmount          float64 `json:"sendAmount" validate:"required,gt=0"`
	ReceiveCurrency     string  `json:"receiveCurrency" validate:"required,currency"`
	ReceiveAmount       float64 `json:"receiveAmount" validate:"required,gt=0"`
	RateApplied         float64 `json:"rateApplied" validate:"required,gt=0"`
	FeeCharged          float64 `json:"feeCharged" validate:"gte=0"`
	BeneficiaryName     *string `json:"beneficiaryName" validate:"omitempty,max=255"`
	BeneficiaryDetails  *string `json:"beneficiaryDetails" validate:"omitempty,max=500"`
	UserNotes           *string `json:"userNotes" validate:"omitempty,max=1000"`
	AllowPartialPayment bool    `json:"allowPartialPayment"`
}

// CreatePaymentRequest represents the request to create a payment
type CreatePaymentRequest struct {
	Amount        float64 `json:"amount" validate:"required,gt=0"`
	Currency      string  `json:"currency" validate:"required,currency"`
	ExchangeRate  float64 `json:"exchangeRate" validate:"gt=0"`
	PaymentMethod string  `json:"paymentMethod" validate:"required,payment_method"`
	Notes         *string `json:"notes" validate:"omitempty,max=1000"`
	ReceiptNumber *string `json:"receiptNumber" validate:"omitempty,max=100"`
}

// CreateClientRequest represents the request to create a client
type CreateClientRequest struct {
	Name        string  `json:"name" validate:"required,min=2,max=255"`
	PhoneNumber string  `json:"phoneNumber" validate:"required,phone"`
	Email       *string `json:"email" validate:"omitempty,email"`
}

// UpdateClientRequest represents the request to update a client
type UpdateClientRequest struct {
	Name        string  `json:"name" validate:"required,min=2,max=255"`
	PhoneNumber string  `json:"phoneNumber" validate:"required,phone"`
	Email       *string `json:"email" validate:"omitempty,email"`
}
