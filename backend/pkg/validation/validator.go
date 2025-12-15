package validation

import (
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
)

// Validator is the global validator instance
var Validator *validator.Validate

func init() {
	Validator = validator.New()

	// Register custom validators
	Validator.RegisterValidation("phone", validatePhone)
	Validator.RegisterValidation("iban", validateIBAN)
	Validator.RegisterValidation("iban_ir", validateIranianIBAN)
	Validator.RegisterValidation("currency", validateCurrency)
	Validator.RegisterValidation("remittance_status", validateRemittanceStatus)
	Validator.RegisterValidation("payment_method", validatePaymentMethod)
}

// ValidateStruct validates a struct and returns formatted error messages
func ValidateStruct(s interface{}) map[string]string {
	err := Validator.Struct(s)
	if err == nil {
		return nil
	}

	errors := make(map[string]string)
	for _, err := range err.(validator.ValidationErrors) {
		field := strings.ToLower(err.Field()[:1]) + err.Field()[1:] // camelCase
		errors[field] = getErrorMessage(err)
	}
	return errors
}

// getErrorMessage returns a human-readable error message
func getErrorMessage(err validator.FieldError) string {
	switch err.Tag() {
	case "required":
		return "This field is required"
	case "email":
		return "Must be a valid email address"
	case "min":
		return "Must be at least " + err.Param() + " characters"
	case "max":
		return "Must be at most " + err.Param() + " characters"
	case "len":
		return "Must be exactly " + err.Param() + " characters"
	case "gt":
		return "Must be greater than " + err.Param()
	case "gte":
		return "Must be greater than or equal to " + err.Param()
	case "lt":
		return "Must be less than " + err.Param()
	case "lte":
		return "Must be less than or equal to " + err.Param()
	case "phone":
		return "Must be a valid phone number"
	case "iban":
		return "Must be a valid IBAN"
	case "iban_ir":
		return "Must be a valid Iranian IBAN (26 characters starting with IR)"
	case "currency":
		return "Must be a valid currency code (e.g., CAD, USD, IRR)"
	case "remittance_status":
		return "Must be a valid remittance status"
	case "payment_method":
		return "Must be a valid payment method"
	case "oneof":
		return "Must be one of: " + err.Param()
	case "numeric":
		return "Must contain only numbers"
	case "alphanum":
		return "Must contain only letters and numbers"
	default:
		return "Invalid value"
	}
}

// validatePhone validates phone numbers in international format
func validatePhone(fl validator.FieldLevel) bool {
	phone := fl.Field().String()
	if phone == "" {
		return true // Let 'required' handle empty values
	}
	// Accept formats like +1-416-555-1234, +14165551234, 416-555-1234
	phoneRegex := regexp.MustCompile(`^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$`)
	return phoneRegex.MatchString(phone)
}

// validateIBAN validates IBAN format
func validateIBAN(fl validator.FieldLevel) bool {
	iban := fl.Field().String()
	if iban == "" {
		return true
	}
	// Basic IBAN validation: 15-34 alphanumeric characters
	ibanRegex := regexp.MustCompile(`^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$`)
	return ibanRegex.MatchString(strings.ToUpper(iban))
}

// validateIranianIBAN validates Iranian IBAN format
func validateIranianIBAN(fl validator.FieldLevel) bool {
	iban := fl.Field().String()
	if iban == "" {
		return true
	}

	upper := strings.ToUpper(iban)
	// Iranian IBAN: IR + 24 digits = 26 characters total
	if len(upper) != 26 {
		return false
	}
	if !strings.HasPrefix(upper, "IR") {
		return false
	}
	// Check remaining characters are digits
	for _, c := range upper[2:] {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// validateCurrency validates currency codes
func validateCurrency(fl validator.FieldLevel) bool {
	currency := strings.ToUpper(fl.Field().String())
	validCurrencies := map[string]bool{
		"CAD": true, "USD": true, "EUR": true, "GBP": true,
		"IRR": true, "AED": true, "TRY": true, "CNY": true,
		"JPY": true, "AUD": true, "CHF": true, "INR": true,
	}
	return validCurrencies[currency]
}

// validateRemittanceStatus validates remittance status values
func validateRemittanceStatus(fl validator.FieldLevel) bool {
	status := strings.ToUpper(fl.Field().String())
	validStatuses := map[string]bool{
		"PENDING": true, "PARTIAL": true, "COMPLETED": true,
		"PAID": true, "CANCELLED": true,
	}
	return validStatuses[status]
}

// validatePaymentMethod validates payment method values
func validatePaymentMethod(fl validator.FieldLevel) bool {
	method := strings.ToUpper(fl.Field().String())
	validMethods := map[string]bool{
		"CASH": true, "E_TRANSFER": true, "BANK_TRANSFER": true,
		"CHEQUE": true, "CARD": true, "ONLINE": true, "OTHER": true,
	}
	return validMethods[method]
}