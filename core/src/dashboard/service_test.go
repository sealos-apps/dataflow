package dashboard

import (
	"context"
	"strings"
	"testing"

	"github.com/clidey/whodb/core/src/auth"
	"github.com/clidey/whodb/core/src/engine"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCreateDashboardUsesDerivedScopeKey(t *testing.T) {
	service := newDashboardServiceForTest(t)
	ctx := context.WithValue(context.Background(), auth.AuthKey_Credentials, &engine.Credentials{
		Type:     "Postgres",
		Hostname: "db.internal",
		Database: "analytics",
	})

	dashboard, err := service.CreateDashboard(ctx, CreateDashboardParams{
		Name:        "Revenue",
		RefreshRule: "on-demand",
	})
	if err != nil {
		t.Fatalf("expected create to succeed, got %v", err)
	}

	if dashboard.ScopeKey != "Postgres:db.internal::analytics" {
		t.Fatalf("expected derived scope key, got %q", dashboard.ScopeKey)
	}
}

func TestAddWidgetRejectsNonChartType(t *testing.T) {
	service := newDashboardServiceForTest(t)
	ctx := context.WithValue(context.Background(), auth.AuthKey_Credentials, &engine.Credentials{
		Type:     "Postgres",
		Hostname: "db.internal",
		Database: "analytics",
	})

	dashboard, err := service.CreateDashboard(ctx, CreateDashboardParams{
		Name:        "Revenue",
		RefreshRule: "on-demand",
	})
	if err != nil {
		t.Fatalf("expected create to succeed, got %v", err)
	}

	_, err = service.AddWidget(ctx, dashboard.ID, WidgetInput{
		Type:   "table",
		Title:  "Top rows",
		Layout: `{"i":"widget-1","x":0,"y":0,"w":4,"h":6}`,
	})
	if err == nil || !strings.Contains(err.Error(), "chart") {
		t.Fatalf("expected non-chart widget rejection, got %v", err)
	}
}

func newDashboardServiceForTest(t *testing.T) *Service {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	service, err := NewService(db)
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	return service
}
