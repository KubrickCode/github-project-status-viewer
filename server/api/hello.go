package handler

import (
	"net/http"
	"time"

	"github-project-status-viewer-server/pkg/httputil"
)

type HelloResponse struct {
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	resp := HelloResponse{
		Message:   "Hello from GitHub Project Status Viewer Go API",
		Timestamp: time.Now().Format(time.RFC3339),
	}

	httputil.JSON(w, http.StatusOK, resp)
}
