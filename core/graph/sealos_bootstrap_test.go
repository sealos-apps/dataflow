package graph

import (
	"context"
	"testing"
	"time"

	"github.com/clidey/whodb/core/graph/model"
	"github.com/clidey/whodb/core/internal/testutil"
	"github.com/clidey/whodb/core/src/env"
	"github.com/clidey/whodb/core/src/engine"
	"github.com/clidey/whodb/core/src/sealos"
	"github.com/clidey/whodb/core/src/session"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestBootstrapSealosSessionCreatesServerSession(t *testing.T) {
	mock := testutil.NewPluginMock(engine.DatabaseType("Postgres"))
	mock.IsAvailableFunc = func(context.Context, *engine.PluginConfig) bool { return true }
	setEngineMock(t, mock)

	t.Setenv("WHODB_SEALOS_BOOTSTRAP_ENABLED", "true")
	t.Setenv("WHODB_SESSION_ENCRYPTION_KEY", "12345678901234567890123456789012")
	t.Setenv("WHODB_SESSION_TTL", "24h")
	origFactory := session.DefaultServiceFactory
	session.DefaultServiceFactory = func() (*session.Service, error) {
		db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
		if err != nil {
			return nil, err
		}
		return session.NewService(db, env.GetSessionEncryptionKey(), 24*time.Hour)
	}
	t.Cleanup(func() {
		session.DefaultServiceFactory = origFactory
		session.ResetDefaultService()
	})

	originalFactory := sealos.DefaultBootstrapResolverFactory
	sealos.DefaultBootstrapResolverFactory = func(kubeconfig string) (sealos.BootstrapResolver, error) {
		return fakeBootstrapResolver{
			result: &sealos.ResolvedBootstrap{
				Namespace:    "ns-demo",
				ResourceName: "my-db",
				DBType:       "Postgres",
				Host:         "my-db.ns-demo.svc",
				Port:         "5432",
				DatabaseName: "postgres",
				K8sUsername:  "demo-user",
				Credentials: &engine.Credentials{
					Type:     "Postgres",
					Hostname: "my-db.ns-demo.svc",
					Username: "postgres",
					Password: "secret",
					Database: "postgres",
					Advanced: []engine.Record{{Key: "Port", Value: "5432"}},
				},
			},
		}, nil
	}
	t.Cleanup(func() { sealos.DefaultBootstrapResolverFactory = originalFactory })

	resolver := &Resolver{}
	mut := resolver.Mutation()

	payload, err := mut.BootstrapSealosSession(context.Background(), model.SealosBootstrapInput{
		Kubeconfig:   "apiVersion: v1",
		DbType:       "postgresql",
		ResourceName: "my-db",
		Host:         strPtr("my-db.ns-demo.svc"),
		Port:         strPtr("5432"),
	})
	if err != nil {
		t.Fatalf("expected bootstrap to succeed, got %v", err)
	}
	if payload == nil || payload.SessionToken == "" {
		t.Fatalf("expected session token payload, got %#v", payload)
	}
	if payload.Hostname != "my-db.ns-demo.svc" || payload.Port != "5432" {
		t.Fatalf("expected connection summary to roundtrip, got %#v", payload)
	}
	if _, err := time.Parse(time.RFC3339, payload.ExpiresAt); err != nil {
		t.Fatalf("expected RFC3339 expiry, got %q (%v)", payload.ExpiresAt, err)
	}
}

type fakeBootstrapResolver struct {
	result *sealos.ResolvedBootstrap
	err    error
}

func (f fakeBootstrapResolver) ResolveBootstrap(_ context.Context, _ sealos.BootstrapInput) (*sealos.ResolvedBootstrap, error) {
	return f.result, f.err
}

func strPtr(s string) *string { return &s }
