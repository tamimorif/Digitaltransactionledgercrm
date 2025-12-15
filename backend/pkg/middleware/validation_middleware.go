package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

// ValidationKey is the context key for validated data
type ValidationKey string

const ValidatedDataKey ValidationKey = "validatedData"

// GetValidatedData retrieves the validated struct from context
func GetValidatedData(r *http.Request) interface{} {
	return r.Context().Value(ValidatedDataKey)
}

// ValidateRequestMiddleware creates a middleware that decodes and validates the request body into target struct
// Usage: r.Handle("/route", ValidateRequestMiddleware(models.Transaction{}, handler))
func ValidateRequestMiddleware(model interface{}, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Create a new instance of the model type
		modelType := reflect.TypeOf(model)
		if modelType.Kind() == reflect.Ptr {
			modelType = modelType.Elem()
		}
		newModelVal := reflect.New(modelType).Interface()

		// Read body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusInternalServerError)
			return
		}
		// Restore body for next handler if needed (though we encourage using context)
		r.Body = io.NopCloser(bytes.NewBuffer(body))

		// Decode
		if err := json.Unmarshal(body, newModelVal); err != nil {
			http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
			return
		}

		// Validate
		if err := validate.Struct(newModelVal); err != nil {
			validationErrors := err.(validator.ValidationErrors)
			errMap := make(map[string]string)
			for _, e := range validationErrors {
				errMap[e.Field()] = fmt.Sprintf("failed validation: %s", e.Tag())
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Validation failed",
				"details": errMap,
			})
			return
		}

		// Store validated struct in context
		ctx := context.WithValue(r.Context(), ValidatedDataKey, newModelVal)
		next(w, r.WithContext(ctx))
	}
}
