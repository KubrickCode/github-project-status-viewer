package jwt

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	AccessTokenExpiration  = 15 * time.Minute
	RefreshTokenExpiration = 30 * 24 * time.Hour
	TokenIssuer            = "github-project-status-viewer"
)

type AccessTokenClaims struct {
	SessionID string `json:"session_id"`
	jwt.RegisteredClaims
}

type RefreshTokenClaims struct {
	RefreshTokenID string `json:"refresh_token_id"`
	SessionID      string `json:"session_id"`
	jwt.RegisteredClaims
}

type Manager struct {
	secret []byte
}

var (
	defaultManager *Manager
	initError      error
)

func init() {
	defaultManager, initError = NewManager()
}

func GetManager() (*Manager, error) {
	if initError != nil {
		return nil, initError
	}
	return defaultManager, nil
}

func NewManager() (*Manager, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return nil, fmt.Errorf("JWT_SECRET not configured")
	}
	return &Manager{secret: []byte(secret)}, nil
}

func (m *Manager) GenerateAccessToken(sessionID string) (string, error) {
	claims := AccessTokenClaims{
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenExpiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    TokenIssuer,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *Manager) GenerateRefreshToken(refreshTokenID, sessionID string) (string, error) {
	claims := RefreshTokenClaims{
		RefreshTokenID: refreshTokenID,
		SessionID:      sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(RefreshTokenExpiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    TokenIssuer,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *Manager) ValidateAccessToken(tokenString string) (*AccessTokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &AccessTokenClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse access token: %w", err)
	}

	claims, ok := token.Claims.(*AccessTokenClaims)
	if !ok {
		return nil, fmt.Errorf("invalid access token claims type")
	}

	return claims, nil
}

func (m *Manager) ValidateRefreshToken(tokenString string) (*RefreshTokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &RefreshTokenClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse refresh token: %w", err)
	}

	claims, ok := token.Claims.(*RefreshTokenClaims)
	if !ok {
		return nil, fmt.Errorf("invalid refresh token claims type")
	}

	return claims, nil
}

func GenerateAccessToken(sessionID string) (string, error) {
	manager, err := GetManager()
	if err != nil {
		return "", err
	}
	return manager.GenerateAccessToken(sessionID)
}

func GenerateRefreshToken(refreshTokenID, sessionID string) (string, error) {
	manager, err := GetManager()
	if err != nil {
		return "", err
	}
	return manager.GenerateRefreshToken(refreshTokenID, sessionID)
}

func ValidateAccessToken(tokenString string) (*AccessTokenClaims, error) {
	manager, err := GetManager()
	if err != nil {
		return nil, err
	}
	return manager.ValidateAccessToken(tokenString)
}

func ValidateRefreshToken(tokenString string) (*RefreshTokenClaims, error) {
	manager, err := GetManager()
	if err != nil {
		return nil, err
	}
	return manager.ValidateRefreshToken(tokenString)
}
