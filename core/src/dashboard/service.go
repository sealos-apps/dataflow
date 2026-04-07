package dashboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/clidey/whodb/core/src/plugins"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	RefreshRuleOnDemand = "on-demand"
	RefreshRuleByMinute = "by-minute"
	WidgetTypeChart     = "chart"
)

var (
	ErrMetadataStoreNotConfigured = errors.New("dashboard metadata store is not configured; set WHODB_METADATA_DSN")
	ErrDashboardNotFound          = errors.New("dashboard not found")
	ErrWidgetNotFound             = errors.New("widget not found")
	ErrInvalidRefreshRule         = errors.New("invalid refresh rule")
	ErrInvalidWidgetType          = errors.New("invalid widget type")
	ErrInvalidJSONPayload         = errors.New("invalid json payload")
	ErrScopeMismatch              = errors.New("dashboard or widget is outside the current scope")
)

type ServiceAPI interface {
	GetDashboards(ctx context.Context) ([]Dashboard, error)
	CreateDashboard(ctx context.Context, params CreateDashboardParams) (*Dashboard, error)
	UpdateDashboard(ctx context.Context, id string, params UpdateDashboardParams) (*Dashboard, error)
	DeleteDashboard(ctx context.Context, id string) error
	AddWidget(ctx context.Context, dashboardID string, input WidgetInput) (*Widget, error)
	UpdateWidget(ctx context.Context, id string, input UpdateWidgetInput) (*Widget, error)
	DeleteWidget(ctx context.Context, id string) error
	UpdateWidgetLayouts(ctx context.Context, dashboardID string, layouts []LayoutInput) error
	UpdateWidgetSnapshot(ctx context.Context, id string, snapshot SnapshotInput) error
}

type Service struct {
	repo *Repository
}

type CreateDashboardParams struct {
	Name        string
	Description *string
	RefreshRule string
}

type UpdateDashboardParams struct {
	Name        *string
	Description *string
	RefreshRule *string
}

type WidgetInput struct {
	Type          string
	Title         string
	Description   *string
	Layout        string
	Query         *string
	QueryContext  *string
	Visualization *string
	Snapshot      *string
	SortOrder     *int
}

type UpdateWidgetInput struct {
	Title         *string
	Description   *string
	Layout        *string
	Query         *string
	QueryContext  *string
	Visualization *string
	Snapshot      *string
	SortOrder     *int
}

type LayoutInput struct {
	WidgetID string
	Layout   string
}

type SnapshotInput struct {
	Config     string
	Data       string
	ExecutedAt string
}

func NewService(db *gorm.DB) (*Service, error) {
	repo, err := NewRepository(db)
	if err != nil {
		return nil, err
	}

	return &Service{repo: repo}, nil
}

func NewServiceFromEnv() (*Service, error) {
	dsn := strings.TrimSpace(os.Getenv("WHODB_METADATA_DSN"))
	if dsn == "" {
		return nil, ErrMetadataStoreNotConfigured
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(plugins.GetGormLogConfig()),
	})
	if err != nil {
		return nil, fmt.Errorf("open metadata database: %w", err)
	}

	if err := plugins.ConfigureConnectionPool(db); err != nil {
		return nil, fmt.Errorf("configure metadata connection pool: %w", err)
	}

	return NewService(db)
}

func (s *Service) GetDashboards(ctx context.Context) ([]Dashboard, error) {
	scopeKey, err := ScopeKeyFromContext(ctx)
	if err != nil {
		return nil, err
	}

	return s.repo.ListDashboardsByScope(ctx, scopeKey)
}

