package httputil

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	pkgerrors "github-project-status-viewer-server/pkg/errors"
)

func TestWriteErrorWithLog(t *testing.T) {
	tests := []struct {
		err                 error
		fallbackCode        string
		fallbackDescription string
		fallbackStatus      int
		name                string
		wantCode            string
		wantDescription     string
		wantStatus          int
	}{
		{
			name:                "should sanitize JWT secret missing error",
			err:                 pkgerrors.ErrJWTSecretMissing,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusInternalServerError,
			wantCode:            "server_error",
			wantDescription:     "Service configuration error",
		},
		{
			name:                "should sanitize invalid signing method error",
			err:                 pkgerrors.ErrInvalidSigningMethod,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusUnauthorized,
			wantCode:            "invalid_token",
			wantDescription:     "Invalid token signature",
		},
		{
			name:                "should sanitize token expired error",
			err:                 pkgerrors.ErrTokenExpired,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusUnauthorized,
			wantCode:            "token_expired",
			wantDescription:     "Token has expired",
		},
		{
			name:                "should sanitize session not found error",
			err:                 pkgerrors.ErrSessionNotFound,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusUnauthorized,
			wantCode:            "session_not_found",
			wantDescription:     "Session not found",
		},
		{
			name:                "should sanitize Redis config missing error",
			err:                 pkgerrors.ErrRedisConfigMissing,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusInternalServerError,
			wantCode:            "server_error",
			wantDescription:     "Storage configuration error",
		},
		{
			name:                "should sanitize OAuth exchange failed error",
			err:                 pkgerrors.ErrOAuthExchangeFailed,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusBadRequest,
			wantCode:            "exchange_failed",
			wantDescription:     "Failed to exchange authorization code",
		},
		{
			name:                "should use fallback for unknown error",
			err:                 errors.New("internal database constraint violation"),
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "server_error",
			fallbackDescription: "Internal server error",
			wantStatus:          http.StatusInternalServerError,
			wantCode:            "server_error",
			wantDescription:     "Internal server error",
		},
		{
			name:                "should sanitize wrapped known error",
			err:                 errors.Join(pkgerrors.ErrInvalidTokenFormat, errors.New("jwt: malformed token")),
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusUnauthorized,
			wantCode:            "invalid_token",
			wantDescription:     "Invalid token format",
		},
		{
			name:                "should sanitize refresh token revoked error",
			err:                 pkgerrors.ErrRefreshTokenRevoked,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusUnauthorized,
			wantCode:            "refresh_token_revoked",
			wantDescription:     "Refresh token has been revoked or expired",
		},
		{
			name:                "should sanitize session mismatch error",
			err:                 pkgerrors.ErrSessionMismatch,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "unknown_error",
			fallbackDescription: "An error occurred",
			wantStatus:          http.StatusUnauthorized,
			wantCode:            "session_mismatch",
			wantDescription:     "Session mismatch detected",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()

			WriteErrorWithLog(w, tt.err, tt.fallbackStatus, tt.fallbackCode, tt.fallbackDescription)

			if w.Code != tt.wantStatus {
				t.Errorf("Status code = %v, want %v", w.Code, tt.wantStatus)
			}

			var apiError APIError
			if err := json.NewDecoder(w.Body).Decode(&apiError); err != nil {
				t.Fatalf("Failed to decode error response: %v", err)
			}

			if apiError.Code != tt.wantCode {
				t.Errorf("Error code = %v, want %v", apiError.Code, tt.wantCode)
			}

			if apiError.Description != tt.wantDescription {
				t.Errorf("Error description = %v, want %v", apiError.Description, tt.wantDescription)
			}
		})
	}
}

func TestWriteErrorWithLog_DoesNotExposeInternalDetails(t *testing.T) {
	tests := []struct {
		err              error
		name             string
		shouldNotContain []string
	}{
		{
			name:             "JWT validation error should not expose stack trace",
			err:              errors.New("failed to parse token: jwt: token signature is invalid: crypto/rsa: verification error"),
			shouldNotContain: []string{"crypto/rsa", "verification error", "stack trace", "parse"},
		},
		{
			name:             "Redis error should not expose connection details",
			err:              errors.New("redis connection failed: dial tcp 127.0.0.1:6379: connect: connection refused"),
			shouldNotContain: []string{"127.0.0.1", "6379", "dial tcp", "connection refused"},
		},
		{
			name:             "OAuth error should not expose API keys",
			err:              errors.New("oauth exchange failed: invalid_client: client_id abc123xyz does not match"),
			shouldNotContain: []string{"abc123xyz", "client_id", "invalid_client"},
		},
		{
			name:             "SQL error should not expose query details",
			err:              errors.New("database error: duplicate key value violates unique constraint \"users_email_key\""),
			shouldNotContain: []string{"duplicate key", "unique constraint", "users_email_key"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()

			WriteErrorWithLog(w, tt.err, http.StatusInternalServerError, "server_error", "An unexpected error occurred")

			var apiError APIError
			if err := json.NewDecoder(w.Body).Decode(&apiError); err != nil {
				t.Fatalf("Failed to decode error response: %v", err)
			}

			responseText := apiError.Code + " " + apiError.Description

			for _, forbidden := range tt.shouldNotContain {
				if containsSubstring(responseText, forbidden) {
					t.Errorf("Response contains internal detail '%s': %s", forbidden, responseText)
				}
			}

			if apiError.Code != "server_error" {
				t.Errorf("Expected generic error code 'server_error', got '%s'", apiError.Code)
			}

			if apiError.Description != "An unexpected error occurred" {
				t.Errorf("Expected generic description, got '%s'", apiError.Description)
			}
		})
	}
}

func TestGetErrorResponse(t *testing.T) {
	tests := []struct {
		err                 error
		fallbackCode        string
		fallbackDescription string
		fallbackStatus      int
		name                string
		wantCode            string
		wantDescription     string
		wantStatus          int
	}{
		{
			name:                "known error returns mapped response",
			err:                 pkgerrors.ErrInvalidAccessTokenClaims,
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "fallback",
			fallbackDescription: "Fallback message",
			wantStatus:          http.StatusUnauthorized,
			wantCode:            "invalid_access_token",
			wantDescription:     "Invalid authentication token",
		},
		{
			name:                "unknown error returns fallback response",
			err:                 errors.New("completely unknown error"),
			fallbackStatus:      http.StatusInternalServerError,
			fallbackCode:        "server_error",
			fallbackDescription: "Something went wrong",
			wantStatus:          http.StatusInternalServerError,
			wantCode:            "server_error",
			wantDescription:     "Something went wrong",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := getErrorResponse(tt.err, tt.fallbackStatus, tt.fallbackCode, tt.fallbackDescription)

			if response.StatusCode != tt.wantStatus {
				t.Errorf("StatusCode = %v, want %v", response.StatusCode, tt.wantStatus)
			}

			if response.Code != tt.wantCode {
				t.Errorf("Code = %v, want %v", response.Code, tt.wantCode)
			}

			if response.Description != tt.wantDescription {
				t.Errorf("Description = %v, want %v", response.Description, tt.wantDescription)
			}
		})
	}
}

func containsSubstring(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && stringContains(s, substr))
}

func stringContains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
