package session

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Repository persists auth sessions in the metadata database.
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a session repository and migrates its schema.
func NewRepository(db *gorm.DB) (*Repository, error) {
	if db == nil {
		return nil, errors.New("missing session database")
	}

	repo := &Repository{db: db}
	if err := repo.db.AutoMigrate(&AuthSession{}); err != nil {
		return nil, fmt.Errorf("auto-migrate auth sessions: %w", err)
	}

	return repo, nil
}

// Create inserts a new auth session row.
func (r *Repository) Create(ctx context.Context, record *AuthSession) error {
	return r.db.WithContext(ctx).Create(record).Error
}

// GetByTokenHash loads an auth session row by token hash.
func (r *Repository) GetByTokenHash(ctx context.Context, tokenHash string) (*AuthSession, error) {
	var record AuthSession
	err := r.db.WithContext(ctx).First(&record, "token_hash = ?", tokenHash).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

// RevokeByID marks an auth session as revoked.
func (r *Repository) RevokeByID(ctx context.Context, id string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&AuthSession{}).
		Where("id = ?", id).
		Update("revoked_at", &now).Error
}

// TouchLastSeen updates the last-seen timestamp for an auth session.
func (r *Repository) TouchLastSeen(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Model(&AuthSession{}).
		Where("id = ?", id).
		Update("last_seen_at", time.Now().UTC()).Error
}

// DeleteExpired removes expired auth sessions.
func (r *Repository) DeleteExpired(ctx context.Context, now time.Time) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ?", now.UTC()).
		Delete(&AuthSession{}).Error
}
