package crypto

import (
	"crypto/rand"
	"encoding/hex"
)

const (
	RefreshTokenIDBytes = 32
	SessionIDBytes      = 32
)

func generateRandomHex(byteLength int) (string, error) {
	bytes := make([]byte, byteLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func GenerateRefreshTokenID() (string, error) {
	return generateRandomHex(RefreshTokenIDBytes)
}

func GenerateSessionID() (string, error) {
	return generateRandomHex(SessionIDBytes)
}
