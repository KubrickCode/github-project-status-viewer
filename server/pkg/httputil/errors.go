package httputil

import (
	"errors"
	"log/slog"
	"net/http"

	pkgerrors "github-project-status-viewer-server/pkg/errors"
)

type ErrorResponse struct {
	Code        string
	Description string
	StatusCode  int
}

var errorResponses = map[error]ErrorResponse{
	pkgerrors.ErrBearerTokenRequired:       {StatusCode: http.StatusUnauthorized, Code: "invalid_token", Description: "Bearer token required"},
	pkgerrors.ErrInvalidAccessTokenClaims:  {StatusCode: http.StatusUnauthorized, Code: "invalid_access_token", Description: "Invalid authentication token"},
	pkgerrors.ErrInvalidAuthHeader:         {StatusCode: http.StatusUnauthorized, Code: "invalid_token", Description: "Invalid authorization header format"},
	pkgerrors.ErrInvalidRefreshTokenClaims: {StatusCode: http.StatusUnauthorized, Code: "invalid_refresh_token", Description: "Invalid refresh token"},
	pkgerrors.ErrInvalidSigningMethod:      {StatusCode: http.StatusUnauthorized, Code: "invalid_token", Description: "Invalid token signature"},
	pkgerrors.ErrInvalidTokenFormat:        {StatusCode: http.StatusUnauthorized, Code: "invalid_token", Description: "Invalid token format"},
	pkgerrors.ErrJWTSecretMissing:          {StatusCode: http.StatusInternalServerError, Code: "server_error", Description: "Service configuration error"},
	pkgerrors.ErrKeyNotFound:               {StatusCode: http.StatusUnauthorized, Code: "session_not_found", Description: "Session expired or invalid"},
	pkgerrors.ErrMethodNotAllowed:          {StatusCode: http.StatusMethodNotAllowed, Code: "method_not_allowed", Description: "HTTP method not allowed"},
	pkgerrors.ErrMissingAuthCode:           {StatusCode: http.StatusBadRequest, Code: "missing_code", Description: "Authorization code is required"},
	pkgerrors.ErrMissingStateParam:         {StatusCode: http.StatusBadRequest, Code: "missing_state", Description: "State parameter is required for CSRF protection"},
	pkgerrors.ErrOAuthConfigMissing:        {StatusCode: http.StatusInternalServerError, Code: "server_error", Description: "OAuth configuration error"},
	pkgerrors.ErrOAuthExchangeFailed:       {StatusCode: http.StatusBadRequest, Code: "exchange_failed", Description: "Failed to exchange authorization code"},
	pkgerrors.ErrOAuthRequestFailed:        {StatusCode: http.StatusBadGateway, Code: "oauth_error", Description: "OAuth service unavailable"},
	pkgerrors.ErrRedisConfigMissing:        {StatusCode: http.StatusInternalServerError, Code: "server_error", Description: "Storage configuration error"},
	pkgerrors.ErrRedisRequestFailed:        {StatusCode: http.StatusInternalServerError, Code: "server_error", Description: "Storage service error"},
	pkgerrors.ErrRefreshTokenRevoked:       {StatusCode: http.StatusUnauthorized, Code: "refresh_token_revoked", Description: "Refresh token has been revoked or expired"},
	pkgerrors.ErrSessionExpired:            {StatusCode: http.StatusUnauthorized, Code: "session_expired", Description: "Session expired or invalid"},
	pkgerrors.ErrSessionMismatch:           {StatusCode: http.StatusUnauthorized, Code: "session_mismatch", Description: "Session mismatch detected"},
	pkgerrors.ErrSessionNotFound:           {StatusCode: http.StatusUnauthorized, Code: "session_not_found", Description: "Session not found"},
	pkgerrors.ErrTokenExpired:              {StatusCode: http.StatusUnauthorized, Code: "token_expired", Description: "Token has expired"},
	pkgerrors.ErrUnexpectedResponse:        {StatusCode: http.StatusInternalServerError, Code: "server_error", Description: "Unexpected response from storage"},
}

func WriteErrorWithLog(w http.ResponseWriter, internalErr error, fallbackStatus int, fallbackCode, fallbackDescription string) {
	response := getErrorResponse(internalErr, fallbackStatus, fallbackCode, fallbackDescription)

	slog.Error("API error occurred",
		"status", response.StatusCode,
		"code", response.Code,
		"description", response.Description,
		"internal_error", internalErr,
	)

	WriteError(w, response.StatusCode, response.Code, response.Description)
}

func getErrorResponse(err error, fallbackStatus int, fallbackCode, fallbackDescription string) ErrorResponse {
	for sentinelErr, response := range errorResponses {
		if errors.Is(err, sentinelErr) {
			return response
		}
	}

	return ErrorResponse{
		Code:        fallbackCode,
		Description: fallbackDescription,
		StatusCode:  fallbackStatus,
	}
}
