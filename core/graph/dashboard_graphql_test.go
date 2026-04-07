package graph

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/clidey/whodb/core/src/auth"
	"github.com/clidey/whodb/core/src/dashboard"
	"github.com/clidey/whodb/core/src/engine"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestGetDashboardsReturnsScopedDashboards(t *testing.T) {
	service := newDashboardServiceForGraphTest(t)
	ctx := contextWithScope("primary")

	dash, err := service.CreateDashboard(ctx, dashboard.CreateDashboardParams{
		Name:        "Revenue",
		RefreshRule: dashboard.RefreshRuleOnDemand,
	})
	if err != nil {
		t.Fatalf("create dashboard: %v", err)
	}
	_, err = service.AddWidget(ctx, dash.ID, dashboard.WidgetInput{
		Type:   dashboard.WidgetTypeChart,
		Title:  "Monthly revenue",
		Layout: `{"i":"widget-1","x":0,"y":0,"w":4,"h":6}`,
	})
	if err != nil {
		t.Fatalf("add widget: %v", err)
	}

	body, _ := json.Marshal(map[string]any{
		"query": `query { GetDashboards { ID Name Widgets { ID Type Layout } } }`,
	})
	recorder := executeDashboardGraphQL(t, service, ctx, body)

	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), "Revenue") {
		t.Fatalf("unexpected response: %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestAddWidgetRejectsCrossScopeMutation(t *testing.T) {
	service := newDashboardServiceForGraphTest(t)
	ownerCtx := contextWithScope("primary")
	otherCtx := contextWithScope("secondary")

	dash, err := service.CreateDashboard(ownerCtx, dashboard.CreateDashboardParams{
		Name:        "Revenue",
		RefreshRule: dashboard.RefreshRuleOnDemand,
	})
	if err != nil {
		t.Fatalf("create dashboard: %v", err)
	}

	mutation := fmt.Sprintf(
		`mutation { AddWidget(dashboardId:%q, input:{Type:"chart", Title:"Blocked", Layout:"{\"i\":\"widget-1\",\"x\":0,\"y\":0,\"w\":4,\"h\":6}"}) { ID } }`,
		dash.ID,
	)
	body, _ := json.Marshal(map[string]any{"query": mutation})
	recorder := executeDashboardGraphQL(t, service, otherCtx, body)

	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), dashboard.ErrScopeMismatch.Error()) {
		t.Fatalf("expected scope error, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestUpdateWidgetSnapshotAcceptsSnapshotPayload(t *testing.T) {
	service := newDashboardServiceForGraphTest(t)
	ctx := contextWithScope("primary")

	dash, err := service.CreateDashboard(ctx, dashboard.CreateDashboardParams{
		Name:        "Revenue",
		RefreshRule: dashboard.RefreshRuleOnDemand,
	})
	if err != nil {
		t.Fatalf("create dashboard: %v", err)
	}
	widget, err := service.AddWidget(ctx, dash.ID, dashboard.WidgetInput{
		Type:   dashboard.WidgetTypeChart,
		Title:  "Monthly revenue",
		Layout: `{"i":"widget-1","x":0,"y":0,"w":4,"h":6}`,
	})
	if err != nil {
		t.Fatalf("add widget: %v", err)
	}

	mutation := fmt.Sprintf(
		`mutation { UpdateWidgetSnapshot(id:%q, snapshot:{Config:"{\"type\":\"bar\"}", Data:"{}", ExecutedAt:"2026-04-02T00:00:00Z"}) { Status } }`,
		widget.ID,
	)
	body, _ := json.Marshal(map[string]any{"query": mutation})
	recorder := executeDashboardGraphQL(t, service, ctx, body)

	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"Status":true`) {
		t.Fatalf("expected success, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func executeDashboardGraphQL(t *testing.T, service dashboard.ServiceAPI, ctx context.Context, body []byte) *httptest.ResponseRecorder {
	t.Helper()

	srv := handler.NewDefaultServer(NewExecutableSchema(Config{
		Resolvers: &Resolver{DashboardService: service},
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/query", bytes.NewBuffer(body))
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	srv.ServeHTTP(recorder, req)
	return recorder
}

func newDashboardServiceForGraphTest(t *testing.T) *dashboard.Service {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	service, err := dashboard.NewService(db)
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	return service
}

func contextWithScope(database string) context.Context {
	return context.WithValue(context.Background(), auth.AuthKey_Credentials, &engine.Credentials{
		Type:     "Postgres",
		Hostname: "db.internal",
		Database: database,
	})
}
