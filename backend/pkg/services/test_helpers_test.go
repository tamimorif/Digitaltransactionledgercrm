package services

import (
	"math"
)

// Shared test helper functions for services tests

// testStringPtr returns a pointer to a string (for optional fields)
func testStringPtr(s string) *string {
	return &s
}

// testAbs returns the absolute value of x
func testAbs(x float64) float64 {
	return math.Abs(x)
}

// testFloatPtr returns a pointer to a float64
func testFloatPtr(f float64) *float64 {
	return &f
}

// testUintPtr returns a pointer to a uint
func testUintPtr(u uint) *uint {
	return &u
}
