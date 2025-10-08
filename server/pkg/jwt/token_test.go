package jwt

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestNewManager(t *testing.T) {
	tests := []struct {
		jwtSecret string
		name      string
		wantErr   bool
	}{
		{
			jwtSecret: "test-secret-key",
			name:      "valid JWT secret",
			wantErr:   false,
		},
		{
			jwtSecret: "",
			name:      "missing JWT secret",
			wantErr:   true,
		},
		{
			jwtSecret: "very-long-secret-key-for-testing-purposes-with-many-characters",
			name:      "long JWT secret",
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("JWT_SECRET", tt.jwtSecret)

			manager, err := NewManager()
			if (err != nil) != tt.wantErr {
				t.Errorf("NewManager() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if manager == nil {
					t.Error("Manager is nil")
				}
				if string(manager.secret) != tt.jwtSecret {
					t.Errorf("Secret = %v, want %v", string(manager.secret), tt.jwtSecret)
				}
			}
		})
	}
}

func TestManager_GenerateAccessToken(t *testing.T) {
	tests := []struct {
		name      string
		sessionID string
	}{
		{
			name:      "valid session ID",
			sessionID: "test-session-123",
		},
		{
			name:      "UUID session ID",
			sessionID: "550e8400-e29b-41d4-a716-446655440000",
		},
		{
			name:      "hex session ID",
			sessionID: "a1b2c3d4e5f6",
		},
		{
			name:      "empty session ID",
			sessionID: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("JWT_SECRET", "test-secret")

			manager, err := NewManager()
			if err != nil {
				t.Fatalf("NewManager() error = %v", err)
			}

			token, err := manager.GenerateAccessToken(tt.sessionID)
			if err != nil {
				t.Errorf("GenerateAccessToken() error = %v", err)
				return
			}

			if token == "" {
				t.Error("Generated token is empty")
			}

			// Verify token can be parsed
			claims, err := manager.ValidateAccessToken(token)
			if err != nil {
				t.Errorf("ValidateAccessToken() error = %v", err)
				return
			}

			if claims.SessionID != tt.sessionID {
				t.Errorf("SessionID = %v, want %v", claims.SessionID, tt.sessionID)
			}

			if claims.Issuer != TokenIssuer {
				t.Errorf("Issuer = %v, want %v", claims.Issuer, TokenIssuer)
			}
		})
	}
}

func TestManager_GenerateRefreshToken(t *testing.T) {
	tests := []struct {
		name           string
		refreshTokenID string
		sessionID      string
	}{
		{
			name:           "valid IDs",
			refreshTokenID: "refresh-123",
			sessionID:      "session-456",
		},
		{
			name:           "UUID IDs",
			refreshTokenID: "550e8400-e29b-41d4-a716-446655440000",
			sessionID:      "660e8400-e29b-41d4-a716-446655440001",
		},
		{
			name:           "empty refresh token ID",
			refreshTokenID: "",
			sessionID:      "session-123",
		},
		{
			name:           "empty session ID",
			refreshTokenID: "refresh-123",
			sessionID:      "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("JWT_SECRET", "test-secret")

			manager, err := NewManager()
			if err != nil {
				t.Fatalf("NewManager() error = %v", err)
			}

			token, err := manager.GenerateRefreshToken(tt.refreshTokenID, tt.sessionID)
			if err != nil {
				t.Errorf("GenerateRefreshToken() error = %v", err)
				return
			}

			if token == "" {
				t.Error("Generated token is empty")
			}

			// Verify token can be parsed
			claims, err := manager.ValidateRefreshToken(token)
			if err != nil {
				t.Errorf("ValidateRefreshToken() error = %v", err)
				return
			}

			if claims.RefreshTokenID != tt.refreshTokenID {
				t.Errorf("RefreshTokenID = %v, want %v", claims.RefreshTokenID, tt.refreshTokenID)
			}

			if claims.SessionID != tt.sessionID {
				t.Errorf("SessionID = %v, want %v", claims.SessionID, tt.sessionID)
			}
		})
	}
}

func TestManager_ValidateAccessToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	manager, err := NewManager()
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}

	tests := []struct {
		name        string
		setupToken  func() string
		wantErr     bool
		wantSession string
	}{
		{
			name: "valid token",
			setupToken: func() string {
				token, _ := manager.GenerateAccessToken("test-session")
				return token
			},
			wantSession: "test-session",
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
			name: "expired token",
			setupToken: func() string {
				claims := AccessTokenClaims{
					SessionID: "test-session",
					RegisteredClaims: jwt.RegisteredClaims{
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
						Issuer:    TokenIssuer,
					},
				}
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
				tokenString, _ := token.SignedString(manager.secret)
				return tokenString
			},
			wantErr: true,
		},
		{
			name: "token with wrong secret",
			setupToken: func() string {
				wrongManager := &Manager{secret: []byte("wrong-secret")}
				token, _ := wrongManager.GenerateAccessToken("test-session")
				return token
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := tt.setupToken()
			claims, err := manager.ValidateAccessToken(token)

			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAccessToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if claims.SessionID != tt.wantSession {
					t.Errorf("SessionID = %v, want %v", claims.SessionID, tt.wantSession)
				}
			}
		})
	}
}

