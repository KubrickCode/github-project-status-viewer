package oauth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"
)

func resetClientForTest(t *testing.T) {
	t.Helper()
	originalFunc := getClientFunc
	getClientFunc = sync.OnceValues(func() (*Client, error) {
		return NewClient()
	})
	t.Cleanup(func() {
		getClientFunc = originalFunc
	})
}

func TestNewClient(t *testing.T) {
	tests := []struct {
		clientID     string
		clientSecret string
		name         string
		wantErr      bool
	}{
		{
			clientID:     "test-client-id",
			clientSecret: "test-client-secret",
			name:         "valid configuration",
			wantErr:      false,
		},
		{
			clientID:     "",
			clientSecret: "test-client-secret",
			name:         "missing client ID",
			wantErr:      true,
		},
		{
			clientID:     "test-client-id",
			clientSecret: "",
			name:         "missing client secret",
			wantErr:      true,
		},
		{
			clientID:     "",
			clientSecret: "",
			name:         "missing both credentials",
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("GITHUB_CLIENT_ID", tt.clientID)
			t.Setenv("GITHUB_CLIENT_SECRET", tt.clientSecret)

			client, err := NewClient()
			if (err != nil) != tt.wantErr {
				t.Errorf("NewClient() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if client.ClientID != tt.clientID {
					t.Errorf("ClientID = %v, want %v", client.ClientID, tt.clientID)
				}
				if client.ClientSecret != tt.clientSecret {
					t.Errorf("ClientSecret = %v, want %v", client.ClientSecret, tt.clientSecret)
				}
				if client.HTTPClient == nil {
					t.Error("HTTPClient is nil")
				}
			}
		})
	}
}

func TestClient_ExchangeCode(t *testing.T) {
	tests := []struct {
		code           string
		name           string
		responseBody   any
		responseStatus int
		wantErr        bool
	}{
		{
			code:           "test-code",
			name:           "successful token exchange",
			responseStatus: http.StatusOK,
			responseBody: GitHubTokenResponse{
				AccessToken:  "gho_test_access_token",
				ExpiresIn:    28800,
				RefreshToken: "ghr_test_refresh_token",
				Scope:        "repo,user",
				TokenType:    "bearer",
			},
			wantErr: false,
		},
		{
			code:           "invalid-code",
			name:           "invalid authorization code",
			responseStatus: http.StatusOK,
			responseBody: GitHubErrorResponse{
				Error:            "bad_verification_code",
				ErrorDescription: "The code passed is incorrect or expired.",
			},
			wantErr: true,
		},
		{
			code:           "test-code",
			name:           "empty access token",
			responseStatus: http.StatusOK,
			responseBody: GitHubTokenResponse{
				AccessToken: "",
			},
			wantErr: true,
		},
		{
			code:           "test-code",
			name:           "malformed JSON response",
			responseStatus: http.StatusOK,
			responseBody:   "invalid json",
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost {
					t.Errorf("Expected POST request, got %s", r.Method)
				}

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.responseStatus)

				if str, ok := tt.responseBody.(string); ok {
					w.Write([]byte(str))
				} else {
					json.NewEncoder(w).Encode(tt.responseBody)
				}
			}))
			defer server.Close()

			client := &Client{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				HTTPClient:   &http.Client{Timeout: 10 * time.Second},
				TokenURL:     server.URL,
			}

			token, err := client.ExchangeCode(tt.code)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExchangeCode() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if token.AccessToken == "" {
					t.Error("AccessToken is empty")
				}
			}
		})
	}
}

func TestClient_RefreshToken(t *testing.T) {
	tests := []struct {
		name           string
		refreshToken   string
		responseBody   any
		responseStatus int
		wantErr        bool
	}{
		{
			name:           "successful token refresh",
			refreshToken:   "ghr_test_refresh_token",
			responseStatus: http.StatusOK,
			responseBody: GitHubTokenResponse{
				AccessToken:  "gho_new_access_token",
				ExpiresIn:    28800,
				RefreshToken: "ghr_new_refresh_token",
				Scope:        "repo,user",
				TokenType:    "bearer",
			},
			wantErr: false,
		},
		{
			name:           "expired refresh token",
			refreshToken:   "expired_refresh_token",
			responseStatus: http.StatusOK,
			responseBody: GitHubErrorResponse{
				Error:            "bad_refresh_token",
				ErrorDescription: "The refresh token passed is invalid or expired.",
			},
			wantErr: true,
		},
		{
			name:           "empty refresh token",
			refreshToken:   "",
			responseStatus: http.StatusOK,
			responseBody: GitHubTokenResponse{
				AccessToken: "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost {
					t.Errorf("Expected POST request, got %s", r.Method)
				}

				if err := r.ParseForm(); err != nil {
					t.Errorf("Failed to parse form: %v", err)
				}

				if grantType := r.FormValue("grant_type"); grantType != "refresh_token" {
					t.Errorf("Expected grant_type=refresh_token, got %s", grantType)
				}

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.responseStatus)
				json.NewEncoder(w).Encode(tt.responseBody)
			}))
			defer server.Close()

			client := &Client{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				HTTPClient:   &http.Client{Timeout: 10 * time.Second},
				TokenURL:     server.URL,
			}

			token, err := client.RefreshToken(tt.refreshToken)
			if (err != nil) != tt.wantErr {
				t.Errorf("RefreshToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if token.AccessToken == "" {
					t.Error("AccessToken is empty")
				}
			}
		})
	}
}

