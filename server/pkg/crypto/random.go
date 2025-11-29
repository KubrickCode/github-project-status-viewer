package crypto

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	pkgerrors "github-project-status-viewer-server/pkg/errors"
)

const (
	RefreshTokenIDBytes = 32
	SessionIDBytes      = 32
)

func generateRandomHex(byteLength int) (string, error) {
	bytes := make([]byte, byteLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("%w: %w", pkgerrors.ErrRandomGeneration, err)
	}
	return hex.EncodeToString(bytes), nil
}

func GenerateRefreshTokenID() (string, error) {
	return generateRandomHex(RefreshTokenIDBytes)
}

func GenerateSessionID() (string, error) {
	return generateRandomHex(SessionIDBytes)
}
