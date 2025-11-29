package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github-project-status-viewer-server/pkg/httputil"
)

func TestHandler_ErrorResponseSanitization(t *testing.T) {
	tests := []struct {
		expectedCode        string
		expectedDescription string
		name                string
		queryParams         string
		shouldNotContain    []string
	}{
		{
			name:                "missing code parameter should return sanitized error",
			queryParams:         "?state=abc123",
			expectedCode:        "missing_code",
			expectedDescription: "Authorization code is required",
			shouldNotContain:    []string{"internal", "stack", "nil"},
		},
		{
			name:                "missing state parameter should return sanitized error",
			queryParams:         "?code=test_code",
			expectedCode:        "missing_state",
			expectedDescription: "State parameter is required for CSRF protection",
			shouldNotContain:    []string{"internal", "stack", "nil"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/callback"+tt.queryParams, nil)
			w := httptest.NewRecorder()

			Handler(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Status code = %v, want %v", w.Code, http.StatusBadRequest)
			}

			var apiError httputil.APIError
			if err := json.NewDecoder(w.Body).Decode(&apiError); err != nil {
				t.Fatalf("Failed to decode error response: %v", err)
			}

			if apiError.Code != tt.expectedCode {
				t.Errorf("Error code = %v, want %v", apiError.Code, tt.expectedCode)
			}

			if apiError.Description != tt.expectedDescription {
				t.Errorf("Error description = %v, want %v", apiError.Description, tt.expectedDescription)
			}

			responseBody := w.Body.String()
			for _, forbidden := range tt.shouldNotContain {
				if containsString(responseBody, forbidden) {
					t.Errorf("Response should not contain '%s' but body contains: %s", forbidden, responseBody)
				}
			}
		})
	}
}

func TestHandler_MethodValidation(t *testing.T) {
	tests := []struct {
		method     string
		name       string
		wantStatus int
	}{
		{
			name:       "GET method should be accepted",
			method:     http.MethodGet,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "POST method should be rejected",
			method:     http.MethodPost,
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:       "PUT method should be rejected",
			method:     http.MethodPut,
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:       "DELETE method should be rejected",
			method:     http.MethodDelete,
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:       "OPTIONS method should be accepted for CORS",
			method:     http.MethodOptions,
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/api/callback?code=test&state=test", nil)
			w := httptest.NewRecorder()

			Handler(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("Status code = %v, want %v", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestHandler_CORSHeaders(t *testing.T) {
	t.Setenv("CHROME_EXTENSION_ID", "test-extension-id")

	req := httptest.NewRequest(http.MethodGet, "/api/callback?code=test&state=test", nil)
	w := httptest.NewRecorder()

	Handler(w, req)

	corsHeader := w.Header().Get("Access-Control-Allow-Origin")
	expectedOrigin := "chrome-extension://test-extension-id"
	if corsHeader != expectedOrigin {
		t.Errorf("Expected CORS header to be %s, got %s", expectedOrigin, corsHeader)
	}
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && stringContains(s, substr)
}

func stringContains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
