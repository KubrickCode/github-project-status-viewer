package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github-project-status-viewer-server/pkg/auth"
	"github-project-status-viewer-server/pkg/github"
	"github-project-status-viewer-server/pkg/httputil"
	"github-project-status-viewer-server/pkg/oauth"
)

const maxIssueNumbers = 100

type StatusRequest struct {
	IssueNumbers []int  `json:"issueNumbers"`
	Owner        string `json:"owner"`
	Repo         string `json:"repo"`
}

type StatusResponse struct {
	Statuses []github.IssueStatus `json:"statuses"`
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

	var req StatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Owner == "" || req.Repo == "" || len(req.IssueNumbers) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "invalid_request", "owner, repo, and issueNumbers are required")
		return
	}

	if len(req.IssueNumbers) > maxIssueNumbers {
		httputil.WriteError(w, http.StatusBadRequest, "invalid_request", fmt.Sprintf("maximum %d issues allowed per request", maxIssueNumbers))
		return
	}

	client := github.NewClient(githubToken)
	statuses, err := client.FetchProjectStatus(r.Context(), req.Owner, req.Repo, req.IssueNumbers)
	if err != nil {
		httputil.WriteErrorWithLog(w, err, http.StatusBadGateway, "github_error", "Failed to fetch project status")
		return
	}

	httputil.JSON(w, http.StatusOK, StatusResponse{Statuses: statuses})
}
