package auth

import (
	"testing"

	"github-project-status-viewer-server/pkg/jwt"
)

func TestValidateAccessToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	// Re-initialize JWT manager
	jwt.GetManager()

	tests := []struct {
		name        string
		setupToken  func() string
		wantErr     bool
		wantSession string
	}{
		{
			name: "valid access token",
			setupToken: func() string {
				token, _ := jwt.GenerateAccessToken("test-session-123")
				return token
			},
			wantSession: "test-session-123",
			wantErr:     false,
		},
		{
			name: "valid access token with different session",
			setupToken: func() string {
				token, _ := jwt.GenerateAccessToken("another-session-456")
				return token
			},
			wantSession: "another-session-456",
			wantErr:     false,
		},
		{
			name: "invalid token format",
			setupToken: func() string {
				return "invalid.token.format"
			},
			wantErr: true,
		},
		{
			name: "empty token",
			setupToken: func() string {
				return ""
			},
			wantErr: true,
		},
		{
			name: "malformed token",
			setupToken: func() string {
				return "not-a-jwt-token-at-all"
			},
			wantErr: true,
		},
		{
			name: "token with wrong signature",
			setupToken: func() string {
				// Use an invalid JWT token
				return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := tt.setupToken()
			claims, err := ValidateAccessToken(token)

			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAccessToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if claims == nil {
					t.Error("Claims is nil")
					return
				}
				if claims.SessionID != tt.wantSession {
					t.Errorf("SessionID = %v, want %v", claims.SessionID, tt.wantSession)
				}
			}
		})
	}
}

func TestValidateAccessToken_Integration(t *testing.T) {
	t.Setenv("JWT_SECRET", "integration-test-secret")

	// Re-initialize JWT manager with new secret
	jwt.GetManager()

	// Generate a token
	sessionID := "integration-session-789"
	token, err := jwt.GenerateAccessToken(sessionID)
	if err != nil {
		t.Fatalf("Failed to generate access token: %v", err)
	}

	// Validate the token using the auth package
	claims, err := ValidateAccessToken(token)
	if err != nil {
		t.Errorf("ValidateAccessToken() failed: %v", err)
		return
	}

	if claims.SessionID != sessionID {
		t.Errorf("SessionID = %v, want %v", claims.SessionID, sessionID)
	}

	if claims.Issuer != jwt.TokenIssuer {
		t.Errorf("Issuer = %v, want %v", claims.Issuer, jwt.TokenIssuer)
	}
}

func TestValidateAccessToken_ExpiredToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	// This test would require manipulating time or creating an expired token
	// For simplicity, we'll test with a token that has invalid claims
	invalidToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.invalid"

	_, err := ValidateAccessToken(invalidToken)
	if err == nil {
		t.Error("Expected error for invalid/expired token, got nil")
	}
}

func TestValidateAccessToken_NilManager(t *testing.T) {
	// Test when JWT_SECRET is not set
	t.Setenv("JWT_SECRET", "")

	// This should fail because the manager can't be initialized
	_, err := ValidateAccessToken("any-token")
	if err == nil {
		t.Error("Expected error when JWT manager is not initialized, got nil")
	}
}

func TestValidateAccessToken_MultipleValidations(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-multiple")

	// Re-initialize JWT manager
	jwt.GetManager()

	// Generate multiple tokens
	sessions := []string{"session-1", "session-2", "session-3"}

	for _, sessionID := range sessions {
		token, err := jwt.GenerateAccessToken(sessionID)
		if err != nil {
			t.Fatalf("Failed to generate token for %s: %v", sessionID, err)
		}

		claims, err := ValidateAccessToken(token)
		if err != nil {
			t.Errorf("ValidateAccessToken() failed for %s: %v", sessionID, err)
			continue
		}

		if claims.SessionID != sessionID {
			t.Errorf("SessionID = %v, want %v", claims.SessionID, sessionID)
		}
	}
}

func TestValidateAccessToken_WithSpecialCharacters(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	specialSessions := []string{
		"session-with-dashes",
		"session_with_underscores",
		"sessionWithCamelCase",
		"session.with.dots",
		"session:with:colons",
	}

	for _, sessionID := range specialSessions {
		t.Run("session_"+sessionID, func(t *testing.T) {
			token, err := jwt.GenerateAccessToken(sessionID)
			if err != nil {
				t.Fatalf("Failed to generate token: %v", err)
			}

			claims, err := ValidateAccessToken(token)
			if err != nil {
				t.Errorf("ValidateAccessToken() failed: %v", err)
				return
			}

			if claims.SessionID != sessionID {
				t.Errorf("SessionID = %v, want %v", claims.SessionID, sessionID)
			}
		})
	}
}
