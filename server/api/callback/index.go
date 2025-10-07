package handler

import (
	"net/http"

	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/oauth"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	oauth.SetCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET requests are supported")
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

	client, err := oauth.GetClient()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "server_error", "OAuth configuration missing")
		return
	}

	token, err := client.ExchangeCode(code)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "exchange_failed", "Failed to exchange authorization code")
		return
	}

	httputil.JSON(w, http.StatusOK, token)
}
