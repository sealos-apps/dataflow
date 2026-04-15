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
	if loaded == nil || loaded.ResourceName != "my-db" {
		t.Fatalf("expected session metadata to roundtrip, got %#v", loaded)
	}
	if resolved == nil || resolved.Username != "postgres" || resolved.Password != "secret" {
		t.Fatalf("expected credentials to decrypt, got %#v", resolved)
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
