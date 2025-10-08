package oauth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSetCORS(t *testing.T) {
	tests := []struct {
		extensionID      string
		name             string
		wantAllowHeaders string
		wantAllowMethods string
		wantAllowOrigin  string
		wantNoHeaders    bool
	}{
		{
			extensionID:      "abcdefghijklmnop",
			name:             "valid extension ID",
			wantAllowOrigin:  "chrome-extension://abcdefghijklmnop",
			wantAllowMethods: "GET, POST, OPTIONS",
			wantAllowHeaders: "Content-Type",
			wantNoHeaders:    false,
		},
		{
			extensionID:   "",
			name:          "empty extension ID",
			wantNoHeaders: true,
		},
		{
			extensionID:      "test-extension-123",
			name:             "extension ID with special characters",
			wantAllowOrigin:  "chrome-extension://test-extension-123",
			wantAllowMethods: "GET, POST, OPTIONS",
			wantAllowHeaders: "Content-Type",
			wantNoHeaders:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("CHROME_EXTENSION_ID", tt.extensionID)

			w := httptest.NewRecorder()
			SetCORS(w)

			if tt.wantNoHeaders {
				if origin := w.Header().Get("Access-Control-Allow-Origin"); origin != "" {
					t.Errorf("Expected no CORS headers, but got Access-Control-Allow-Origin: %s", origin)
				}
				return
			}

			if got := w.Header().Get("Access-Control-Allow-Origin"); got != tt.wantAllowOrigin {
				t.Errorf("Access-Control-Allow-Origin = %v, want %v", got, tt.wantAllowOrigin)
			}

			if got := w.Header().Get("Access-Control-Allow-Methods"); got != tt.wantAllowMethods {
				t.Errorf("Access-Control-Allow-Methods = %v, want %v", got, tt.wantAllowMethods)
			}

			if got := w.Header().Get("Access-Control-Allow-Headers"); got != tt.wantAllowHeaders {
				t.Errorf("Access-Control-Allow-Headers = %v, want %v", got, tt.wantAllowHeaders)
			}
		})
	}
}

func TestSetCORS_MultipleCallsDoNotDuplicate(t *testing.T) {
	t.Setenv("CHROME_EXTENSION_ID", "test-extension")

	w := httptest.NewRecorder()

	// Call SetCORS multiple times
	SetCORS(w)
	SetCORS(w)
	SetCORS(w)

	// Verify headers are set once (not duplicated)
	origin := w.Header().Get("Access-Control-Allow-Origin")
	if origin != "chrome-extension://test-extension" {
		t.Errorf("Access-Control-Allow-Origin = %v, want chrome-extension://test-extension", origin)
	}

	// Verify we don't have duplicate values
	if len(w.Header().Values("Access-Control-Allow-Origin")) > 1 {
		t.Errorf("Multiple Access-Control-Allow-Origin headers found: %v", w.Header().Values("Access-Control-Allow-Origin"))
	}
}

func TestSetCORS_IntegrationWithHandler(t *testing.T) {
	tests := []struct {
		extensionID           string
		name                  string
		shouldHaveCORSHeaders bool
	}{
		{
			extensionID:           "valid-extension",
			name:                  "handler with valid extension",
			shouldHaveCORSHeaders: true,
		},
		{
			extensionID:           "",
			name:                  "handler without extension ID",
			shouldHaveCORSHeaders: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("CHROME_EXTENSION_ID", tt.extensionID)

			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				SetCORS(w)
				w.WriteHeader(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			hasOrigin := w.Header().Get("Access-Control-Allow-Origin") != ""
			if hasOrigin != tt.shouldHaveCORSHeaders {
				t.Errorf("shouldHaveCORSHeaders = %v, but headers present = %v", tt.shouldHaveCORSHeaders, hasOrigin)
			}
		})
	}
}
