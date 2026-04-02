# Dashboard Chart-First Full Stack Design

**Date:** 2026-04-02  
**Scope:** `core/graph/`, `core/src/router/`, `core/server.go`, `core/src/dashboard/`, `dataflow/src/components/analysis/`, `dataflow/src/components/dashboard-sidebar/`, `dataflow/src/stores/`, `dataflow/src/graphql/`

## Overview

This design defines the first shippable full-stack version of `dataflow` analysis dashboards.

The existing backend storage spec is directionally correct about using a dedicated metadata PostgreSQL, but it is too broad for the product that actually exists today. The current user-facing feature is a chart dashboard editor, not a general widget platform. This design narrows phase 1 to `dashboard + chart widget persistence + chart runtime refresh`, and pushes `table`, `text`, `image`, `stats`, and `filter` widgets out of the first implementation.

The goal is to ship a durable, connection-scoped chart dashboard system that survives reloads, re-executes saved queries on open, and stays aligned with the current frontend architecture.

## Product Direction

Phase 1 should behave like this:

- dashboards are private to the current database connection scope
- users can create, rename, delete, and reopen dashboards
- users can create, edit, delete, and rearrange chart widgets
- opening a dashboard renders quickly from saved snapshot data, then refreshes from the live database
- refresh failures are isolated to individual widgets

Phase 1 should not try to behave like this:

- a generic BI workspace with many widget types
- a backend-managed query scheduler
- a multi-user sharing system
- a dataset modeling layer

## Why The Existing Backend Spec Needs Narrowing

The current product and codebase impose four concrete constraints:

1. The only complete authoring flow is chart creation and editing.
2. The frontend already owns query execution through `RawExecute`.
3. The frontend already exposes `refreshRule`, including `by-minute`, so persistence must include it.
4. Scope isolation cannot trust a client-provided `scopeKey` in a shared metadata store.

That means the first production design must:

- be chart-first
- keep runtime execution in the frontend
- persist `refreshRule`
- derive scope on the server from the authenticated connection context

## Phase 1 Scope

In scope:

- metadata persistence in a dedicated PostgreSQL database
- GraphQL dashboard and chart-widget CRUD
- persisted dashboard layouts
- persisted chart visualization definition
- persisted chart snapshot for fast first paint
- frontend definition/runtime/UI state split
- automatic chart refresh when a dashboard opens
- manual refresh and existing `by-minute` refresh behavior

Out of scope:

- non-chart widget creation and persistence
- backend-side chart execution or scheduling
- cross-user sharing or ACLs
- background jobs
- migration of old in-memory dashboard sessions
- a second dashboard visibility model beyond connection scope

## Connection Scope Model

Dashboards are scoped to the current authenticated database connection, not to a separate application user record.

The canonical scope key is:

`dbType:host:port:dbName`

The backend must derive this value from the authenticated credentials already stored in the request context:

- `dbType` from `auth.GetCredentials(ctx).Type`
- `host` from `auth.GetCredentials(ctx).Hostname`
- `port` from `auth.GetCredentials(ctx).Advanced["Port"]`, or empty string when unset
- `dbName` from `auth.GetCredentials(ctx).Database`

The frontend must never send `scopeKey` as a GraphQL argument.

This design intentionally treats MongoDB, Redis, and ClickHouse the same way as SQL databases at the scope layer: the scope key uses the current login database value exactly as the connection context resolved it during login. That keeps scope derivation deterministic and avoids database-type-specific branching in the resolver layer.

## Architecture

Phase 1 uses a split-responsibility model:

- backend stores dashboard definitions and snapshots
- frontend executes saved queries and produces runtime render state

High-level flow:

1. `AnalysisView` loads dashboard definitions for the current connection scope.
2. The active dashboard renders immediately from persisted definition and snapshot data.
3. The frontend runtime layer executes each chart widget through the existing `RawExecute` path.
4. Successful execution updates runtime state immediately and writes a fresh snapshot back to the backend.

This keeps dashboard persistence independent from database plugin execution while reusing the existing cross-database query path.

## Backend Design

### Metadata Database

WhoDB uses a dedicated PostgreSQL metadata database configured by:

- `WHODB_METADATA_DSN`

If the DSN is missing, dashboard GraphQL operations should return a clear configuration error. Phase 1 should not keep a second hidden in-memory persistence path behind the same UI. Local development should use a real metadata DSN when testing dashboard persistence.

### Database Schema

