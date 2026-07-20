package graph

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/clidey/whodb/core/graph/model"
	"github.com/clidey/whodb/core/internal/testutil"
	"github.com/clidey/whodb/core/src"
	"github.com/clidey/whodb/core/src/engine"
	"github.com/clidey/whodb/core/src/env"
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
	var service *session.Service
	session.DefaultServiceFactory = func() (*session.Service, error) {
		db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
		if err != nil {
			return nil, err
		}
		service, err = session.NewService(db, env.GetSessionEncryptionKey(), 24*time.Hour)
		return service, err
	}
	t.Cleanup(func() {
		session.DefaultServiceFactory = origFactory
		session.ResetDefaultService()
	})

	originalFactory := sealos.DefaultBootstrapResolverFactory
	sealos.DefaultBootstrapResolverFactory = func(kubeconfig string) (sealos.BootstrapResolver, error) {
		return fakeBootstrapResolver{
			identity: &sealos.ResolvedInstanceIdentity{
				UID:          "instance-uid-1",
				Namespace:    "ns-demo",
				ResourceName: "my-db",
			},
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
	if payload.InstanceUID == nil || *payload.InstanceUID != "instance-uid-1" {
		t.Fatalf("expected instance UID in payload, got %#v", payload.InstanceUID)
	}
	if _, err := time.Parse(time.RFC3339, payload.ExpiresAt); err != nil {
		t.Fatalf("expected RFC3339 expiry, got %q (%v)", payload.ExpiresAt, err)
	}
	_, record, err := service.ResolveToken(context.Background(), payload.SessionToken)
	if err != nil {
		t.Fatalf("resolve created token: %v", err)
	}
	if record.InstanceUID != "instance-uid-1" {
		t.Fatalf("expected bootstrap identity UID to be stored, got %#v", record)
	}
}

func TestBootstrapSealosSessionResolvesIdentityForEverySupportedSealosEngine(t *testing.T) {
	t.Setenv("WHODB_SEALOS_BOOTSTRAP_ENABLED", "true")

	db, err := gorm.Open(sqlite.Open("file:sealos-engine-identity?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open session database: %v", err)
	}
	service, err := session.NewService(db, "12345678901234567890123456789012", 24*time.Hour)
	if err != nil {
		t.Fatalf("new session service: %v", err)
	}

	originalServiceFactory := session.DefaultServiceFactory
	originalResolverFactory := sealos.DefaultBootstrapResolverFactory
	originalEngine := src.MainEngine
	session.DefaultServiceFactory = func() (*session.Service, error) { return service, nil }
	session.ResetDefaultService()
	t.Cleanup(func() {
		session.DefaultServiceFactory = originalServiceFactory
		sealos.DefaultBootstrapResolverFactory = originalResolverFactory
		src.MainEngine = originalEngine
		session.ResetDefaultService()
	})

	testCases := []struct {
		dbType     string
		engineType engine.DatabaseType
	}{
		{dbType: "postgresql", engineType: engine.DatabaseType_Postgres},
		{dbType: "apecloud-mysql", engineType: engine.DatabaseType_MySQL},
		{dbType: "mongodb", engineType: engine.DatabaseType_MongoDB},
		{dbType: "redis", engineType: engine.DatabaseType_Redis},
		{dbType: "clickhouse", engineType: engine.DatabaseType_ClickHouse},
	}

	for _, testCase := range testCases {
		t.Run(testCase.dbType, func(t *testing.T) {
			_, oldToken, err := service.Create(context.Background(), session.CreateParams{
				Source:       "sealos",
				Namespace:    "ns-demo",
				ResourceName: "my-db",
				InstanceUID:  "replaced-uid",
				DBType:       string(testCase.engineType),
				Host:         "my-db.ns-demo.svc",
				Port:         "1234",
				DatabaseName: "default",
				Credentials: &engine.Credentials{
					Type: string(testCase.engineType), Hostname: "my-db.ns-demo.svc", Username: "user", Password: "replaced-secret", Database: "default",
				},
			})
			if err != nil {
				t.Fatalf("create replaced %s session: %v", testCase.dbType, err)
			}

			var availabilityCredentials *engine.Credentials
			mock := testutil.NewPluginMock(testCase.engineType)
			mock.IsAvailableFunc = func(_ context.Context, config *engine.PluginConfig) bool {
				availabilityCredentials = config.Credentials
				return true
			}
			src.MainEngine = &engine.Engine{}
			src.MainEngine.RegistryPlugin(mock.AsPlugin())

			identityCalls := 0
			sealos.DefaultBootstrapResolverFactory = func(string) (sealos.BootstrapResolver, error) {
				return fakeBootstrapResolver{
					identityCalls: &identityCalls,
					identity: &sealos.ResolvedInstanceIdentity{
						UID:          "instance-uid-1",
						Namespace:    "ns-demo",
						ResourceName: "my-db",
					},
					result: &sealos.ResolvedBootstrap{
						Namespace:    "ns-demo",
						ResourceName: "my-db",
						DBType:       string(testCase.engineType),
						Host:         "my-db.ns-demo.svc",
						Port:         "1234",
						DatabaseName: "default",
						Credentials: &engine.Credentials{
							Type: string(testCase.engineType), Hostname: "my-db.ns-demo.svc", Username: "user", Password: "secret", Database: "default",
						},
					},
				}, nil
			}

			payload, err := (&Resolver{}).Mutation().BootstrapSealosSession(context.Background(), model.SealosBootstrapInput{
				Kubeconfig:   "apiVersion: v1",
				DbType:       testCase.dbType,
				ResourceName: "my-db",
			})
			if err != nil {
				t.Fatalf("bootstrap %s: %v", testCase.dbType, err)
			}
			if identityCalls != 1 {
				t.Fatalf("expected one authoritative identity resolution, got %d", identityCalls)
			}
			if payload.InstanceUID == nil || *payload.InstanceUID != "instance-uid-1" {
				t.Fatalf("expected UID-bound %s session, got %#v", testCase.dbType, payload)
			}
			if availabilityCredentials == nil || availabilityCredentials.Password != "secret" {
				t.Fatalf("expected %s availability check to use replacement credentials, got %#v", testCase.dbType, availabilityCredentials)
			}
			resolvedCredentials, record, err := service.ResolveToken(context.Background(), payload.SessionToken)
			if err != nil {
				t.Fatalf("resolve replacement %s session: %v", testCase.dbType, err)
			}
			if record.InstanceUID != "instance-uid-1" || resolvedCredentials.Password != "secret" {
				t.Fatalf("expected replacement %s credentials and UID to persist, got record=%#v credentials=%#v", testCase.dbType, record, resolvedCredentials)
			}
			if _, _, err := service.ResolveToken(context.Background(), oldToken); !errors.Is(err, session.ErrSessionRevoked) {
				t.Fatalf("expected replaced %s token to be revoked, got %v", testCase.dbType, err)
			}
		})
	}
}

func TestBootstrapSealosSessionRevokesStaleSessionsBeforeAvailabilityCheck(t *testing.T) {
	t.Setenv("WHODB_SEALOS_BOOTSTRAP_ENABLED", "true")
	t.Setenv("WHODB_SESSION_ENCRYPTION_KEY", "12345678901234567890123456789012")
	t.Setenv("WHODB_SESSION_TTL", "24h")

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open session database: %v", err)
	}
	service, err := session.NewService(db, env.GetSessionEncryptionKey(), 24*time.Hour)
	if err != nil {
		t.Fatalf("new session service: %v", err)
	}

	originalServiceFactory := session.DefaultServiceFactory
	session.DefaultServiceFactory = func() (*session.Service, error) { return service, nil }
	session.ResetDefaultService()
	t.Cleanup(func() {
		session.DefaultServiceFactory = originalServiceFactory
		session.ResetDefaultService()
	})

	oldToken := createSealosSessionForGraphTest(t, service, "old-uid")
	legacyToken := createSealosSessionForGraphTest(t, service, "")
	currentToken := createSealosSessionForGraphTest(t, service, "current-uid")

	checkedBeforeAvailability := false
	mock := testutil.NewPluginMock(engine.DatabaseType("Postgres"))
	mock.IsAvailableFunc = func(ctx context.Context, _ *engine.PluginConfig) bool {
		_, _, oldErr := service.ResolveToken(ctx, oldToken)
		_, _, legacyErr := service.ResolveToken(ctx, legacyToken)
		_, _, currentErr := service.ResolveToken(ctx, currentToken)
		checkedBeforeAvailability = errors.Is(oldErr, session.ErrSessionRevoked) &&
			errors.Is(legacyErr, session.ErrSessionRevoked) && currentErr == nil
		return false
	}
	setEngineMock(t, mock)

	originalResolverFactory := sealos.DefaultBootstrapResolverFactory
	sealos.DefaultBootstrapResolverFactory = func(string) (sealos.BootstrapResolver, error) {
		return fakeBootstrapResolver{
			identity: &sealos.ResolvedInstanceIdentity{UID: "current-uid", Namespace: "ns-demo", ResourceName: "my-db"},
			result: &sealos.ResolvedBootstrap{
				Namespace:    "ns-demo",
				ResourceName: "my-db",
				DBType:       "Postgres",
				Host:         "my-db.ns-demo.svc",
				Port:         "5432",
				DatabaseName: "postgres",
				Credentials: &engine.Credentials{
					Type: "Postgres", Hostname: "my-db.ns-demo.svc", Username: "postgres", Password: "secret", Database: "postgres",
				},
			},
		}, nil
	}
	t.Cleanup(func() { sealos.DefaultBootstrapResolverFactory = originalResolverFactory })

	_, err = (&Resolver{}).Mutation().BootstrapSealosSession(context.Background(), model.SealosBootstrapInput{
		Kubeconfig:   "apiVersion: v1",
		DbType:       "postgresql",
		ResourceName: "my-db",
	})
	if err == nil {
		t.Fatal("expected unavailable replacement instance to reject bootstrap")
	}
	if !checkedBeforeAvailability {
		t.Fatal("expected stale sessions to be revoked before database availability check")
	}
}

