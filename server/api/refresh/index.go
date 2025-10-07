package handler

import (
	"encoding/json"
	"net/http"

	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/oauth"
)

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	oauth.SetCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST requests are supported")
		return
	}

	defer r.Body.Close()

	var reqBody RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid_json", "Failed to parse request body")
		return
	}

	if reqBody.RefreshToken == "" {
		httputil.WriteError(w, http.StatusBadRequest, "missing_refresh_token", "Refresh token is required")
		return
	}

	client, err := oauth.GetClient()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "OAuth configuration missing")
		return
	}

	token, err := client.RefreshToken(reqBody.RefreshToken)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "refresh_failed", "Failed to refresh token")
		return
	}

	httputil.JSON(w, http.StatusOK, token)
}
