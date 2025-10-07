package jwt

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	TokenExpiration = 2 * time.Hour
	TokenIssuer     = "github-project-status-viewer"
)

type Claims struct {
	SessionID string `json:"session_id"`
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

func (m *Manager) GenerateToken(sessionID string) (string, error) {
	claims := Claims{
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(TokenExpiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    TokenIssuer,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *Manager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims type")
	}

	return claims, nil
}

func GenerateToken(sessionID string) (string, error) {
	manager, err := GetManager()
	if err != nil {
		return "", err
	}
	return manager.GenerateToken(sessionID)
}

func ValidateToken(tokenString string) (*Claims, error) {
	manager, err := GetManager()
	if err != nil {
		return nil, err
	}
	return manager.ValidateToken(tokenString)
}
