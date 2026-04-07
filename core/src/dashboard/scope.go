package dashboard

import (
	"context"
	"errors"
	"strings"

	"github.com/clidey/whodb/core/src/auth"
	"github.com/clidey/whodb/core/src/engine"
)

func ScopeKeyFromContext(ctx context.Context) (string, error) {
	return ScopeKeyFromCredentials(auth.GetCredentials(ctx))
}

func ScopeKeyFromCredentials(creds *engine.Credentials) (string, error) {
	if creds == nil {
		return "", errors.New("missing credentials")
	}

	port := ""
	for _, record := range creds.Advanced {
		if record.Key == "Port" {
			port = record.Value
			break
		}
	}

	return strings.Join([]string{creds.Type, creds.Hostname, port, creds.Database}, ":"), nil
}