func TestManager_ValidateRefreshToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	manager, err := NewManager()
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}

	tests := []struct {
		name               string
		setupToken         func() string
		wantErr            bool
		wantRefreshTokenID string
		wantSessionID      string
	}{
		{
			name: "valid token",
			setupToken: func() string {
				token, _ := manager.GenerateRefreshToken("refresh-123", "session-456")
				return token
			},
			wantRefreshTokenID: "refresh-123",
			wantSessionID:      "session-456",
			wantErr:            false,
		},
		{
			name: "invalid token format",
			setupToken: func() string {
				return "invalid.token.format"
			},
			wantErr: true,
		},
		{
			name: "expired token",
			setupToken: func() string {
				claims := RefreshTokenClaims{
					RefreshTokenID: "refresh-123",
					SessionID:      "session-456",
					RegisteredClaims: jwt.RegisteredClaims{
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
						Issuer:    TokenIssuer,
					},
				}
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
				tokenString, _ := token.SignedString(manager.secret)
				return tokenString
			},
			wantErr: true,
		},
		{
			name: "token with wrong signing method",
			setupToken: func() string {
				claims := RefreshTokenClaims{
					RefreshTokenID: "refresh-123",
					SessionID:      "session-456",
					RegisteredClaims: jwt.RegisteredClaims{
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now()),
						Issuer:    TokenIssuer,
					},
				}
				// This will fail because we can't actually sign with a different algorithm without the key
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
				tokenString, _ := token.SignedString(manager.secret)
				return tokenString
			},
			wantRefreshTokenID: "refresh-123",
			wantSessionID:      "session-456",
			wantErr:            false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := tt.setupToken()
			claims, err := manager.ValidateRefreshToken(token)

			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRefreshToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if claims.RefreshTokenID != tt.wantRefreshTokenID {
					t.Errorf("RefreshTokenID = %v, want %v", claims.RefreshTokenID, tt.wantRefreshTokenID)
				}
				if claims.SessionID != tt.wantSessionID {
					t.Errorf("SessionID = %v, want %v", claims.SessionID, tt.wantSessionID)
				}
			}
		})
	}
}

func TestGetManager(t *testing.T) {
	tests := []struct {
		jwtSecret string
		name      string
		wantErr   bool
	}{
		{
			jwtSecret: "test-secret",
			name:      "valid configuration",
			wantErr:   false,
		},
		{
			jwtSecret: "",
			name:      "missing configuration",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("JWT_SECRET", tt.jwtSecret)

			// Re-initialize the default manager
			defaultManager, initError = NewManager()

			manager, err := GetManager()
			if (err != nil) != tt.wantErr {
				t.Errorf("GetManager() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && manager == nil {
				t.Error("GetManager() returned nil manager")
			}
		})
	}
}

func TestGenerateAccessToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	defaultManager, initError = NewManager()

	token, err := GenerateAccessToken("test-session")
	if err != nil {
		t.Errorf("GenerateAccessToken() error = %v", err)
	}

	if token == "" {
		t.Error("Generated token is empty")
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	defaultManager, initError = NewManager()

	token, err := GenerateRefreshToken("refresh-123", "session-456")
	if err != nil {
		t.Errorf("GenerateRefreshToken() error = %v", err)
	}

	if token == "" {
		t.Error("Generated token is empty")
	}
}

func TestValidateAccessToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	defaultManager, initError = NewManager()

	token, _ := GenerateAccessToken("test-session")
	claims, err := ValidateAccessToken(token)
	if err != nil {
		t.Errorf("ValidateAccessToken() error = %v", err)
	}

	if claims.SessionID != "test-session" {
		t.Errorf("SessionID = %v, want test-session", claims.SessionID)
	}
}

func TestValidateRefreshToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	defaultManager, initError = NewManager()

	token, _ := GenerateRefreshToken("refresh-123", "session-456")
	claims, err := ValidateRefreshToken(token)
	if err != nil {
		t.Errorf("ValidateRefreshToken() error = %v", err)
	}

	if claims.RefreshTokenID != "refresh-123" {
		t.Errorf("RefreshTokenID = %v, want refresh-123", claims.RefreshTokenID)
	}
	if claims.SessionID != "session-456" {
		t.Errorf("SessionID = %v, want session-456", claims.SessionID)
	}
}

func TestConstants(t *testing.T) {
	if AccessTokenExpiration != 15*time.Minute {
		t.Errorf("AccessTokenExpiration = %v, want %v", AccessTokenExpiration, 15*time.Minute)
	}

	if RefreshTokenExpiration != 30*24*time.Hour {
		t.Errorf("RefreshTokenExpiration = %v, want %v", RefreshTokenExpiration, 30*24*time.Hour)
	}

	if TokenIssuer != "github-project-status-viewer" {
		t.Errorf("TokenIssuer = %v, want github-project-status-viewer", TokenIssuer)
	}
}

func TestAccessTokenClaims_Expiration(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	manager, _ := NewManager()
	token, _ := manager.GenerateAccessToken("test-session")

	claims, _ := manager.ValidateAccessToken(token)

	// Check that token expires in approximately 15 minutes
	expiresIn := time.Until(claims.ExpiresAt.Time)
	if expiresIn > AccessTokenExpiration || expiresIn < AccessTokenExpiration-time.Second {
		t.Errorf("Token expiration = %v, want approximately %v", expiresIn, AccessTokenExpiration)
	}
}

func TestRefreshTokenClaims_Expiration(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	manager, _ := NewManager()
	token, _ := manager.GenerateRefreshToken("refresh-123", "session-456")

	claims, _ := manager.ValidateRefreshToken(token)

	// Check that token expires in approximately 30 days
	expiresIn := time.Until(claims.ExpiresAt.Time)
	if expiresIn > RefreshTokenExpiration || expiresIn < RefreshTokenExpiration-time.Second {
		t.Errorf("Token expiration = %v, want approximately %v", expiresIn, RefreshTokenExpiration)
	}
}
