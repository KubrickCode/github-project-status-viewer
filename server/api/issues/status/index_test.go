package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/jwt"
)

func generateTestToken(t *testing.T) string {
	t.Helper()
	t.Setenv("JWT_SECRET", "test-secret-key-for-testing")
	manager, err := jwt.NewManager()
	if err != nil {
		t.Fatalf("failed to create JWT manager: %v", err)
	}
	token, err := manager.GenerateAccessToken("test-session-id")
	if err != nil {
		t.Fatalf("failed to generate access token: %v", err)
	}
	return token
}

func TestHandler_MethodValidation(t *testing.T) {
	tests := []struct {
		method     string
		name       string
		wantStatus int
	}{
		{
			name:       "POST method should be accepted",
			method:     http.MethodPost,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "GET method should be rejected",
			method:     http.MethodGet,
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
			req := httptest.NewRequest(tt.method, "/api/issues/status", nil)
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

	req := httptest.NewRequest(http.MethodOptions, "/api/issues/status", nil)
	w := httptest.NewRecorder()

	Handler(w, req)

	corsHeader := w.Header().Get("Access-Control-Allow-Origin")
	expectedOrigin := "chrome-extension://test-extension-id"
	if corsHeader != expectedOrigin {
		t.Errorf("Expected CORS header to be %s, got %s", expectedOrigin, corsHeader)
	}
}

func TestHandler_InvalidRequestBody(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	req := httptest.NewRequest(http.MethodPost, "/api/issues/status", bytes.NewReader([]byte("invalid json")))
	req.Header.Set("Authorization", "Bearer invalid-token")
	w := httptest.NewRecorder()

	Handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Status code = %v, want %v", w.Code, http.StatusUnauthorized)
	}
}

func TestHandler_MissingRequiredFields(t *testing.T) {
	tests := []struct {
		expectedDesc string
		name         string
		requestBody  StatusRequest
	}{
		{
			name:         "missing owner",
			requestBody:  StatusRequest{Owner: "", Repo: "repo", IssueNumbers: []int{1}},
			expectedDesc: "owner, repo, and issueNumbers are required",
		},
		{
			name:         "missing repo",
			requestBody:  StatusRequest{Owner: "owner", Repo: "", IssueNumbers: []int{1}},
			expectedDesc: "owner, repo, and issueNumbers are required",
		},
		{
			name:         "missing issueNumbers",
			requestBody:  StatusRequest{Owner: "owner", Repo: "repo", IssueNumbers: []int{}},
			expectedDesc: "owner, repo, and issueNumbers are required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := generateTestToken(t)
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest(http.MethodPost, "/api/issues/status", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()

			Handler(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Status code = %v, want %v", w.Code, http.StatusBadRequest)
			}

			var apiError httputil.APIError
			if err := json.NewDecoder(w.Body).Decode(&apiError); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}
			if apiError.Description != tt.expectedDesc {
				t.Errorf("Expected error description %q, got %q", tt.expectedDesc, apiError.Description)
			}
		})
	}
}

func TestHandler_ExceedsMaxIssueNumbers(t *testing.T) {
	token := generateTestToken(t)
	issueNumbers := make([]int, 101)
	for i := range issueNumbers {
		issueNumbers[i] = i + 1
	}

	requestBody := StatusRequest{
		Owner:        "owner",
		Repo:         "repo",
		IssueNumbers: issueNumbers,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest(http.MethodPost, "/api/issues/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	Handler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status code = %v, want %v", w.Code, http.StatusBadRequest)
	}

	var apiError httputil.APIError
	if err := json.NewDecoder(w.Body).Decode(&apiError); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	if apiError.Code != "invalid_request" {
		t.Errorf("Expected error code 'invalid_request', got %q", apiError.Code)
	}
}

func TestHandler_MissingAuthorizationHeader(t *testing.T) {
	requestBody := StatusRequest{
		Owner:        "owner",
		Repo:         "repo",
		IssueNumbers: []int{1},
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest(http.MethodPost, "/api/issues/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	Handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Status code = %v, want %v", w.Code, http.StatusUnauthorized)
	}

	var apiError httputil.APIError
	json.NewDecoder(w.Body).Decode(&apiError)

	if apiError.Code != "invalid_token" {
		t.Errorf("Expected error code 'invalid_token', got %q", apiError.Code)
	}
}

func TestHandler_InvalidAuthorizationHeader(t *testing.T) {
	requestBody := StatusRequest{
		Owner:        "owner",
		Repo:         "repo",
		IssueNumbers: []int{1},
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest(http.MethodPost, "/api/issues/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic invalid")
	w := httptest.NewRecorder()

	Handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Status code = %v, want %v", w.Code, http.StatusUnauthorized)
	}
}
