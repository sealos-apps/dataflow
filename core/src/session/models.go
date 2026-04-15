package session

import "time"

// AuthSession stores an encrypted database session resolved during Sealos bootstrap.
type AuthSession struct {
	ID                    string     `gorm:"primaryKey;type:text"`
	TokenHash             string     `gorm:"column:token_hash;uniqueIndex;not null"`
	Source                string     `gorm:"column:source;not null"`
	SealosUserID          string     `gorm:"column:sealos_user_id"`
	K8sUsername           string     `gorm:"column:k8s_username"`
	Namespace             string     `gorm:"column:namespace;not null"`
	ResourceName          string     `gorm:"column:resource_name"`
	DBType                string     `gorm:"column:db_type;not null"`
	Host                  string     `gorm:"column:host;not null"`
	Port                  string     `gorm:"column:port;not null"`
	DatabaseName          string     `gorm:"column:database_name;not null"`
	CredentialsNonce      []byte     `gorm:"column:credentials_nonce;not null"`
	CredentialsCiphertext []byte     `gorm:"column:credentials_ciphertext;not null"`
	ExpiresAt             time.Time  `gorm:"column:expires_at;not null"`
	CreatedAt             time.Time  `gorm:"column:created_at;autoCreateTime"`
	LastSeenAt            time.Time  `gorm:"column:last_seen_at;autoCreateTime"`
	RevokedAt             *time.Time `gorm:"column:revoked_at"`
}

// TableName returns the auth session table name.
func (*AuthSession) TableName() string {
	return "auth_sessions"
}
