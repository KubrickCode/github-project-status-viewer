package handler

import (
	"errors"
	"net/http"

	"github-project-status-viewer-server/pkg/auth"
	"github-project-status-viewer-server/pkg/httputil"
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

	claims, err := auth.AuthenticateRequest(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication_failed", err.Error())
		return
	}

	redisClient, err := redis.GetClient()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Redis connection failed")
		return
	}

	accessToken, err := redisClient.Get(redis.SessionKeyPrefix + claims.SessionID)
	if err != nil {
		if errors.Is(err, redis.ErrKeyNotFound) {
			httputil.WriteError(w, http.StatusUnauthorized, "session_not_found", "Session expired or invalid")
		} else {
			httputil.WriteError(w, http.StatusInternalServerError, "redis_error", "Failed to retrieve session")
		}
		return
	}

	httputil.JSON(w, http.StatusOK, VerifyResponse{AccessToken: accessToken})
}