func TestResolveSealosInstanceIdentityReturnsAuthoritativeUID(t *testing.T) {
	t.Setenv("WHODB_SEALOS_BOOTSTRAP_ENABLED", "true")

	originalFactory := sealos.DefaultBootstrapResolverFactory
	sealos.DefaultBootstrapResolverFactory = func(string) (sealos.BootstrapResolver, error) {
		return fakeBootstrapResolver{
			identity: &sealos.ResolvedInstanceIdentity{UID: "instance-uid-2", Namespace: "ns-demo", ResourceName: "my-db"},
		}, nil
	}
	t.Cleanup(func() { sealos.DefaultBootstrapResolverFactory = originalFactory })

	identity, err := (&Resolver{}).Query().ResolveSealosInstanceIdentity(context.Background(), model.SealosInstanceIdentityInput{
		Kubeconfig:   "apiVersion: v1",
		ResourceName: "my-db",
	})
	if err != nil {
		t.Fatalf("resolve identity query: %v", err)
	}
	if identity.UID != "instance-uid-2" || identity.Namespace != "ns-demo" || identity.ResourceName != "my-db" {
		t.Fatalf("expected authoritative identity response, got %#v", identity)
	}
}

func createSealosSessionForGraphTest(t *testing.T, service *session.Service, instanceUID string) string {
	t.Helper()

	_, token, err := service.Create(context.Background(), session.CreateParams{
		Source:       "sealos",
		Namespace:    "ns-demo",
		ResourceName: "my-db",
		InstanceUID:  instanceUID,
		DBType:       "Postgres",
		Host:         "my-db.ns-demo.svc",
		Port:         "5432",
		DatabaseName: "postgres",
		Credentials: &engine.Credentials{
			Type: "Postgres", Hostname: "my-db.ns-demo.svc", Username: "postgres", Password: "secret", Database: "postgres",
		},
	})
	if err != nil {
		t.Fatalf("create Sealos session: %v", err)
	}
	return token
}

type fakeBootstrapResolver struct {
	identityCalls *int
	identity      *sealos.ResolvedInstanceIdentity
	identityErr   error
	result        *sealos.ResolvedBootstrap
	err           error
}

func (f fakeBootstrapResolver) ResolveInstanceIdentity(_ context.Context, _ sealos.InstanceIdentityInput) (*sealos.ResolvedInstanceIdentity, error) {
	if f.identityCalls != nil {
		(*f.identityCalls)++
	}
	return f.identity, f.identityErr
}

func (f fakeBootstrapResolver) ResolveBootstrap(_ context.Context, _ sealos.BootstrapInput) (*sealos.ResolvedBootstrap, error) {
	return f.result, f.err
}

func strPtr(s string) *string { return &s }
