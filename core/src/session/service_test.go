package session

import (
	"context"
	"testing"
	"time"

	"github.com/clidey/whodb/core/src/engine"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestServiceCreateAndResolveToken(t *testing.T) {
	service := newSessionServiceForTest(t, "12345678901234567890123456789012", time.Hour)

	creds := &engine.Credentials{
		Type:     "Postgres",
		Hostname: "db.ns.svc",
		Username: "postgres",
		Password: "secret",
		Database: "postgres",
		Advanced: []engine.Record{{Key: "Port", Value: "5432"}},
	}

	record, token, err := service.Create(context.Background(), CreateParams{
		Source:       "sealos",
		Namespace:    "ns-demo",
		ResourceName: "my-db",
		InstanceUID:  "instance-uid-1",
		DBType:       "Postgres",
		Host:         "db.ns.svc",
		Port:         "5432",
		DatabaseName: "postgres",
		Credentials:  creds,
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if token == "" {
		t.Fatalf("expected opaque token to be returned")
	}
	if record.TokenHash == token {
		t.Fatalf("expected stored token hash to differ from raw token")
	}

	resolved, loaded, err := service.ResolveToken(context.Background(), token)
	if err != nil {
		t.Fatalf("resolve token: %v", err)
	}
	if loaded == nil || loaded.ResourceName != "my-db" || loaded.InstanceUID != "instance-uid-1" {
		t.Fatalf("expected session metadata to roundtrip, got %#v", loaded)
	}
	if resolved == nil || resolved.Username != "postgres" || resolved.Password != "secret" {
		t.Fatalf("expected credentials to decrypt, got %#v", resolved)
	}
}

func TestServiceRevokesStaleSealosSessionsForTarget(t *testing.T) {
	service := newSessionServiceForTest(t, "12345678901234567890123456789012", time.Hour)
	ctx := context.Background()

	type sessionFixture struct {
		name         string
		source       string
		namespace    string
		resourceName string
		instanceUID  string
		wantRevoked  bool
	}

	fixtures := []sessionFixture{
		{name: "replaced instance", source: "sealos", namespace: "ns-demo", resourceName: "my-db", instanceUID: "old-uid", wantRevoked: true},
		{name: "legacy instance", source: "sealos", namespace: "ns-demo", resourceName: "my-db", instanceUID: "", wantRevoked: true},
		{name: "current instance", source: "sealos", namespace: "ns-demo", resourceName: "my-db", instanceUID: "current-uid"},
		{name: "other namespace", source: "sealos", namespace: "ns-other", resourceName: "my-db", instanceUID: "old-uid"},
		{name: "other resource", source: "sealos", namespace: "ns-demo", resourceName: "other-db", instanceUID: "old-uid"},
		{name: "standalone session", source: "standalone", namespace: "ns-demo", resourceName: "my-db", instanceUID: "old-uid"},
	}

	tokens := make(map[string]string, len(fixtures))
	for _, fixture := range fixtures {
		record, token, err := service.Create(ctx, CreateParams{
			Source:       fixture.source,
			Namespace:    fixture.namespace,
			ResourceName: fixture.resourceName,
			InstanceUID:  fixture.instanceUID,
			DBType:       "Postgres",
			Host:         "db.ns.svc",
			Port:         "5432",
			DatabaseName: "postgres",
			Credentials: &engine.Credentials{
				Type:     "Postgres",
				Hostname: "db.ns.svc",
				Username: "postgres",
				Password: "secret",
				Database: "postgres",
			},
		})
		if err != nil {
			t.Fatalf("create %s: %v", fixture.name, err)
		}
		if fixture.name == "legacy instance" {
			if err := service.repo.db.WithContext(ctx).Model(&AuthSession{}).
				Where("id = ?", record.ID).
				Update("instance_uid", nil).Error; err != nil {
				t.Fatalf("mark legacy session UID null: %v", err)
			}
		}
		tokens[fixture.name] = token
	}

	if err := service.RevokeStaleSealosSessions(ctx, "ns-demo", "my-db", "current-uid"); err != nil {
		t.Fatalf("revoke stale target sessions: %v", err)
	}

	for _, fixture := range fixtures {
		_, _, err := service.ResolveToken(ctx, tokens[fixture.name])
		if fixture.wantRevoked && err != ErrSessionRevoked {
			t.Errorf("%s: expected ErrSessionRevoked, got %v", fixture.name, err)
		}
		if !fixture.wantRevoked && err != nil {
			t.Errorf("%s: expected session to remain valid, got %v", fixture.name, err)
		}
	}
}

func TestServiceRejectsExpiredOrRevokedToken(t *testing.T) {
	t.Run("expired", func(t *testing.T) {
		service := newSessionServiceForTest(t, "12345678901234567890123456789012", -time.Minute)
		_, token, err := service.Create(context.Background(), CreateParams{
			Source:       "sealos",
			Namespace:    "ns-demo",
			ResourceName: "my-db",
			DBType:       "Postgres",
			Host:         "db.ns.svc",
			Port:         "5432",
			DatabaseName: "postgres",
			Credentials: &engine.Credentials{
				Type:     "Postgres",
				Hostname: "db.ns.svc",
				Username: "postgres",
				Password: "secret",
				Database: "postgres",
			},
		})
		if err != nil {
			t.Fatalf("create expired session: %v", err)
		}

		if _, _, err := service.ResolveToken(context.Background(), token); err != ErrSessionExpired {
			t.Fatalf("expected ErrSessionExpired, got %v", err)
		}
	})

	t.Run("revoked", func(t *testing.T) {
		service := newSessionServiceForTest(t, "12345678901234567890123456789012", time.Hour)
		record, token, err := service.Create(context.Background(), CreateParams{
			Source:       "sealos",
			Namespace:    "ns-demo",
			ResourceName: "my-db",
			DBType:       "Postgres",
			Host:         "db.ns.svc",
			Port:         "5432",
			DatabaseName: "postgres",
			Credentials: &engine.Credentials{
				Type:     "Postgres",
				Hostname: "db.ns.svc",
				Username: "postgres",
				Password: "secret",
				Database: "postgres",
			},
		})
		if err != nil {
			t.Fatalf("create session: %v", err)
		}
		if err := service.Revoke(context.Background(), record.ID); err != nil {
			t.Fatalf("revoke session: %v", err)
		}

		if _, _, err := service.ResolveToken(context.Background(), token); err != ErrSessionRevoked {
			t.Fatalf("expected ErrSessionRevoked, got %v", err)
		}
	})
}

func TestHashTokenIsStable(t *testing.T) {
	first := HashToken("token-value")
	second := HashToken("token-value")
	if first == "" || first != second {
		t.Fatalf("expected stable token hash, got %q and %q", first, second)
	}
}

func TestServiceMaybeDeletesExpiredSessionsOnInterval(t *testing.T) {
	service := newSessionServiceForTest(t, "12345678901234567890123456789012", time.Hour)
	service.cleanupInterval = time.Hour

	expired := &AuthSession{
		ID:                    "expired-session",
		TokenHash:             "expired-token",
		Source:                "sealos",
		Namespace:             "ns-demo",
		ResourceName:          "my-db",
		DBType:                "Postgres",
		Host:                  "db.ns.svc",
		Port:                  "5432",
		DatabaseName:          "postgres",
		CredentialsNonce:      []byte("nonce"),
		CredentialsCiphertext: []byte("ciphertext"),
		ExpiresAt:             time.Now().UTC().Add(-time.Hour),
		CreatedAt:             time.Now().UTC().Add(-2 * time.Hour),
		LastSeenAt:            time.Now().UTC().Add(-2 * time.Hour),
	}
	if err := service.repo.Create(context.Background(), expired); err != nil {
		t.Fatalf("insert expired session: %v", err)
	}

	if err := service.maybeDeleteExpiredSessions(context.Background(), time.Now().UTC()); err != nil {
		t.Fatalf("first cleanup should succeed: %v", err)
	}

	if _, err := service.repo.GetByTokenHash(context.Background(), expired.TokenHash); err == nil {
		t.Fatalf("expected expired session to be deleted")
	}

	service.lastCleanupAt = time.Now().UTC()
	freshExpired := &AuthSession{
		ID:                    "fresh-expired-session",
		TokenHash:             "fresh-expired-token",
		Source:                "sealos",
		Namespace:             "ns-demo",
		ResourceName:          "my-db",
		DBType:                "Postgres",
		Host:                  "db.ns.svc",
		Port:                  "5432",
		DatabaseName:          "postgres",
		CredentialsNonce:      []byte("nonce"),
		CredentialsCiphertext: []byte("ciphertext"),
		ExpiresAt:             time.Now().UTC().Add(-time.Minute),
		CreatedAt:             time.Now().UTC().Add(-2 * time.Hour),
		LastSeenAt:            time.Now().UTC().Add(-2 * time.Hour),
	}
	if err := service.repo.Create(context.Background(), freshExpired); err != nil {
		t.Fatalf("insert second expired session: %v", err)
	}

	if err := service.maybeDeleteExpiredSessions(context.Background(), time.Now().UTC()); err != nil {
		t.Fatalf("second cleanup should succeed: %v", err)
	}

	if _, err := service.repo.GetByTokenHash(context.Background(), freshExpired.TokenHash); err != nil {
		t.Fatalf("expected cleanup interval to skip deletion, got %v", err)
	}
}

func newSessionServiceForTest(t *testing.T, key string, ttl time.Duration) *Service {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	service, err := NewService(db, key, ttl)
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	return service
}
