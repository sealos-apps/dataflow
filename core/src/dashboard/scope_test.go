package dashboard

import (
	"testing"

	"github.com/clidey/whodb/core/src/engine"
)

func TestScopeKeyFromCredentials(t *testing.T) {
	creds := &engine.Credentials{
		Type:     "Postgres",
		Hostname: "db.internal",
		Database: "analytics",
		Advanced: []engine.Record{{Key: "Port", Value: "5432"}},
	}

	got, err := ScopeKeyFromCredentials(creds)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if got != "Postgres:db.internal:5432:analytics" {
		t.Fatalf("unexpected scope key %q", got)
	}
}
