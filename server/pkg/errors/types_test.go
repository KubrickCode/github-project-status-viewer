package errors

import (
	"errors"
	"fmt"
	"testing"
)

func TestErrorWrapping(t *testing.T) {
	tests := []struct {
		baseErr     error
		name        string
		wrapContext string
	}{
		{
			name:        "wrap JWT secret error",
			baseErr:     ErrJWTSecretMissing,
			wrapContext: "manager initialization",
		},
		{
			name:        "wrap OAuth config error",
			baseErr:     ErrOAuthConfigMissing,
			wrapContext: "client initialization",
		},
		{
			name:        "wrap session not found error",
			baseErr:     ErrSessionNotFound,
			wrapContext: "verify access token",
		},
		{
			name:        "wrap token expired error",
			baseErr:     ErrTokenExpired,
			wrapContext: "validate refresh token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wrappedErr := fmt.Errorf("%s: %w", tt.wrapContext, tt.baseErr)

			if !errors.Is(wrappedErr, tt.baseErr) {
				t.Errorf("errors.Is() failed: wrapped error does not match base error")
			}

			if wrappedErr.Error() == tt.baseErr.Error() {
				t.Errorf("wrapped error message should include context, got %q", wrappedErr.Error())
			}
		})
	}
}

func TestErrorChains(t *testing.T) {
	tests := []struct {
		buildChain  func() error
		name        string
		targetError error
	}{
		{
			name:        "multi-level JWT error chain",
			targetError: ErrJWTSecretMissing,
			buildChain: func() error {
				err := ErrJWTSecretMissing
				err = fmt.Errorf("NewManager failed: %w", err)
				err = fmt.Errorf("GetManager failed: %w", err)
				return err
			},
		},
		{
			name:        "multi-level session error chain",
			targetError: ErrSessionNotFound,
			buildChain: func() error {
				err := ErrSessionNotFound
				err = fmt.Errorf("redis.Get failed: %w", err)
				err = fmt.Errorf("verify handler failed: %w", err)
				return err
			},
		},
		{
			name:        "OAuth error chain",
			targetError: ErrOAuthExchangeFailed,
			buildChain: func() error {
				err := ErrOAuthExchangeFailed
				err = fmt.Errorf("requestToken failed: %w", err)
				err = fmt.Errorf("callback handler failed: %w", err)
				return err
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chainedErr := tt.buildChain()

			if !errors.Is(chainedErr, tt.targetError) {
				t.Errorf("errors.Is() failed: error chain does not contain target error %v", tt.targetError)
			}
		})
	}
}

func TestErrorUnwrap(t *testing.T) {
	baseErr := ErrSessionNotFound
	wrappedErr := fmt.Errorf("context: %w", baseErr)

	unwrapped := errors.Unwrap(wrappedErr)
	if unwrapped != baseErr {
		t.Errorf("errors.Unwrap() = %v, want %v", unwrapped, baseErr)
	}
}

func TestErrorEquality(t *testing.T) {
	tests := []struct {
		err1   error
		err2   error
		name   string
		wantEq bool
	}{
		{
			name:   "same error instance",
			err1:   ErrSessionNotFound,
			err2:   ErrSessionNotFound,
			wantEq: true,
		},
		{
			name:   "different error instances",
			err1:   ErrSessionNotFound,
			err2:   ErrSessionExpired,
			wantEq: false,
		},
		{
			name:   "wrapped vs unwrapped same error",
			err1:   fmt.Errorf("context: %w", ErrSessionNotFound),
			err2:   ErrSessionNotFound,
			wantEq: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			equal := (tt.err1 == tt.err2)
			if equal != tt.wantEq {
				t.Errorf("error equality = %v, want %v", equal, tt.wantEq)
			}
		})
	}
}

func TestErrorIsComparison(t *testing.T) {
	tests := []struct {
		err    error
		name   string
		target error
		want   bool
	}{
		{
			name:   "exact match",
			err:    ErrSessionNotFound,
			target: ErrSessionNotFound,
			want:   true,
		},
		{
			name:   "wrapped error matches",
			err:    fmt.Errorf("context: %w", ErrSessionNotFound),
			target: ErrSessionNotFound,
			want:   true,
		},
		{
			name:   "different errors",
			err:    ErrSessionNotFound,
			target: ErrSessionExpired,
			want:   false,
		},
		{
			name:   "double wrapped error matches",
			err:    fmt.Errorf("outer: %w", fmt.Errorf("inner: %w", ErrSessionNotFound)),
			target: ErrSessionNotFound,
			want:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := errors.Is(tt.err, tt.target)
			if got != tt.want {
				t.Errorf("errors.Is() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDefinedErrors(t *testing.T) {
	errorGroups := []struct {
		name   string
		errors []error
	}{
		{
			name: "Configuration Errors",
			errors: []error{
				ErrJWTSecretMissing,
				ErrOAuthConfigMissing,
				ErrRedisConfigMissing,
			},
		},
		{
			name: "Token Errors",
			errors: []error{
				ErrInvalidTokenFormat,
				ErrTokenExpired,
				ErrInvalidSigningMethod,
				ErrInvalidAccessTokenClaims,
				ErrInvalidRefreshTokenClaims,
				ErrSessionNotFound,
				ErrSessionExpired,
				ErrSessionMismatch,
				ErrRefreshTokenRevoked,
			},
		},
		{
			name: "Redis Errors",
			errors: []error{
				ErrKeyNotFound,
				ErrRedisRequestFailed,
				ErrUnexpectedResponse,
			},
		},
		{
			name: "OAuth Errors",
			errors: []error{
				ErrOAuthExchangeFailed,
				ErrOAuthRequestFailed,
				ErrAuthenticationFailed,
			},
		},
		{
			name: "Crypto Errors",
			errors: []error{
				ErrRandomGeneration,
			},
		},
		{
			name: "HTTP Errors",
			errors: []error{
				ErrInvalidAuthHeader,
				ErrMissingAuthCode,
				ErrMissingStateParam,
				ErrBearerTokenRequired,
			},
		},
	}

	for _, group := range errorGroups {
		t.Run(group.name, func(t *testing.T) {
			for _, err := range group.errors {
				if err == nil {
					t.Errorf("error in group %q should not be nil", group.name)
				}
				if err.Error() == "" {
					t.Errorf("error message for %v in group %q should not be empty", err, group.name)
				}
			}
		})
	}
}
