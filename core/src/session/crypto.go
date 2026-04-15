package session

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/clidey/whodb/core/src/engine"
	"github.com/google/uuid"
)

// CreateParams describes the metadata required to create a new auth session.
type CreateParams struct {
	Source       string
	SealosUserID string
	K8sUsername  string
	Namespace    string
	ResourceName string
	DBType       string
	Host         string
	Port         string
	DatabaseName string
	Credentials  *engine.Credentials
}

// HashToken returns the SHA-256 hash for a raw session token.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func generateOpaqueToken() (string, error) {
	return uuid.NewString(), nil
}

func normalizeKey(key string) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("session encryption key must be 32 bytes")
	}
	return []byte(key), nil
}

func encryptCredentials(key []byte, credentials *engine.Credentials) ([]byte, []byte, error) {
	if credentials == nil {
		return nil, nil, errors.New("credentials are required")
	}

	plaintext, err := json.Marshal(credentials)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal credentials: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("new gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("read nonce: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	return nonce, ciphertext, nil
}

func decryptCredentials(key []byte, nonce, ciphertext []byte) (*engine.Credentials, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt credentials: %w", err)
	}

	var credentials engine.Credentials
	if err := json.Unmarshal(plaintext, &credentials); err != nil {
		return nil, fmt.Errorf("unmarshal credentials: %w", err)
	}

	return &credentials, nil
}
