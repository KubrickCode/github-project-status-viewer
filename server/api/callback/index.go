package handler

import (
	"net/http"

	"github-project-status-viewer-server/pkg/crypto"
	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/jwt"
	"github-project-status-viewer-server/pkg/oauth"
	"github-project-status-viewer-server/pkg/redis"
)

type CallbackResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	oauth.SetCORS(w)

	if !httputil.EnsureMethod(w, r, http.MethodGet) {
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" {
		httputil.WriteError(w, http.StatusBadRequest, "missing_code", "Authorization code is required")
		return
	}

	// TODO: Validate state parameter against stored value for CSRF protection
	// 1. Extension should generate random state before OAuth redirect
	// 2. Store state securely (e.g., chrome.storage or session)
	// 3. Send state to this endpoint for validation
	// 4. Compare received state with stored state
	if state == "" {
		httputil.WriteError(w, http.StatusBadRequest, "missing_state", "State parameter is required for CSRF protection")
		return
	}

	oauthClient, err := oauth.GetClient()
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "OAuth service unavailable")
		return
	}

	token, err := oauthClient.ExchangeCode(code)
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusBadRequest, "exchange_failed", "Failed to exchange authorization code")
		return
	}

	redisClient, err := redis.GetClient()
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Storage service unavailable")
		return
	}

	sessionID, err := crypto.GenerateSessionID()
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Failed to create session")
		return
	}

	if err := redisClient.Set(redis.SessionKeyPrefix+sessionID, token.AccessToken, redis.SessionTTL); err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Failed to store session")
		return
	}

	refreshTokenID, err := crypto.GenerateRefreshTokenID()
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Failed to create session")
		return
	}

	if err := redisClient.Set(redis.RefreshTokenKeyPrefix+refreshTokenID, sessionID, redis.RefreshTokenTTL); err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Failed to store session")
		return
	}

	accessToken, err := jwt.GenerateAccessToken(sessionID)
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Failed to create access token")
		return
	}

	refreshToken, err := jwt.GenerateRefreshToken(refreshTokenID, sessionID)
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusInternalServerError, "server_error", "Failed to create refresh token")
		return
	}

	httputil.JSON(w, http.StatusOK, CallbackResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
}