#### `dashboards`

```sql
CREATE TABLE dashboards (
    id            UUID PRIMARY KEY,
    scope_key     TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    refresh_rule  TEXT NOT NULL DEFAULT 'on-demand',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboards_scope_key ON dashboards (scope_key);
```

#### `widgets`

```sql
CREATE TABLE widgets (
    id            UUID PRIMARY KEY,
    dashboard_id  UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    type          TEXT NOT NULL,
    title         TEXT NOT NULL,
    description   TEXT,
    layout        JSONB NOT NULL,
    query         TEXT,
    query_context JSONB,
    visualization JSONB,
    snapshot      JSONB,
    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_widgets_dashboard_id ON widgets (dashboard_id);
```

### Schema Rules

- `dashboards.refresh_rule` accepts only `on-demand` or `by-minute`
- `widgets.type` accepts only `chart` in phase 1
- UUIDs are generated in Go before insert; the schema does not depend on `gen_random_uuid()`
- `layout`, `query_context`, `visualization`, and `snapshot` stay in `JSONB`
- GORM models should represent `JSONB` fields with `datatypes.JSON` or `json.RawMessage`, not plain `string`
- no unique constraint on dashboard name inside a scope

### JSON Shapes

`layout`:

```json
{ "i": "widget-layout-id", "x": 0, "y": 0, "w": 4, "h": 6 }
```

`query_context`:

```json
{ "database": "postgres", "schema": "public" }
```

`query_context.schema` is persisted for editor context and future extensions, but phase 1 refresh execution does not alter server-side schema/search-path behavior from this field. Saved queries must be self-contained or schema-qualified when schema selection matters.

`visualization`:

```json
{
  "chartConfig": {
    "chartType": "bar",
    "xAxisColumn": "month",
    "yAxisColumns": ["revenue"],
    "options": {
      "showLegend": true,
      "showGridLines": true,
      "showDataLabels": false
    },
    "sortBy": "data",
    "sortOrder": "asc"
  }
}
```

`snapshot`:

```json
{
  "config": { "type": "bar", "series": [], "xAxis": [], "chartConfig": {} },
  "data": {},
  "executedAt": "2026-04-02T12:00:00Z"
}
```

The snapshot stores the exact render payload the current chart widget already understands. That avoids rebuilding the chart renderer around a second persisted shape.

### Backend Package Layout

Add a focused package at `core/src/dashboard/`:

- `models.go`
  - GORM models for `Dashboard` and `Widget`
- `scope.go`
  - derive canonical `scope_key` from request credentials
- `repository.go`
  - database CRUD, preload, and transactions
- `service.go`
  - business validation, scope ownership checks, input validation

The GraphQL layer should not contain raw GORM logic beyond calling this package.

### GraphQL Contract

JSON fields continue to move over GraphQL as strings in phase 1. That keeps gqlgen and frontend codegen changes small and lets the backend treat chart JSON as opaque payload.

```graphql
type DashboardWidget {
    ID: ID!
    Type: String!
    Title: String!
    Description: String
    Layout: String!
    Query: String
    QueryContext: String
    Visualization: String
    Snapshot: String
    SortOrder: Int!
}

type Dashboard {
    ID: ID!
    Name: String!
    Description: String
    RefreshRule: String!
    Widgets: [DashboardWidget!]!
    CreatedAt: String!
    UpdatedAt: String!
}

input WidgetInput {
    Type: String!
    Title: String!
    Description: String
    Layout: String!
    Query: String
    QueryContext: String
    Visualization: String
    Snapshot: String
    SortOrder: Int
}

input UpdateWidgetInput {
    Title: String
    Description: String
    Layout: String
    Query: String
    QueryContext: String
    Visualization: String
    Snapshot: String
    SortOrder: Int
}

input LayoutInput {
    WidgetID: ID!
    Layout: String!
}

input SnapshotInput {
    Config: String!
    Data: String!
    ExecutedAt: String!
}
```

Queries:

```graphql
type Query {
    GetDashboards: [Dashboard!]!
}
```

Mutations:

