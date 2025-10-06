package oauth

import (
	"net/http"
	"os"
)

func SetCORS(w http.ResponseWriter) {
	extensionID := os.Getenv("CHROME_EXTENSION_ID")
	if extensionID != "" {
		allowedOrigin := "chrome-extension://" + extensionID
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	}
}
