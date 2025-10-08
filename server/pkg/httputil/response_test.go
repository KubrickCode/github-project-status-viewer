package httputil

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnsureMethod(t *testing.T) {
	tests := []struct {
		allowedMethod string
		method        string
		name          string
		wantStatus    int
		wantResult    bool
	}{
		{
			allowedMethod: http.MethodGet,
			method:        http.MethodGet,
			name:          "matching GET method",
			wantResult:    true,
			wantStatus:    0,
		},
		{
			allowedMethod: http.MethodPost,
			method:        http.MethodPost,
			name:          "matching POST method",
			wantResult:    true,
			wantStatus:    0,
		},
		{
			allowedMethod: http.MethodGet,
			method:        http.MethodPost,
			name:          "mismatched method",
			wantResult:    false,
			wantStatus:    http.StatusMethodNotAllowed,
		},
		{
			allowedMethod: http.MethodPost,
			method:        http.MethodGet,
			name:          "GET when POST expected",
			wantResult:    false,
			wantStatus:    http.StatusMethodNotAllowed,
		},
		{
			allowedMethod: http.MethodGet,
			method:        http.MethodOptions,
			name:          "OPTIONS request",
			wantResult:    false,
			wantStatus:    http.StatusOK,
		},
		{
			allowedMethod: http.MethodPost,
			method:        http.MethodOptions,
			name:          "OPTIONS request with POST allowed",
			wantResult:    false,
			wantStatus:    http.StatusOK,
		},
		{
			allowedMethod: http.MethodDelete,
			method:        http.MethodPut,
			name:          "PUT when DELETE expected",
			wantResult:    false,
			wantStatus:    http.StatusMethodNotAllowed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/test", nil)
			w := httptest.NewRecorder()

			result := EnsureMethod(w, req, tt.allowedMethod)

			if result != tt.wantResult {
				t.Errorf("EnsureMethod() = %v, want %v", result, tt.wantResult)
			}

			if tt.wantStatus > 0 && w.Code != tt.wantStatus {
				t.Errorf("Status code = %v, want %v", w.Code, tt.wantStatus)
			}

			if !tt.wantResult && tt.wantStatus == http.StatusMethodNotAllowed {
				var apiError APIError
				if err := json.NewDecoder(w.Body).Decode(&apiError); err != nil {
					t.Errorf("Failed to decode error response: %v", err)
				}

				if apiError.Code != "method_not_allowed" {
					t.Errorf("Error code = %v, want method_not_allowed", apiError.Code)
				}
			}
		})
	}
}

func TestJSON(t *testing.T) {
	tests := []struct {
		data       any
		name       string
		statusCode int
	}{
		{
			name:       "simple string",
			statusCode: http.StatusOK,
			data:       "test message",
		},
		{
			name:       "map object",
			statusCode: http.StatusOK,
			data: map[string]string{
				"key": "value",
			},
		},
		{
			name:       "struct object",
			statusCode: http.StatusCreated,
			data: struct {
				Message string `json:"message"`
				Status  int    `json:"status"`
			}{
				Message: "success",
				Status:  201,
			},
		},
		{
			name:       "array",
			statusCode: http.StatusOK,
			data:       []string{"a", "b", "c"},
		},
		{
			name:       "nil data",
			statusCode: http.StatusNoContent,
			data:       nil,
		},
		{
			name:       "empty object",
			statusCode: http.StatusOK,
			data:       map[string]string{},
		},
		{
			name:       "nested object",
			statusCode: http.StatusOK,
			data: map[string]any{
				"nested": map[string]string{
					"inner": "value",
				},
				"number": 42,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			JSON(w, tt.statusCode, tt.data)

			if w.Code != tt.statusCode {
				t.Errorf("Status code = %v, want %v", w.Code, tt.statusCode)
			}

			if contentType := w.Header().Get("Content-Type"); contentType != "application/json" {
				t.Errorf("Content-Type = %v, want application/json", contentType)
			}

			// Verify JSON is valid
			if tt.data != nil {
				var result any
				if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
					t.Errorf("Response body is not valid JSON: %v", err)
				}
			}
		})
	}
}

