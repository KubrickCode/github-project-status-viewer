package crypto

import (
	"encoding/hex"
	"testing"
)

func TestGenerateRandomID(t *testing.T) {
	testCases := []struct {
		name          string
		generateFunc  func() (string, error)
		expectedBytes int
	}{
		{
			name:          "GenerateRefreshTokenID",
			generateFunc:  GenerateRefreshTokenID,
			expectedBytes: RefreshTokenIDBytes,
		},
		{
			name:          "GenerateSessionID",
			generateFunc:  GenerateSessionID,
			expectedBytes: SessionIDBytes,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			t.Run("should generate valid hex string", func(t *testing.T) {
				t.Parallel()
				id, err := tc.generateFunc()
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}

				expectedLength := tc.expectedBytes * 2
				if len(id) != expectedLength {
					t.Errorf("expected length %d, got %d", expectedLength, len(id))
				}

				if _, err := hex.DecodeString(id); err != nil {
					t.Errorf("not a valid hex string: %v", err)
				}
			})

			t.Run("should generate unique IDs", func(t *testing.T) {
				t.Parallel()
				ids := make(map[string]bool)
				iterations := 1000

				for i := 0; i < iterations; i++ {
					id, err := tc.generateFunc()
					if err != nil {
						t.Fatalf("unexpected error at iteration %d: %v", i, err)
					}

					if ids[id] {
						t.Errorf("duplicate ID generated: %s", id)
					}
					ids[id] = true
				}

				if len(ids) != iterations {
					t.Errorf("expected %d unique IDs, got %d", iterations, len(ids))
				}
			})

			t.Run("should only contain lowercase hex characters", func(t *testing.T) {
				t.Parallel()
				id, err := tc.generateFunc()
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}

				for _, char := range id {
					if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f')) {
						t.Errorf("invalid character %c in ID %s", char, id)
					}
				}
			})
		})
	}
}

func TestIDDifference(t *testing.T) {
	t.Run("refresh token ID and session ID should be different", func(t *testing.T) {
		refreshID, err := GenerateRefreshTokenID()
		if err != nil {
			t.Fatalf("failed to generate refresh token ID: %v", err)
		}

		sessionID, err := GenerateSessionID()
		if err != nil {
			t.Fatalf("failed to generate session ID: %v", err)
		}

		if refreshID == sessionID {
			t.Errorf("refresh token ID and session ID should not be the same")
		}
	})
}

func BenchmarkGenerateRandomID(b *testing.B) {
	benchmarks := []struct {
		name         string
		generateFunc func() (string, error)
	}{
		{
			name:         "GenerateRefreshTokenID",
			generateFunc: GenerateRefreshTokenID,
		},
		{
			name:         "GenerateSessionID",
			generateFunc: GenerateSessionID,
		},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, err := bm.generateFunc()
				if err != nil {
					b.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}