func (s *Service) CreateDashboard(ctx context.Context, params CreateDashboardParams) (*Dashboard, error) {
	scopeKey, err := ScopeKeyFromContext(ctx)
	if err != nil {
		return nil, err
	}

	refreshRule := params.RefreshRule
	if refreshRule == "" {
		refreshRule = RefreshRuleOnDemand
	}
	if !isValidRefreshRule(refreshRule) {
		return nil, ErrInvalidRefreshRule
	}

	name := strings.TrimSpace(params.Name)
	if name == "" {
		return nil, errors.New("dashboard name is required")
	}

	dashboard := &Dashboard{
		ID:          uuid.NewString(),
		ScopeKey:    scopeKey,
		Name:        name,
		Description: normalizeNullableString(params.Description),
		RefreshRule: refreshRule,
	}
	if err := s.repo.CreateDashboard(ctx, dashboard); err != nil {
		return nil, err
	}

	return s.repo.GetDashboard(ctx, dashboard.ID)
}

func (s *Service) UpdateDashboard(ctx context.Context, id string, params UpdateDashboardParams) (*Dashboard, error) {
	dashboard, err := s.getOwnedDashboard(ctx, id)
	if err != nil {
		return nil, err
	}

	if params.Name != nil {
		name := strings.TrimSpace(*params.Name)
		if name == "" {
			return nil, errors.New("dashboard name is required")
		}
		dashboard.Name = name
	}
	if params.Description != nil {
		dashboard.Description = normalizeNullableString(params.Description)
	}
	if params.RefreshRule != nil {
		if !isValidRefreshRule(*params.RefreshRule) {
			return nil, ErrInvalidRefreshRule
		}
		dashboard.RefreshRule = *params.RefreshRule
	}

	if err := s.repo.SaveDashboard(ctx, dashboard); err != nil {
		return nil, err
	}
	return s.repo.GetDashboard(ctx, dashboard.ID)
}

func (s *Service) DeleteDashboard(ctx context.Context, id string) error {
	if _, err := s.getOwnedDashboard(ctx, id); err != nil {
		return err
	}
	return s.repo.DeleteDashboard(ctx, id)
}

func (s *Service) AddWidget(ctx context.Context, dashboardID string, input WidgetInput) (*Widget, error) {
	dashboard, err := s.getOwnedDashboard(ctx, dashboardID)
	if err != nil {
		return nil, err
	}

	widget, err := newWidgetFromInput(dashboard.ID, input)
	if err != nil {
		return nil, err
	}

	if err := s.repo.CreateWidget(ctx, widget); err != nil {
		return nil, err
	}
	return s.repo.GetWidget(ctx, widget.ID)
}

func (s *Service) UpdateWidget(ctx context.Context, id string, input UpdateWidgetInput) (*Widget, error) {
	widget, err := s.getOwnedWidget(ctx, id)
	if err != nil {
		return nil, err
	}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return nil, errors.New("widget title is required")
		}
		widget.Title = title
	}
	if input.Description != nil {
		widget.Description = normalizeNullableString(input.Description)
	}
	if input.Layout != nil {
		widget.Layout, err = validateJSON("layout", *input.Layout, true)
		if err != nil {
			return nil, err
		}
	}
	if input.Query != nil {
		widget.Query = normalizeNullableString(input.Query)
	}
	if input.QueryContext != nil {
		widget.QueryContext, err = validateJSON("query_context", *input.QueryContext, false)
		if err != nil {
			return nil, err
		}
	}
	if input.Visualization != nil {
		widget.Visualization, err = validateJSON("visualization", *input.Visualization, false)
		if err != nil {
			return nil, err
		}
	}
	if input.Snapshot != nil {
		widget.Snapshot, err = validateJSON("snapshot", *input.Snapshot, false)
		if err != nil {
			return nil, err
		}
	}
	if input.SortOrder != nil {
		widget.SortOrder = *input.SortOrder
	}

	if err := s.repo.SaveWidget(ctx, widget); err != nil {
		return nil, err
	}
	return s.repo.GetWidget(ctx, widget.ID)
}

func (s *Service) DeleteWidget(ctx context.Context, id string) error {
	if _, err := s.getOwnedWidget(ctx, id); err != nil {
		return err
	}
	return s.repo.DeleteWidget(ctx, id)
}