```graphql
type Mutation {
    CreateDashboard(name: String!, description: String, refreshRule: String!): Dashboard!
    UpdateDashboard(id: ID!, name: String, description: String, refreshRule: String): Dashboard!
    DeleteDashboard(id: ID!): StatusResponse!

    AddWidget(dashboardId: ID!, input: WidgetInput!): DashboardWidget!
    UpdateWidget(id: ID!, input: UpdateWidgetInput!): DashboardWidget!
    DeleteWidget(id: ID!): StatusResponse!

    UpdateWidgetLayouts(dashboardId: ID!, layouts: [LayoutInput!]!): StatusResponse!
    UpdateWidgetSnapshot(id: ID!, snapshot: SnapshotInput!): StatusResponse!
}
```

### Resolver Rules

Resolvers must enforce these rules:

- never accept `scopeKey` from the client
- always derive scope from the request context
- always verify ownership before update or delete
- reject widget types other than `chart`
- reject `refreshRule` values other than `on-demand` and `by-minute`

Ownership checks work like this:

1. derive current `scope_key`
2. fetch target dashboard or widget
3. verify that the owning dashboard has the same `scope_key`
4. proceed or return an authorization-style error

### Query Pattern

`GetDashboards` should load dashboards and widgets in two queries via `Preload("Widgets")`:

```sql
SELECT * FROM dashboards
WHERE scope_key = $1
ORDER BY created_at DESC;

SELECT * FROM widgets
WHERE dashboard_id IN (...)
ORDER BY sort_order ASC, created_at ASC;
```

`UpdateWidgetLayouts` should run in a transaction and also bump `dashboards.updated_at`.

## Frontend Design

### State Split

The current `useAnalysisStore` is too coarse for a persistent dashboard system. Phase 1 should split it into three stores.

#### `analysisDefinitionStore`

Responsibilities:

- dashboard list
- active dashboard id
- API-backed initialization
- dashboard CRUD
- widget CRUD
- layout persistence

State shape:

- `dashboards: DashboardDefinition[]`
- `activeDashboardId: string | null`
- `isInitialized: boolean`
- `loadError: string | null`

#### `analysisRuntimeStore`

Responsibilities:

- widget execution state
- dashboard refresh
- single-widget refresh
- loading/error/stale markers

State shape:

- `widgetStatesById: Record<string, WidgetRuntimeState>`

Where each runtime state is:

```ts
type WidgetRuntimeState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  config?: any
  data?: any
  executedAt?: string
  error?: string
  isStale: boolean
}
```

#### `analysisUiStore`

Responsibilities:

- chart modal visibility
- selected widget id
- maximize/edit/delete modal state

### Definition Model

A persisted chart widget definition should look like:

```ts
type ChartWidgetDefinition = {
  id: string
  type: 'chart'
  title: string
  description?: string
  layout: { i: string; x: number; y: number; w: number; h: number }
  query?: string
  queryContext?: { database?: string; schema?: string }
  visualization?: { chartConfig: ChartConfig }
  snapshot?: { config: any; data: any; executedAt: string }
  sortOrder: number
}
```

This replaces the current mixed `config/data/query/queryContext` blob as the persisted source of truth.

### Runtime Model

For charts, runtime data is transient and should not overwrite the persisted definition in local state. Runtime render data should live separately and override snapshot data only while it is fresh.

Widget render priority:

1. fresh runtime result
2. persisted snapshot
3. loading state
4. error state
5. empty state

### Component Responsibilities

`AnalysisView`

- initialize definition store from `GetDashboards`
- render unavailable/error state if metadata persistence is not configured

`DashboardSidebar`

- render definition data only
- trigger dashboard CRUD actions

`DashboardEditor`

- render active definition
- trigger runtime refresh for the active dashboard
- preserve existing manual refresh and `by-minute` behavior

`DashboardWidget`

- render chart from runtime state first, then snapshot fallback
- render widget-local loading and error states

`ChartCreateModal` / `ChartCreateProvider`

- keep the current authoring flow
- on save, persist `visualization + snapshot + query + queryContext`
- stop treating persisted `config/data` as the mutable source of truth

### GraphQL Documents

Add these frontend documents:

- `queries/get-dashboards.graphql`
- `mutations/create-dashboard.graphql`
- `mutations/update-dashboard.graphql`
- `mutations/delete-dashboard.graphql`
- `mutations/add-widget.graphql`
- `mutations/update-widget.graphql`
- `mutations/delete-widget.graphql`
- `mutations/update-widget-layouts.graphql`
- `mutations/update-widget-snapshot.graphql`

## End-To-End Flows

### Load Analysis View

