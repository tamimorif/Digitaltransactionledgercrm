package utils

// CurrencyMinUnit defines the smallest monetary unit for each currency.
// This is used for payment completion tolerance checks.
var currencyMinUnit = map[string]float64{
	// Major currencies (2 decimal places)
	"USD": 0.01,
	"EUR": 0.01,
	"CAD": 0.01,
	"GBP": 0.01,
	"AUD": 0.01,
	"CHF": 0.01,
	"CNY": 0.01,
	"INR": 0.01,
	"MXN": 0.01,
	"AED": 0.01,
	"TRY": 0.01,
	"AFN": 0.01, // Afghan Afghani
	"PKR": 0.01, // Pakistani Rupee

	// Zero decimal currencies (no cents)
	"IRR": 1.0, // Iranian Rial
	"JPY": 1.0, // Japanese Yen
	"KRW": 1.0, // South Korean Won
	"VND": 1.0, // Vietnamese Dong
	"IDR": 1.0, // Indonesian Rupiah
	"IQD": 1.0, // Iraqi Dinar (technically 3 decimals but rarely used)

	// Three decimal currencies
	"KWD": 0.001, // Kuwaiti Dinar
	"BHD": 0.001, // Bahraini Dinar
	"OMR": 0.001, // Omani Rial
	"JOD": 0.001, // Jordanian Dinar
	"TND": 0.001, // Tunisian Dinar
	"LYD": 0.001, // Libyan Dinar
}

// GetPaymentTolerance returns the appropriate tolerance for payment completion checks.
// For currencies without a defined minimum unit, defaults to 0.01.
func GetPaymentTolerance(currency string) float64 {
	if min, ok := currencyMinUnit[currency]; ok {
		return min
	}
	return 0.01 // Default for unknown currencies
}

// GetSmallestUnit returns the smallest monetary unit for a currency.
// This is useful for rounding and display purposes.
func GetSmallestUnit(currency string) float64 {
	return GetPaymentTolerance(currency)
}

// GetDecimalPlaces returns the number of decimal places for a currency.
func GetDecimalPlaces(currency string) int {
	tolerance := GetPaymentTolerance(currency)
	switch tolerance {
	case 1.0:
		return 0
	case 0.001:
		return 3
	default:
		return 2
	}
}

// IsWithinTolerance checks if an amount is effectively zero for a given currency.
func IsWithinTolerance(amount float64, currency string) bool {
	tolerance := GetPaymentTolerance(currency)
	if amount < 0 {
		amount = -amount
	}
	return amount <= tolerance
}
