package auth

import (
	"net/http"
	"strings"

	"github-project-status-viewer-server/pkg/jwt"
)

func AuthenticateRequest(r *http.Request) (*jwt.Claims, error) {
	tokenString, err := extractBearerToken(r)
	if err != nil {
		return nil, err
	}

	claims, err := jwt.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	return claims, nil
}

func extractBearerToken(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	token, found := strings.CutPrefix(authHeader, "Bearer ")
	if !found || token == "" {
		return "", ErrInvalidAuthHeader
	}
	return token, nil
}
