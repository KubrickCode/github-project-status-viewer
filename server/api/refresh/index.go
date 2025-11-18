package handler

import (
	"net/http"

	"github-project-status-viewer-server/pkg/crypto"
	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/jwt"
	"github-project-status-viewer-server/pkg/oauth"
	"github-project-status-viewer-server/pkg/redis"
)

type RefreshResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
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

	refreshToken := tokenString[7:]
	claims, err := jwt.ValidateRefreshToken(refreshToken)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "invalid_refresh_token", err.Error())
		return
	}

	redisClient, err := redis.GetClient()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Redis connection failed")
		return
	}

	storedSessionID, err := redisClient.Get(redis.RefreshTokenKeyPrefix + claims.RefreshTokenID)
	if err != nil {
		if err == redis.ErrKeyNotFound {
			httputil.WriteError(w, http.StatusUnauthorized, "refresh_token_revoked", "Refresh token has been revoked or expired")
		} else {
			httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to verify refresh token")
		}
		return
	}

	if storedSessionID != claims.SessionID {
		httputil.WriteError(w, http.StatusUnauthorized, "session_mismatch", "Session mismatch detected")
		return
	}

	exists, err := redisClient.Exists(redis.SessionKeyPrefix + claims.SessionID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to check session")
		return
	}

	if !exists {
		httputil.WriteError(w, http.StatusUnauthorized, "session_not_found", "Session expired or invalid")
		return
	}

	if err := redisClient.Delete(redis.RefreshTokenKeyPrefix + claims.RefreshTokenID); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to revoke old refresh token")
		return
	}

	newRefreshTokenID, err := crypto.GenerateRefreshTokenID()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to generate refresh token ID")
		return
	}

	if err := redisClient.Set(redis.RefreshTokenKeyPrefix+newRefreshTokenID, claims.SessionID, redis.RefreshTokenTTL); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to store new refresh token")
		return
	}

	newAccessToken, err := jwt.GenerateAccessToken(claims.SessionID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to generate access token")
		return
	}

	newRefreshToken, err := jwt.GenerateRefreshToken(newRefreshTokenID, claims.SessionID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "Failed to generate refresh token")
		return
	}

	httputil.JSON(w, http.StatusOK, RefreshResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
	})
}
