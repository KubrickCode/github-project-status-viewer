package auth

import "errors"

var (
	ErrInvalidAuthHeader = errors.New("authorization header must be 'Bearer <token>'")
)
