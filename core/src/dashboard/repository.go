package dashboard

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) (*Repository, error) {
	if db == nil {
		return nil, errors.New("missing metadata database")
	}

	repo := &Repository{db: db}
	if err := repo.db.AutoMigrate(&Dashboard{}, &Widget{}); err != nil {
		return nil, fmt.Errorf("auto-migrate dashboard metadata: %w", err)
	}

	return repo, nil
}

func (r *Repository) ListDashboardsByScope(ctx context.Context, scopeKey string) ([]Dashboard, error) {
	var dashboards []Dashboard
	err := r.db.WithContext(ctx).
		Preload("Widgets", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("sort_order ASC").Order("created_at ASC")
		}).
		Where("scope_key = ?", scopeKey).
		Order("created_at DESC").
		Find(&dashboards).Error
	if err != nil {
		return nil, err
	}

	return dashboards, nil
}

func (r *Repository) CreateDashboard(ctx context.Context, dashboard *Dashboard) error {
	return r.db.WithContext(ctx).Create(dashboard).Error
}

func (r *Repository) GetDashboard(ctx context.Context, id string) (*Dashboard, error) {
	var dashboard Dashboard
	err := r.db.WithContext(ctx).
		Preload("Widgets", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("sort_order ASC").Order("created_at ASC")
		}).
		First(&dashboard, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &dashboard, nil
}

func (r *Repository) SaveDashboard(ctx context.Context, dashboard *Dashboard) error {
	return r.db.WithContext(ctx).Save(dashboard).Error
}

func (r *Repository) DeleteDashboard(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&Dashboard{}, "id = ?", id).Error
}

func (r *Repository) CreateWidget(ctx context.Context, widget *Widget) error {
	return r.db.WithContext(ctx).Create(widget).Error
}

func (r *Repository) GetWidget(ctx context.Context, id string) (*Widget, error) {
	var widget Widget
	err := r.db.WithContext(ctx).
		Preload("Dashboard").
		First(&widget, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &widget, nil
}

func (r *Repository) SaveWidget(ctx context.Context, widget *Widget) error {
	return r.db.WithContext(ctx).Save(widget).Error
}

func (r *Repository) DeleteWidget(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&Widget{}, "id = ?", id).Error
}

func (r *Repository) UpdateWidgetLayouts(ctx context.Context, dashboardID string, layouts []LayoutInput) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for index, layout := range layouts {
			if err := tx.Model(&Widget{}).
				Where("id = ? AND dashboard_id = ?", layout.WidgetID, dashboardID).
				Updates(map[string]any{
					"layout":     []byte(layout.Layout),
					"sort_order": index,
					"updated_at": time.Now().UTC(),
				}).Error; err != nil {
				return err
			}
		}

		return tx.Model(&Dashboard{}).
			Where("id = ?", dashboardID).
			Update("updated_at", time.Now().UTC()).Error
	})
}
