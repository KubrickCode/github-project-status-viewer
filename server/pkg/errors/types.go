package errors

import "errors"

// Configuration errors
var (
	ErrJWTSecretMissing    = errors.New("JWT_SECRET not configured")
	ErrOAuthConfigMissing  = errors.New("OAuth configuration missing")
	ErrRedisConfigMissing  = errors.New("upstash redis configuration missing")
	ErrInvalidAuthHeader   = errors.New("authorization header must be 'Bearer <token>'")
	ErrMissingAuthCode     = errors.New("authorization code is required")
	ErrMissingStateParam   = errors.New("state parameter is required for CSRF protection")
	ErrBearerTokenRequired = errors.New("bearer token required")
)

// Token errors
var (
	ErrInvalidTokenFormat        = errors.New("invalid token format")
	ErrTokenExpired              = errors.New("token expired")
	ErrInvalidSigningMethod      = errors.New("unexpected signing method")
	ErrInvalidAccessTokenClaims  = errors.New("invalid access token claims type")
	ErrInvalidRefreshTokenClaims = errors.New("invalid refresh token claims type")
	ErrSessionNotFound           = errors.New("session not found")
	ErrSessionExpired            = errors.New("session expired or invalid")
	ErrSessionMismatch           = errors.New("session mismatch detected")
	ErrRefreshTokenRevoked       = errors.New("refresh token has been revoked or expired")
)

// OAuth errors
var (
	ErrOAuthExchangeFailed  = errors.New("failed to exchange authorization code")
	ErrOAuthRequestFailed   = errors.New("OAuth request failed")
	ErrAuthenticationFailed = errors.New("authentication failed")
)

// Redis errors
var (
	ErrKeyNotFound        = errors.New("key not found")
	ErrRedisRequestFailed = errors.New("redis request failed")
	ErrUnexpectedResponse = errors.New("unexpected response type")
)

// Crypto errors
var (
	ErrRandomGeneration = errors.New("failed to generate random bytes")
)

// HTTP errors
var (
	ErrMethodNotAllowed = errors.New("method not allowed")
)