func (s *Service) UpdateWidgetLayouts(ctx context.Context, dashboardID string, layouts []LayoutInput) error {
	if _, err := s.getOwnedDashboard(ctx, dashboardID); err != nil {
		return err
	}
	for _, layout := range layouts {
		if _, err := validateJSON("layout", layout.Layout, true); err != nil {
			return err
		}
	}

	return s.repo.UpdateWidgetLayouts(ctx, dashboardID, layouts)
}

func (s *Service) UpdateWidgetSnapshot(ctx context.Context, id string, snapshot SnapshotInput) error {
	widget, err := s.getOwnedWidget(ctx, id)
	if err != nil {
		return err
	}

	configJSON, err := validateJSON("snapshot.config", snapshot.Config, true)
	if err != nil {
		return err
	}
	dataJSON, err := validateJSON("snapshot.data", snapshot.Data, true)
	if err != nil {
		return err
	}

	combined, err := json.Marshal(map[string]any{
		"config":     json.RawMessage(configJSON),
		"data":       json.RawMessage(dataJSON),
		"executedAt": snapshot.ExecutedAt,
	})
	if err != nil {
		return fmt.Errorf("marshal snapshot: %w", err)
	}

	widget.Snapshot = combined
	if err := s.repo.SaveWidget(ctx, widget); err != nil {
		return err
	}
	return nil
}

func newWidgetFromInput(dashboardID string, input WidgetInput) (*Widget, error) {
	if input.Type != WidgetTypeChart {
		return nil, fmt.Errorf("%w: expected chart", ErrInvalidWidgetType)
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("widget title is required")
	}

	layout, err := validateJSON("layout", input.Layout, true)
	if err != nil {
		return nil, err
	}
	queryContext, err := validateJSONPointer("query_context", input.QueryContext)
	if err != nil {
		return nil, err
	}
	visualization, err := validateJSONPointer("visualization", input.Visualization)
	if err != nil {
		return nil, err
	}
	snapshot, err := validateJSONPointer("snapshot", input.Snapshot)
	if err != nil {
		return nil, err
	}

	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}

	return &Widget{
		ID:            uuid.NewString(),
		DashboardID:   dashboardID,
		Type:          input.Type,
		Title:         title,
		Description:   normalizeNullableString(input.Description),
		Layout:        layout,
		Query:         normalizeNullableString(input.Query),
		QueryContext:  queryContext,
		Visualization: visualization,
		Snapshot:      snapshot,
		SortOrder:     sortOrder,
	}, nil
}

func validateJSONPointer(name string, value *string) (json.RawMessage, error) {
	if value == nil {
		return nil, nil
	}
	return validateJSON(name, *value, false)
}

func validateJSON(name string, value string, required bool) (json.RawMessage, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		if required {
			return nil, fmt.Errorf("%w: %s is required", ErrInvalidJSONPayload, name)
		}
		return nil, nil
	}
	if !json.Valid([]byte(trimmed)) {
		return nil, fmt.Errorf("%w: %s", ErrInvalidJSONPayload, name)
	}
	return json.RawMessage(trimmed), nil
}

func normalizeNullableString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func isValidRefreshRule(value string) bool {
	return value == RefreshRuleOnDemand || value == RefreshRuleByMinute
}

func (s *Service) getOwnedDashboard(ctx context.Context, id string) (*Dashboard, error) {
	scopeKey, err := ScopeKeyFromContext(ctx)
	if err != nil {
		return nil, err
	}

	dashboard, err := s.repo.GetDashboard(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDashboardNotFound
		}
		return nil, err
	}
	if dashboard.ScopeKey != scopeKey {
		return nil, ErrScopeMismatch
	}
	return dashboard, nil
}

func (s *Service) getOwnedWidget(ctx context.Context, id string) (*Widget, error) {
	scopeKey, err := ScopeKeyFromContext(ctx)
	if err != nil {
		return nil, err
	}

	widget, err := s.repo.GetWidget(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWidgetNotFound
		}
		return nil, err
	}
	if widget.Dashboard.ScopeKey != scopeKey {
		return nil, ErrScopeMismatch
	}
	return widget, nil
}
