package handler

import (
	"encoding/json"
	"net/http"

	"github-project-status-viewer-server/pkg/auth"
	"github-project-status-viewer-server/pkg/github"
	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/oauth"
)

type UpdateRequest struct {
	FieldID   string `json:"fieldId"`
	ItemID    string `json:"itemId"`
	OptionID  string `json:"optionId"`
	ProjectID string `json:"projectId"`
}

type UpdateResponse struct {
	Color  string `json:"color"`
	Status string `json:"status"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	oauth.SetCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if !httputil.EnsureMethod(w, r, http.MethodPost) {
		return
	}

	githubToken, err := auth.ExtractGitHubToken(r)
	if err != nil {
		auth.HandleTokenError(w, err)
		return
	}

	var req UpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.ProjectID == "" || req.ItemID == "" || req.FieldID == "" || req.OptionID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "invalid_request", "projectId, itemId, fieldId, and optionId are required")
		return
	}

	client := github.NewClient(githubToken)
	result, err := client.UpdateProjectStatus(r.Context(), req.ProjectID, req.ItemID, req.FieldID, req.OptionID)
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusBadGateway, "github_error", "Failed to update project status")
		return
	}

	httputil.JSON(w, http.StatusOK, UpdateResponse{
		Color:  result.Color,
		Status: result.Status,
	})
}
