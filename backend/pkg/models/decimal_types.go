package models

import (
	"database/sql/driver"
	"fmt"

	"github.com/shopspring/decimal"
)

// Decimal is a wrapper around shopspring/decimal for GORM compatibility
type Decimal struct {
	decimal.Decimal
}

// NewDecimal creates a new Decimal from a float64
func NewDecimal(f float64) Decimal {
	return Decimal{decimal.NewFromFloat(f)}
}

// NewDecimalFromString creates a new Decimal from a string
func NewDecimalFromString(s string) (Decimal, error) {
	d, err := decimal.NewFromString(s)
	if err != nil {
		return Decimal{}, err
	}
	return Decimal{d}, nil
}

// Zero returns a zero Decimal
func Zero() Decimal {
	return Decimal{decimal.Zero}
}

// Value implements the driver.Valuer interface for database storage
func (d Decimal) Value() (driver.Value, error) {
	return d.Decimal.String(), nil
}

// Scan implements the sql.Scanner interface for database retrieval
func (d *Decimal) Scan(value interface{}) error {
	if value == nil {
		d.Decimal = decimal.Zero
		return nil
	}

	switch v := value.(type) {
	case float64:
		d.Decimal = decimal.NewFromFloat(v)
	case int64:
		d.Decimal = decimal.NewFromInt(v)
	case []byte:
		dec, err := decimal.NewFromString(string(v))
		if err != nil {
			return err
		}
		d.Decimal = dec
	case string:
		dec, err := decimal.NewFromString(v)
		if err != nil {
			return err
		}
		d.Decimal = dec
	default:
		return fmt.Errorf("cannot scan type %T into Decimal", value)
	}
	return nil
}

// MarshalJSON implements json.Marshaler
func (d Decimal) MarshalJSON() ([]byte, error) {
	return []byte(d.Decimal.String()), nil
}

// UnmarshalJSON implements json.Unmarshaler
func (d *Decimal) UnmarshalJSON(data []byte) error {
	str := string(data)
	// Remove quotes if present
	if len(str) >= 2 && str[0] == '"' && str[len(str)-1] == '"' {
		str = str[1 : len(str)-1]
	}
	dec, err := decimal.NewFromString(str)
	if err != nil {
		return err
	}
	d.Decimal = dec
	return nil
}

// Add adds two Decimals
func (d Decimal) Add(other Decimal) Decimal {
	return Decimal{d.Decimal.Add(other.Decimal)}
}

// Sub subtracts two Decimals
func (d Decimal) Sub(other Decimal) Decimal {
	return Decimal{d.Decimal.Sub(other.Decimal)}
}

// Mul multiplies two Decimals
func (d Decimal) Mul(other Decimal) Decimal {
	return Decimal{d.Decimal.Mul(other.Decimal)}
}

// Div divides two Decimals
func (d Decimal) Div(other Decimal) Decimal {
	return Decimal{d.Decimal.Div(other.Decimal)}
}

// Round rounds to the specified number of decimal places
func (d Decimal) Round(places int32) Decimal {
	return Decimal{d.Decimal.Round(places)}
}

// Float64 converts to float64 (use with caution, only for display)
func (d Decimal) Float64() float64 {
	f, _ := d.Decimal.Float64()
	return f
}

// IsZero returns true if the decimal is zero
func (d Decimal) IsZero() bool {
	return d.Decimal.IsZero()
}

// IsPositive returns true if the decimal is greater than zero
func (d Decimal) IsPositive() bool {
	return d.Decimal.IsPositive()
}

// IsNegative returns true if the decimal is less than zero
func (d Decimal) IsNegative() bool {
	return d.Decimal.IsNegative()
}

// LessThan returns true if d < other
func (d Decimal) LessThan(other Decimal) bool {
	return d.Decimal.LessThan(other.Decimal)
}

// LessThanOrEqual returns true if d <= other
func (d Decimal) LessThanOrEqual(other Decimal) bool {
	return d.Decimal.LessThanOrEqual(other.Decimal)
}

// GreaterThan returns true if d > other
func (d Decimal) GreaterThan(other Decimal) bool {
	return d.Decimal.GreaterThan(other.Decimal)
}

// GreaterThanOrEqual returns true if d >= other
func (d Decimal) GreaterThanOrEqual(other Decimal) bool {
	return d.Decimal.GreaterThanOrEqual(other.Decimal)
}

// Abs returns the absolute value
func (d Decimal) Abs() Decimal {
	return Decimal{d.Decimal.Abs()}
}

// Neg returns the negated value
func (d Decimal) Neg() Decimal {
	return Decimal{d.Decimal.Neg()}
}