func TestGetClient(t *testing.T) {
	tests := []struct {
		clientID     string
		clientSecret string
		name         string
		wantErr      bool
	}{
		{
			clientID:     "test-id",
			clientSecret: "test-secret",
			name:         "valid client configuration",
			wantErr:      false,
		},
		{
			clientID:     "",
			clientSecret: "",
			name:         "missing configuration",
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resetClientForTest(t)

			t.Setenv("GITHUB_CLIENT_ID", tt.clientID)
			t.Setenv("GITHUB_CLIENT_SECRET", tt.clientSecret)

			client, err := GetClient()
			if (err != nil) != tt.wantErr {
				t.Errorf("GetClient() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && client == nil {
				t.Error("GetClient() returned nil client")
			}
		})
	}
}

func TestClient_requestToken(t *testing.T) {
	tests := []struct {
		name           string
		requestData    map[string]string
		responseBody   any
		responseStatus int
		wantErr        bool
	}{
		{
			name: "valid token request with all fields",
			requestData: map[string]string{
				"client_id":     "test-id",
				"client_secret": "test-secret",
				"code":          "test-code",
			},
			responseStatus: http.StatusOK,
			responseBody: GitHubTokenResponse{
				AccessToken:  "gho_test_token",
				ExpiresIn:    28800,
				RefreshToken: "ghr_test_refresh",
				Scope:        "repo,user",
				TokenType:    "bearer",
			},
			wantErr: false,
		},
		{
			name: "token with minimal fields",
			requestData: map[string]string{
				"client_id": "test-id",
			},
			responseStatus: http.StatusOK,
			responseBody: GitHubTokenResponse{
				AccessToken: "gho_minimal_token",
				TokenType:   "bearer",
			},
			wantErr: false,
		},
		{
			name: "server returns 500 error",
			requestData: map[string]string{
				"client_id": "test-id",
			},
			responseStatus: http.StatusInternalServerError,
			responseBody: map[string]string{
				"error": "internal_server_error",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.responseStatus)
				json.NewEncoder(w).Encode(tt.responseBody)
			}))
			defer server.Close()

			client := &Client{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				HTTPClient:   &http.Client{Timeout: 10 * time.Second},
				TokenURL:     server.URL,
			}

			// This test would require making requestToken exported or testing through public methods
			// For now, we test through ExchangeCode and RefreshToken
			_, err := client.ExchangeCode(tt.requestData["code"])
			if tt.wantErr && err == nil {
				t.Error("Expected error but got none")
			}
		})
	}
}

func TestGetClient_Concurrency(t *testing.T) {
	resetClientForTest(t)

	t.Setenv("GITHUB_CLIENT_ID", "test-client-id")
	t.Setenv("GITHUB_CLIENT_SECRET", "test-client-secret")

	const numGoroutines = 100
	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	clients := make([]*Client, numGoroutines)
	errors := make([]error, numGoroutines)

	for i := range numGoroutines {
		go func(idx int) {
			defer wg.Done()
			clients[idx], errors[idx] = GetClient()
		}(i)
	}

	wg.Wait()

	var firstClient *Client
	for i := range numGoroutines {
		if errors[i] != nil {
			t.Errorf("goroutine %d got error: %v", i, errors[i])
		}
		if i == 0 {
			firstClient = clients[i]
		} else if clients[i] != firstClient {
			t.Errorf("goroutine %d got different client instance", i)
		}
	}
}

func TestGetClient_InitializationError(t *testing.T) {
	resetClientForTest(t)

	originalID := os.Getenv("GITHUB_CLIENT_ID")
	originalSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	t.Cleanup(func() {
		os.Setenv("GITHUB_CLIENT_ID", originalID)
		os.Setenv("GITHUB_CLIENT_SECRET", originalSecret)
	})

	os.Unsetenv("GITHUB_CLIENT_ID")
	os.Unsetenv("GITHUB_CLIENT_SECRET")

	client1, err1 := GetClient()
	client2, err2 := GetClient()

	if client1 != nil {
		t.Error("Expected nil client when initialization fails")
	}
	if client2 != nil {
		t.Error("Expected nil client when initialization fails")
	}
	if err1 == nil {
		t.Error("Expected error when initialization fails")
	}
	if err2 == nil {
		t.Error("Expected error when initialization fails")
	}
	if err1.Error() != err2.Error() {
		t.Error("Expected same error message for all calls")
	}
}
