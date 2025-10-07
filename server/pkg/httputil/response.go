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
