package handler

import (
	"errors"
	"net/http"

	pkgerrors "github-project-status-viewer-server/pkg/errors"
	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/jwt"
	"github-project-status-viewer-server/pkg/oauth"
	"github-project-status-viewer-server/pkg/redis"
)

type VerifyResponse struct {
	AccessToken string `json:"access_token"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	oauth.SetCORS(w)

	if !httputil.EnsureMethod(w, r, http.MethodPost) {
		return
	}

	tokenString := r.Header.Get("Authorization")
	if len(tokenString) < 7 || tokenString[:7] != "Bearer " {
		httputil.WriteError(w, http.StatusUnauthorized, "invalid_token", "Bearer token required")
		return
	}

	accessToken := tokenString[7:]
	claims, err := jwt.ValidateAccessToken(accessToken)
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusUnauthorized, "invalid_access_token", "Invalid or expired access token")
		return
	}

	redisClient, err := redis.GetClient()
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Storage service unavailable")
		return
	}

	githubAccessToken, err := redisClient.Get(redis.SessionKeyPrefix + claims.SessionID)
	if err != nil {
		if errors.Is(err, pkgerrors.ErrKeyNotFound) {
			httputil.WriteErrorWithLog(w, pkgerrors.ErrSessionNotFound, http.StatusUnauthorized, "session_not_found", "Session expired or invalid")
		} else {
			httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Failed to retrieve session")
		}
		return
	}

	httputil.JSON(w, http.StatusOK, VerifyResponse{AccessToken: githubAccessToken})
}
