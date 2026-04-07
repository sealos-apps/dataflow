package dashboard

import (
	"encoding/json"
	"time"
)

type Dashboard struct {
	ID          string    `gorm:"primaryKey"`
	ScopeKey    string    `gorm:"column:scope_key;index;not null"`
	Name        string    `gorm:"not null"`
	Description *string
	RefreshRule string    `gorm:"column:refresh_rule;not null;default:on-demand"`
	Widgets     []Widget  `gorm:"foreignKey:DashboardID;constraint:OnDelete:CASCADE"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

type Widget struct {
	ID            string          `gorm:"primaryKey"`
	DashboardID   string          `gorm:"column:dashboard_id;index;not null"`
	Dashboard     Dashboard       `gorm:"foreignKey:DashboardID"`
	Type          string          `gorm:"not null"`
	Title         string          `gorm:"not null"`
	Description   *string
	Layout        json.RawMessage `gorm:"type:jsonb;not null"`
	Query         *string
	QueryContext  json.RawMessage `gorm:"column:query_context;type:jsonb"`
	Visualization json.RawMessage `gorm:"type:jsonb"`
	Snapshot      json.RawMessage `gorm:"type:jsonb"`
	SortOrder     int             `gorm:"column:sort_order;not null;default:0"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime"`
}

func (*Dashboard) TableName() string {
	return "dashboards"
}

func (*Widget) TableName() string {
	return "widgets"
}
