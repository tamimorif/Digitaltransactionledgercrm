package strategies

import (
	"encoding/json"
	"errors"
)

// PaymentDetails defines the structure for different payment methods
type CashDetails struct {
	ReceivedBy string `json:"receivedBy"`
}

type BankTransferDetails struct {
	BankName      string `json:"bankName"`
	AccountNumber string `json:"accountNumber"`
	ReferenceID   string `json:"referenceId"`
}

type ChequeDetails struct {
	ChequeNumber string `json:"chequeNumber"`
	BankName     string `json:"bankName"`
	DueDate      string `json:"dueDate"`
}

type PaymentStrategy interface {
	Validate(details map[string]interface{}) error
}

// CashStrategy implementation
type CashStrategy struct{}

func (s *CashStrategy) Validate(details map[string]interface{}) error {
	// Cash might not need details, or optional
	return nil
}

// BankTransferStrategy implementation
type BankTransferStrategy struct{}

func (s *BankTransferStrategy) Validate(details map[string]interface{}) error {
	b, err := json.Marshal(details)
	if err != nil {
		return err
	}
	var d BankTransferDetails
	if err := json.Unmarshal(b, &d); err != nil {
		return err
	}
	if d.ReferenceID == "" {
		return errors.New("reference ID is required for bank transfer")
	}
	return nil
}

// ChequeStrategy implementation
type ChequeStrategy struct{}

func (s *ChequeStrategy) Validate(details map[string]interface{}) error {
	b, err := json.Marshal(details)
	if err != nil {
		return err
	}
	var d ChequeDetails
	if err := json.Unmarshal(b, &d); err != nil {
		return err
	}
	if d.ChequeNumber == "" {
		return errors.New("cheque number is required")
	}
	if d.BankName == "" {
		return errors.New("bank name is required")
	}
	return nil
}

// CardStrategy implementation
type CardDetails struct {
	LastFourDigits string `json:"lastFourDigits"`
	CardType       string `json:"cardType"` // VISA, MASTERCARD, etc.
	AuthCode       string `json:"authCode"`
}

type CardStrategy struct{}

func (s *CardStrategy) Validate(details map[string]interface{}) error {
	b, err := json.Marshal(details)
	if err != nil {
		return err
	}
	var d CardDetails
	if err := json.Unmarshal(b, &d); err != nil {
		return err
	}
	if d.LastFourDigits == "" || len(d.LastFourDigits) != 4 {
		return errors.New("valid last 4 digits required")
	}
	return nil
}

// Factory to get strategy
func GetPaymentStrategy(method string) PaymentStrategy {
	switch method {
	case "BANK_TRANSFER":
		return &BankTransferStrategy{}
	case "CHEQUE":
		return &ChequeStrategy{}
	case "CARD":
		return &CardStrategy{}
	default:
		return &CashStrategy{}
	}
}
