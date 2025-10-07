package httputil

import (
	"encoding/json"
	"log"
	"net/http"
)

type APIError struct {
	Code        string `json:"error"`
	Description string `json:"error_description"`
}

func EnsureMethod(w http.ResponseWriter, r *http.Request, allowedMethod string) bool {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return false
	}

	if r.Method != allowedMethod {
		WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only "+allowedMethod+" requests are supported")
		return false
	}

	return true
}

func JSON(w http.ResponseWriter, statusCode int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v\n", err)
	}
}

func WriteError(w http.ResponseWriter, statusCode int, code, description string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	apiError := APIError{
		Code:        code,
		Description: description,
	}
	if err := json.NewEncoder(w).Encode(apiError); err != nil {
		log.Printf("Error encoding error response: %v\n", err)
	}
	log.Printf("API Error: %s - %s\n", code, description)
}