func TestWriteError(t *testing.T) {
	tests := []struct {
		code        string
		description string
		name        string
		statusCode  int
	}{
		{
			name:        "bad request error",
			statusCode:  http.StatusBadRequest,
			code:        "invalid_request",
			description: "The request is invalid",
		},
		{
			name:        "unauthorized error",
			statusCode:  http.StatusUnauthorized,
			code:        "unauthorized",
			description: "Authentication required",
		},
		{
			name:        "not found error",
			statusCode:  http.StatusNotFound,
			code:        "not_found",
			description: "Resource not found",
		},
		{
			name:        "internal server error",
			statusCode:  http.StatusInternalServerError,
			code:        "internal_error",
			description: "Something went wrong",
		},
		{
			name:        "empty description",
			statusCode:  http.StatusBadRequest,
			code:        "error_code",
			description: "",
		},
		{
			name:        "long description",
			statusCode:  http.StatusBadRequest,
			code:        "validation_error",
			description: "This is a very long error description that contains detailed information about what went wrong and how to fix it",
		},
		{
			name:        "special characters in description",
			statusCode:  http.StatusBadRequest,
			code:        "special_chars",
			description: "Error with special chars: <>&\"'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			WriteError(w, tt.statusCode, tt.code, tt.description)

			if w.Code != tt.statusCode {
				t.Errorf("Status code = %v, want %v", w.Code, tt.statusCode)
			}

			if contentType := w.Header().Get("Content-Type"); contentType != "application/json" {
				t.Errorf("Content-Type = %v, want application/json", contentType)
			}

			var apiError APIError
			if err := json.NewDecoder(w.Body).Decode(&apiError); err != nil {
				t.Errorf("Failed to decode error response: %v", err)
			}

			if apiError.Code != tt.code {
				t.Errorf("Error code = %v, want %v", apiError.Code, tt.code)
			}

			if apiError.Description != tt.description {
				t.Errorf("Error description = %v, want %v", apiError.Description, tt.description)
			}
		})
	}
}

func TestAPIError_JSONSerialization(t *testing.T) {
	apiError := APIError{
		Code:        "test_error",
		Description: "Test error description",
	}

	data, err := json.Marshal(apiError)
	if err != nil {
		t.Fatalf("Failed to marshal APIError: %v", err)
	}

	var decoded APIError
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal APIError: %v", err)
	}

	if decoded.Code != apiError.Code {
		t.Errorf("Decoded code = %v, want %v", decoded.Code, apiError.Code)
	}

	if decoded.Description != apiError.Description {
		t.Errorf("Decoded description = %v, want %v", decoded.Description, apiError.Description)
	}
}

func TestEnsureMethod_IntegrationWithHandler(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !EnsureMethod(w, r, http.MethodPost) {
			return
		}
		JSON(w, http.StatusOK, map[string]string{"message": "success"})
	})

	tests := []struct {
		method     string
		name       string
		wantStatus int
	}{
		{
			name:       "valid POST request",
			method:     http.MethodPost,
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid GET request",
			method:     http.MethodGet,
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:       "OPTIONS request",
			method:     http.MethodOptions,
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/test", nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("Status code = %v, want %v", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestWriteError_Integration(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("error") == "true" {
			WriteError(w, http.StatusBadRequest, "test_error", "Test error occurred")
			return
		}
		JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	tests := []struct {
		expectError bool
		name        string
		path        string
	}{
		{
			name:        "successful request",
			path:        "/test",
			expectError: false,
		},
		{
			name:        "error request",
			path:        "/test?error=true",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if tt.expectError {
				var apiError APIError
				if err := json.NewDecoder(w.Body).Decode(&apiError); err != nil {
					t.Errorf("Failed to decode error response: %v", err)
				}
				if apiError.Code != "test_error" {
					t.Errorf("Error code = %v, want test_error", apiError.Code)
				}
			}
		})
	}
}