1. `AnalysisView` mounts.
2. `analysisDefinitionStore.initializeFromAPI()` calls `GetDashboards`.
3. The sidebar renders all dashboards returned for the current scope.
4. If an active dashboard exists, the editor renders immediately from definition and snapshot data.
5. `analysisRuntimeStore.refreshDashboard(activeDashboardId)` starts live refresh for all chart widgets.

### Create Dashboard

1. User opens dashboard form modal.
2. Frontend submits `CreateDashboard(name, description, refreshRule)`.
3. Backend derives scope from the request context and inserts the row.
4. Frontend appends the returned dashboard to definition state and activates it.

### Create Chart Widget

1. User creates a chart in `ChartCreateModal`.
2. The modal already has query results and a preview chart config.
3. On save, the frontend builds:
   - `visualization = { chartConfig }`
   - `snapshot = { config, data, executedAt }`
   - `query`
   - `queryContext`
4. Frontend submits `AddWidget`.
5. Backend stores the widget row and returns it.
6. Frontend inserts the returned widget into definition state.
7. Runtime state is marked fresh from the same preview payload until the next refresh cycle.

### Open Dashboard And Refresh Charts

1. User opens a dashboard.
2. Chart widgets render persisted snapshot data immediately when available.
3. Runtime store marks each chart widget as `loading`.
4. Each widget query executes through the existing `RawExecute` path.
   - phase 1 only applies the existing database override path
   - saved `queryContext.schema` is not used to mutate runtime execution semantics
5. On success:
   - runtime state becomes `success`
   - fresh `config/data/executedAt` replaces stale render data
   - frontend sends `UpdateWidgetSnapshot`
6. On failure:
   - runtime state becomes `error`
   - existing snapshot remains visible if present
   - the widget shows an inline stale/error indicator

### Persist Layout Changes

1. User drags or resizes widgets.
2. The editor updates local definition state optimistically.
3. The editor sends `UpdateWidgetLayouts(dashboardId, layouts)`.
4. Backend updates all widget layouts in one transaction.

## Error Handling

Backend errors should be explicit:

- metadata store unavailable
- dashboard not found
- widget not found
- dashboard or widget outside the current scope
- invalid widget type
- invalid refresh rule
- invalid JSON payload

Frontend behavior:

- dashboard-load failure shows a full analysis-surface error state
- widget refresh failure shows only widget-local error UI
- snapshot update failure should not roll back successful runtime rendering
- layout save failure should surface a toast/alert and keep local state consistent with the last confirmed server response on the next reload

## Testing Strategy

### Backend

Add tests for:

- scope key derivation from auth credentials
- `GetDashboards` only returning rows in the current scope
- `CreateDashboard` writing the server-derived scope
- `UpdateDashboard`, `DeleteDashboard`, `UpdateWidget`, `DeleteWidget`, `UpdateWidgetSnapshot`, and `UpdateWidgetLayouts` rejecting cross-scope access
- `AddWidget` rejecting non-chart types
- layout transaction updating all widgets and parent dashboard timestamp

### Frontend

Add tests for:

- definition store hydrating from `GetDashboards`
- `DashboardEditor` rendering snapshot data before live refresh completes
- widget runtime refresh replacing snapshot render state on success
- widget runtime refresh preserving snapshot on error
- `refreshRule = by-minute` triggering runtime refresh without mutating persisted definition state
- chart save building `visualization` and `snapshot` payloads correctly

### Manual Verification

Verify these flows manually:

- create dashboard, reload page, dashboard still exists
- create chart widget, reload page, chart snapshot still renders
- open dashboard and observe live chart refresh
- break a widget query and confirm only that widget shows an error
- move widgets and reload page to confirm layout persistence

## Implementation Sequence

1. Add metadata DB initialization and resolver dependency injection in `core`.
2. Add dashboard GraphQL schema and backend service/repository package.
3. Add frontend GraphQL documents and generated types.
4. Split the analysis store into definition/runtime/UI concerns.
5. Move dashboard CRUD to the definition store.
6. Move chart refresh to the runtime store with snapshot fallback.
7. Update chart create/edit save flow to persist `visualization` and `snapshot`.
8. Add backend and frontend tests for scope, refresh, and snapshot behavior.

## Future Extensions

After phase 1 is stable, these can be added on top of the same metadata model:

- `table` widget persistence
- `text` widget persistence
- `image` widget persistence
- derived `stats` widgets
- dashboard-level filters
- server-managed refresh jobs

They should be designed as separate follow-up specs rather than folded into the first shipping dashboard persistence pass.
