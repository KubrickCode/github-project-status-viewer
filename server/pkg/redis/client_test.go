package redis

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	tests := []struct {
		apiToken string
		apiURL   string
		name     string
		wantErr  bool
	}{
		{
			apiURL:   "https://test-redis.upstash.io",
			apiToken: "test-token",
			name:     "valid configuration",
			wantErr:  false,
		},
		{
			apiURL:   "",
			apiToken: "test-token",
			name:     "missing URL",
			wantErr:  true,
		},
		{
			apiURL:   "https://test-redis.upstash.io",
			apiToken: "",
			name:     "missing token",
			wantErr:  true,
		},
		{
			apiURL:   "",
			apiToken: "",
			name:     "missing both credentials",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("KV_REST_API_URL", tt.apiURL)
			t.Setenv("KV_REST_API_TOKEN", tt.apiToken)

			client, err := NewClient()
			if (err != nil) != tt.wantErr {
				t.Errorf("NewClient() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if client.baseURL != tt.apiURL {
					t.Errorf("baseURL = %v, want %v", client.baseURL, tt.apiURL)
				}
				if client.token != tt.apiToken {
					t.Errorf("token = %v, want %v", client.token, tt.apiToken)
				}
				if client.client == nil {
					t.Error("HTTP client is nil")
				}
			}
		})
	}
}

func TestClient_Set(t *testing.T) {
	tests := []struct {
		expiration     time.Duration
		key            string
		name           string
		responseBody   upstashResponse
		responseStatus int
		value          string
		wantErr        bool
	}{
		{
			key:            "test-key",
			name:           "successful set without expiration",
			value:          "test-value",
			expiration:     0,
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: "OK",
			},
			wantErr: false,
		},
		{
			key:            "test-key-ttl",
			name:           "successful set with expiration",
			value:          "test-value",
			expiration:     60 * time.Second,
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: "OK",
			},
			wantErr: false,
		},
		{
			key:            "error-key",
			name:           "redis error response",
			value:          "test-value",
			expiration:     0,
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Error: "ERR syntax error",
			},
			wantErr: true,
		},
		{
			key:            "http-error",
			name:           "HTTP error response",
			value:          "test-value",
			expiration:     0,
			responseStatus: http.StatusInternalServerError,
			responseBody:   upstashResponse{},
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost {
					t.Errorf("Expected POST request, got %s", r.Method)
				}

				authHeader := r.Header.Get("Authorization")
				if authHeader == "" {
					t.Error("Authorization header is missing")
				}

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.responseStatus)
				json.NewEncoder(w).Encode(tt.responseBody)
			}))
			defer server.Close()

			client := &Client{
				baseURL: server.URL,
				token:   "test-token",
				client:  &http.Client{Timeout: defaultTimeout},
			}

			err := client.Set(tt.key, tt.value, tt.expiration)
			if (err != nil) != tt.wantErr {
				t.Errorf("Set() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestClient_Get(t *testing.T) {
	tests := []struct {
		key            string
		name           string
		responseBody   upstashResponse
		responseStatus int
		wantErr        bool
		wantValue      string
	}{
		{
			key:            "existing-key",
			name:           "successful get",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: "test-value",
			},
			wantValue: "test-value",
			wantErr:   false,
		},
		{
			key:            "missing-key",
			name:           "key not found",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: nil,
			},
			wantValue: "",
			wantErr:   true,
		},
		{
			key:            "error-key",
			name:           "redis error",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Error: "ERR invalid key",
			},
			wantErr: true,
		},
		{
			key:            "type-error-key",
			name:           "unexpected response type",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: 12345,
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
				baseURL: server.URL,
				token:   "test-token",
				client:  &http.Client{Timeout: defaultTimeout},
			}

			value, err := client.Get(tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("Get() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && value != tt.wantValue {
				t.Errorf("Get() value = %v, want %v", value, tt.wantValue)
			}
		})
	}
}

