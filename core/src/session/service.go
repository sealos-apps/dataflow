package session

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/clidey/whodb/core/src/engine"
	"github.com/clidey/whodb/core/src/env"
	"github.com/clidey/whodb/core/src/plugins"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	// ErrSessionStoreNotConfigured is returned when no session or metadata DSN is configured.
	ErrSessionStoreNotConfigured = errors.New("auth session store is not configured; set WHODB_SESSION_DSN or WHODB_METADATA_DSN")
	// ErrSessionNotFound is returned when a session token does not exist.
	ErrSessionNotFound = errors.New("auth session not found")
	// ErrSessionExpired is returned when a session token is past its expiry time.
	ErrSessionExpired = errors.New("auth session expired")
	// ErrSessionRevoked is returned when a session token has been revoked.
	ErrSessionRevoked = errors.New("auth session revoked")
)

// Service manages server-owned auth sessions.
type Service struct {
	repo *Repository
	key  []byte
	ttl  time.Duration
}

// DefaultServiceFactory creates the shared auth session service.
var DefaultServiceFactory = NewServiceFromEnv

var (
	defaultServiceMu          sync.Mutex
	defaultService            *Service
	defaultServiceInitialized bool
	defaultServiceErr         error
)

// NewService creates a session service from an existing gorm database handle.
func NewService(db *gorm.DB, encryptionKey string, ttl time.Duration) (*Service, error) {
	key, err := normalizeKey(encryptionKey)
	if err != nil {
		return nil, err
	}

	repo, err := NewRepository(db)
	if err != nil {
		return nil, err
	}

	if ttl == 0 {
		ttl = 24 * time.Hour
	}

	return &Service{
		repo: repo,
		key:  key,
		ttl:  ttl,
	}, nil
}

// NewServiceFromEnv creates a session service from environment configuration.
func NewServiceFromEnv() (*Service, error) {
	dsn := env.GetSessionDSN()
	if dsn == "" {
		return nil, ErrSessionStoreNotConfigured
	}

	ttl := 24 * time.Hour
	parsed, err := time.ParseDuration(env.GetSessionTTL())
	if err != nil {
		return nil, fmt.Errorf("parse session ttl: %w", err)
	}
	ttl = parsed

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(plugins.GetGormLogConfig()),
	})
	if err != nil {
		return nil, fmt.Errorf("open session database: %w", err)
	}
	if err := plugins.ConfigureConnectionPool(db); err != nil {
		return nil, fmt.Errorf("configure session connection pool: %w", err)
	}

	return NewService(db, env.GetSessionEncryptionKey(), ttl)
}

// GetDefaultService returns the shared auth session service.
func GetDefaultService() (*Service, error) {
	defaultServiceMu.Lock()
	defer defaultServiceMu.Unlock()

	if defaultServiceInitialized {
		return defaultService, defaultServiceErr
	}

	defaultService, defaultServiceErr = DefaultServiceFactory()
	defaultServiceInitialized = true
	return defaultService, defaultServiceErr
}

// ResetDefaultService clears the shared auth session service for tests.
func ResetDefaultService() {
	defaultServiceMu.Lock()
	defer defaultServiceMu.Unlock()

	defaultService = nil
	defaultServiceErr = nil
	defaultServiceInitialized = false
}

// Create stores encrypted credentials and returns the created session plus raw token.
func (s *Service) Create(ctx context.Context, params CreateParams) (*AuthSession, string, error) {
	token, err := generateOpaqueToken()
	if err != nil {
		return nil, "", fmt.Errorf("generate token: %w", err)
	}

	nonce, ciphertext, err := encryptCredentials(s.key, params.Credentials)
	if err != nil {
		return nil, "", err
	}

	now := time.Now().UTC()
	record := &AuthSession{
		ID:                    uuidString(),
		TokenHash:             HashToken(token),
		Source:                params.Source,
		SealosUserID:          params.SealosUserID,
		K8sUsername:           params.K8sUsername,
		Namespace:             params.Namespace,
		ResourceName:          params.ResourceName,
		DBType:                params.DBType,
		Host:                  params.Host,
		Port:                  params.Port,
		DatabaseName:          params.DatabaseName,
		CredentialsNonce:      nonce,
		CredentialsCiphertext: ciphertext,
		ExpiresAt:             now.Add(s.ttl),
		CreatedAt:             now,
		LastSeenAt:            now,
	}

	if err := s.repo.Create(ctx, record); err != nil {
		return nil, "", err
	}

	return record, token, nil
}

// ResolveToken loads and decrypts a session token.
func (s *Service) ResolveToken(ctx context.Context, token string) (*engine.Credentials, *AuthSession, error) {
	record, err := s.repo.GetByTokenHash(ctx, HashToken(token))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrSessionNotFound
		}
		return nil, nil, err
	}

	now := time.Now().UTC()
	if record.RevokedAt != nil {
		return nil, record, ErrSessionRevoked
	}
	if record.ExpiresAt.Before(now) {
		return nil, record, ErrSessionExpired
	}

	credentials, err := decryptCredentials(s.key, record.CredentialsNonce, record.CredentialsCiphertext)
	if err != nil {
		return nil, record, err
	}

	if err := s.repo.TouchLastSeen(ctx, record.ID); err != nil {
		return nil, record, err
	}

	return credentials, record, nil
}

// Revoke marks a session row as revoked.
func (s *Service) Revoke(ctx context.Context, id string) error {
	return s.repo.RevokeByID(ctx, id)
}

func uuidString() string {
	return fmt.Sprintf("%d", time.Now().UTC().UnixNano())
}
