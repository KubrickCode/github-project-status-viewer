package auth

import (
	"errors"
	"net/http"
	"strings"

	pkgerrors "github-project-status-viewer-server/pkg/errors"
	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/jwt"
	"github-project-status-viewer-server/pkg/redis"
)

const bearerPrefix = "Bearer "

func ExtractGitHubToken(r *http.Request) (string, error) {
	tokenString := r.Header.Get("Authorization")
	if !strings.HasPrefix(tokenString, bearerPrefix) {
		return "", pkgerrors.ErrBearerTokenRequired
	}

	accessToken := strings.TrimPrefix(tokenString, bearerPrefix)
	claims, err := jwt.ValidateAccessToken(accessToken)
	if err != nil {
		return "", err
	}

	redisClient, err := redis.GetClient()
	if err != nil {
		return "", err
	}

	githubToken, err := redisClient.Get(redis.SessionKeyPrefix + claims.SessionID)
	if err != nil {
		if errors.Is(err, pkgerrors.ErrKeyNotFound) {
			return "", pkgerrors.ErrSessionNotFound
		}
		return "", err
	}

	return githubToken, nil
}

func HandleTokenError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, pkgerrors.ErrBearerTokenRequired):
		httputil.WriteError(w, http.StatusUnauthorized, "invalid_token", "Bearer token required")
	case errors.Is(err, pkgerrors.ErrSessionNotFound):
		httputil.WriteErrorWithLog(w, err, http.StatusUnauthorized, "session_not_found", "Session expired or invalid")
	default:
		httputil.WriteErrorWithLog(w, err, http.StatusUnauthorized, "invalid_access_token", "Invalid or expired access token")
	}
}
