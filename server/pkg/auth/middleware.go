package auth

import (
	"github-project-status-viewer-server/pkg/jwt"
)

func ValidateAccessToken(tokenString string) (*jwt.AccessTokenClaims, error) {
	claims, err := jwt.ValidateAccessToken(tokenString)
	if err != nil {
		return nil, err
	}

	return claims, nil
}
