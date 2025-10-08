package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/jwt"
	"github-project-status-viewer-server/pkg/oauth"
	"github-project-status-viewer-server/pkg/redis"
)

const (
	refreshTokenIDBytes = 32
	sessionIDBytes      = 32
)

type CallbackResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func generateRefreshTokenID() (string, error) {
	bytes := make([]byte, refreshTokenIDBytes)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func generateSessionID() (string, error) {
	bytes := make([]byte, sessionIDBytes)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
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
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "OAuth configuration missing")
		return
	}

	token, err := oauthClient.ExchangeCode(code)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "exchange_failed", "Failed to exchange authorization code")
		return
	}

	redisClient, err := redis.GetClient()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Redis connection failed")
		return
	}

	sessionID, err := generateSessionID()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to generate session ID")
		return
	}

	if err := redisClient.Set(redis.SessionKeyPrefix+sessionID, token.AccessToken, redis.SessionTTL); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to store session")
		return
	}

	refreshTokenID, err := generateRefreshTokenID()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to generate refresh token ID")
		return
	}

	if err := redisClient.Set(redis.RefreshTokenKeyPrefix+refreshTokenID, sessionID, redis.RefreshTokenTTL); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to store refresh token")
		return
	}

	accessToken, err := jwt.GenerateAccessToken(sessionID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to generate access token")
		return
	}

	refreshToken, err := jwt.GenerateRefreshToken(refreshTokenID, sessionID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to generate refresh token")
		return
	}

	httputil.JSON(w, http.StatusOK, CallbackResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
}