func TestClient_Delete(t *testing.T) {
	tests := []struct {
		key            string
		name           string
		responseBody   upstashResponse
		responseStatus int
		wantErr        bool
	}{
		{
			key:            "existing-key",
			name:           "successful delete",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: float64(1),
			},
			wantErr: false,
		},
		{
			key:            "missing-key",
			name:           "delete non-existent key",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: float64(0),
			},
			wantErr: false,
		},
		{
			key:            "error-key",
			name:           "redis error",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Error: "ERR invalid operation",
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
				baseURL: server.URL,
				token:   "test-token",
				client:  &http.Client{Timeout: defaultTimeout},
			}

			err := client.Delete(tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("Delete() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestClient_Exists(t *testing.T) {
	tests := []struct {
		key            string
		name           string
		responseBody   upstashResponse
		responseStatus int
		wantErr        bool
		wantExists     bool
	}{
		{
			key:            "existing-key",
			name:           "key exists",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: float64(1),
			},
			wantExists: true,
			wantErr:    false,
		},
		{
			key:            "missing-key",
			name:           "key does not exist",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: float64(0),
			},
			wantExists: false,
			wantErr:    false,
		},
		{
			key:            "error-key",
			name:           "redis error",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Error: "ERR invalid key",
			},
			wantErr: true,
		},
		{
			key:            "type-error-key",
			name:           "unexpected response type",
			responseStatus: http.StatusOK,
			responseBody: upstashResponse{
				Result: "not a number",
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
				baseURL: server.URL,
				token:   "test-token",
				client:  &http.Client{Timeout: defaultTimeout},
			}

			exists, err := client.Exists(tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("Exists() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && exists != tt.wantExists {
				t.Errorf("Exists() = %v, want %v", exists, tt.wantExists)
			}
		})
	}
}

func TestGetClient(t *testing.T) {
	tests := []struct {
		apiToken string
		apiURL   string
		name     string
		wantErr  bool
	}{
		{
			apiURL:   "https://test-redis.upstash.io",
			apiToken: "test-token",
			name:     "valid configuration",
			wantErr:  false,
		},
		{
			apiURL:   "",
			apiToken: "",
			name:     "missing configuration",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("KV_REST_API_URL", tt.apiURL)
			t.Setenv("KV_REST_API_TOKEN", tt.apiToken)

			// Re-initialize the default client
			defaultClient, initError = NewClient()

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

func TestClient_SetWithDifferentExpirations(t *testing.T) {
	tests := []struct {
		expiration       time.Duration
		name             string
		shouldHaveExpiry bool
	}{
		{
			name:             "no expiration",
			expiration:       0,
			shouldHaveExpiry: false,
		},
		{
			name:             "1 minute expiration",
			expiration:       1 * time.Minute,
			shouldHaveExpiry: true,
		},
		{
			name:             "1 hour expiration",
			expiration:       1 * time.Hour,
			shouldHaveExpiry: true,
		},
		{
			name:             "30 days expiration",
			expiration:       30 * 24 * time.Hour,
			shouldHaveExpiry: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var cmd []any
				if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
					t.Fatalf("Failed to decode command: %v", err)
				}

				// Verify command structure
				if cmd[0] != "SET" {
					t.Errorf("Expected SET command, got %v", cmd[0])
				}

				hasExpiry := len(cmd) > 3 && cmd[3] == "EX"
				if hasExpiry != tt.shouldHaveExpiry {
					t.Errorf("Command has expiry = %v, want %v. Command: %v", hasExpiry, tt.shouldHaveExpiry, cmd)
				}

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(upstashResponse{Result: "OK"})
			}))
			defer server.Close()

			client := &Client{
				baseURL: server.URL,
				token:   "test-token",
				client:  &http.Client{Timeout: defaultTimeout},
			}

			err := client.Set("test-key", "test-value", tt.expiration)
			if err != nil {
				t.Errorf("Set() error = %v", err)
			}
		})
	}
}

func TestClient_HTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Internal Server Error"))
	}))
	defer server.Close()

	client := &Client{
		baseURL: server.URL,
		token:   "test-token",
		client:  &http.Client{Timeout: defaultTimeout},
	}

	err := client.Set("test-key", "test-value", 0)
	if err == nil {
		t.Error("Expected error for HTTP 500, got nil")
	}
}

func TestClient_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("invalid json"))
	}))
	defer server.Close()

	client := &Client{
		baseURL: server.URL,
		token:   "test-token",
		client:  &http.Client{Timeout: defaultTimeout},
	}

	_, err := client.Get("test-key")
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

func TestConstants(t *testing.T) {
	if RefreshTokenKeyPrefix != "refresh_token:" {
		t.Errorf("RefreshTokenKeyPrefix = %v, want refresh_token:", RefreshTokenKeyPrefix)
	}

	if SessionKeyPrefix != "session:" {
		t.Errorf("SessionKeyPrefix = %v, want session:", SessionKeyPrefix)
	}

	if RefreshTokenTTL != 30*24*time.Hour {
		t.Errorf("RefreshTokenTTL = %v, want %v", RefreshTokenTTL, 30*24*time.Hour)
	}

	if SessionTTL != 30*24*time.Hour {
		t.Errorf("SessionTTL = %v, want %v", SessionTTL, 30*24*time.Hour)
	}
}
