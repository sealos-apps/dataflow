# WhoDB Frontend Architecture

## Overview

The WhoDB frontend is a React 18 + TypeScript single-page application bundled with Vite. It communicates with the Go backend exclusively through GraphQL (Apollo Client). State is managed with Redux Toolkit and persisted to localStorage. Styling uses Tailwind CSS v4 plus a custom UI library (`@clidey/ux`).

---

## Directory Structure

```
frontend/
├── index.html                        # HTML shell
├── vite.config.ts                    # Vite bundler config (plugins, aliases, proxy)
├── tsconfig.json                     # TypeScript config (strict, path aliases)
├── codegen.ce.yml                    # GraphQL code generation config
├── package.json                      # Dependencies & scripts
│
├── src/
│   ├── index.tsx                     # React DOM mount, provider tree
│   ├── app.tsx                       # Root component (routes, modals, overlays)
│   ├── index.css                     # Tailwind imports, CSS variables, fonts
│   │
│   ├── config/                       # App-wide configuration
│   │   ├── routes.tsx                # Route definitions, lazy loading
│   │   ├── graphql-client.ts         # Apollo Client setup (links, cache, error handling)
│   │   ├── features.ts              # Feature flags
│   │   ├── database-types.ts        # Database type metadata
│   │   ├── meta.ts                  # Document title/description
│   │   ├── posthog.tsx              # Analytics (PostHog) init & consent
│   │   └── tour-config.tsx          # Onboarding tour config
│   │
│   ├── store/                        # Redux Toolkit state management
│   │   ├── index.ts                  # Store creation, persist config, transforms
│   │   ├── hooks.ts                  # Typed useAppDispatch, useAppSelector
│   │   ├── auth.ts                   # Auth state (profiles, login status, SSL)
│   │   ├── settings.ts              # UI preferences (font size, spacing, language, theme)
│   │   ├── chat.ts                  # AI chat sessions & messages
│   │   ├── scratchpad.ts            # SQL scratchpad cells & history
│   │   ├── database.ts             # Active database connection
│   │   ├── database-metadata.ts    # Schema/type metadata cache
│   │   ├── ai-models.ts            # AI provider settings
│   │   ├── providers.ts            # Data source providers
│   │   ├── health.ts               # Server/database health (transient, not persisted)
│   │   ├── tour.ts                 # Onboarding tour progress
│   │   └── migrations.ts           # Redux state migrations for version upgrades
│   │
│   ├── pages/                        # Route-level components (lazy-loaded)
│   │   ├── auth/                     # login.tsx, logout.tsx
│   │   ├── chat/                     # AI chat interface
│   │   ├── storage-unit/             # Table browser & explorer
│   │   ├── graph/                    # Schema relationship visualization
│   │   ├── raw-execute/              # SQL scratchpad
│   │   ├── settings/                 # User preferences
│   │   └── contact-us/              # Feedback page
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── sidebar/                  # Main navigation sidebar
│   │   ├── health/                   # Server/database down overlays
│   │   ├── graph/                    # Graph visualization components
│   │   ├── tour/                     # Onboarding tour provider & UI
│   │   ├── analytics/                # PostHog consent banner
│   │   ├── table.tsx                 # DataTable (sorting, filtering, pagination)
│   │   ├── editor.tsx               # CodeMirror SQL/JSON editor wrapper
│   │   ├── command-palette.tsx      # Cmd+K command palette
│   │   ├── keyboard-shortcuts-help.tsx  # Shortcuts help modal
│   │   ├── export.tsx               # Data export (CSV, JSON, etc.)
│   │   ├── import-data.tsx          # Data import/upload
│   │   ├── schema-viewer.tsx        # Schema structure viewer
│   │   └── ...                      # card, breadcrumbs, icons, loading, etc.
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-translation.ts        # YAML-based i18n
│   │   ├── useDesktop.ts            # Wails desktop app integration
│   │   ├── useDatabaseMetadata.ts   # Database schema fetcher
│   │   ├── use-profile-switch.ts    # Profile switching logic
│   │   ├── use-theme-customization.ts  # CSS variable application
│   │   ├── useSidebarShortcuts.ts   # Ctrl/Alt+1-4 navigation
│   │   ├── useEffectiveIsMac.ts     # OS detection
│   │   └── use-page-size.ts         # Pagination page size
│   │
│   ├── graphql/                      # GraphQL operation definitions (.graphql files)
│   ├── mutations/                    # GraphQL mutation definitions (.graphql files)
│   ├── generated/                    # Auto-generated types & hooks (graphql.tsx)
│   │
│   ├── utils/                        # Utility functions
│   │   ├── shortcuts.ts              # Centralized keyboard shortcut definitions
│   │   ├── platform.ts              # Platform detection (Mac/Windows/Linux)
│   │   ├── i18n.ts                  # Translation loading & interpolation
│   │   ├── languages.ts            # Supported language codes
│   │   ├── theme-customization.ts  # CSS variable overrides
│   │   ├── database-features.ts    # Database capability checks
│   │   ├── database-data-types.ts  # Data type mappings
│   │   ├── search-parser.ts        # Search query parser
│   │   ├── where-condition-to-sql.ts  # WHERE clause builder
│   │   └── ...                      # auth-headers, external-links, functions, etc.
│   │
│   ├── services/                     # Background services
│   │   ├── health-check.ts           # Periodic health monitoring
│   │   └── desktop.ts               # Desktop app integration
│   │
│   ├── locales/                      # i18n YAML translation files
│   │   ├── components/               # Per-component translations
│   │   ├── pages/                    # Per-page translations
│   │   ├── hooks/                    # Per-hook translations
│   │   └── config/                   # Config/service translations
│   │
│   └── types/                        # Type definitions
│
├── e2e/                              # Playwright E2E tests
│   ├── playwright.config.mjs
│   ├── support/                      # Test utilities
│   └── tests/                        # Feature test files
│
└── public/                           # Static assets (images, fonts, manifest)
```

---

## Provider Tree

`src/index.tsx` sets up the provider hierarchy:

```
<React.StrictMode>
  <Router>                              ← BrowserRouter (web) or HashRouter (desktop)
    <ApolloProvider>                    ← GraphQL client
      <PersistGate>                    ← Redux persist rehydration gate
        <Provider store={store}>       ← Redux store
          <ThemeProvider>              ← @clidey/ux dark/light mode
            <PostHogProvider>          ← Analytics (CE only)
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </PostHogProvider>
          </ThemeProvider>
        </Provider>
      </PersistGate>
    </ApolloProvider>
  </Router>
</React.StrictMode>
```

`src/app.tsx` (the `<App />` component) adds:
- Route definitions via React Router v7
- Global modals (command palette, keyboard shortcuts help)
- Health check overlays (server down, database down)
- Toast notifications
- Tour provider for onboarding
- Health check service lifecycle (starts on login, stops on logout)

---

## Routing

**Library**: React Router v7 (`react-router-dom`)

**Router selection**: `BrowserRouter` for web, `HashRouter` for desktop (Wails). Determined at runtime by `isDesktopApp()`.

**Route structure** (defined in `src/config/routes.tsx`):

| Route | Page | Access |
|---|---|---|
| `/login` | LoginPage | Public |
| `/storage-unit` | StorageUnit | Private |
| `/storage-unit/:storageUnit` | ExploreStorageUnit | Private |
| `/graph` | GraphPage | Private |
| `/scratchpad` | RawExecutePage | Private |
| `/chat` | ChatPage | Private |
| `/settings` | SettingsPage | Private (feature-flagged) |
| `/contact-us` | ContactUsPage | Private (feature-flagged) |
| `/logout` | LogoutPage | Private |
| `/` | Redirect to default page | Private |

**Protection**: A `<PrivateRoute>` wrapper checks `auth.status === "logged-in"` and redirects to `/login` if unauthorized.

**Lazy loading**: All page components use `React.lazy()` with `<Suspense>` boundaries and a `<LoadingPage />` fallback.

---

## State Management

**Stack**: Redux Toolkit + Redux Persist (localStorage)

### Store Slices

| Slice | Purpose | Persisted |
|---|---|---|
| `auth` | Login status, current profile, saved profiles, SSL config | Yes |
| `database` | Active database/schema selection | Yes |
| `settings` | UI preferences (font size, spacing, language, theme, page size) | Yes |
| `houdini` (chat) | AI chat sessions and messages | Yes (with Date transform) |
| `scratchpad` | SQL cells, code, execution history | Yes (with Date transform) |
| `aiModels` | AI provider configuration (OpenAI, Claude) | Yes |
| `databaseMetadata` | Database schema/type metadata cache | Yes |
| `providers` | Data source provider settings | Yes |
| `tour` | Onboarding tour progress | Yes |
| `health` | Server/database health status | **No** (transient) |

### Patterns

- **Typed hooks**: `useAppDispatch()` and `useAppSelector()` (from `store/hooks.ts`) for type-safe access
- **Date transforms**: Custom `createTransform()` for scratchpad and chat slices to serialize/deserialize `Date` objects in localStorage
- **Migrations**: `store/migrations.ts` provides backward-compatible state transformations when the store schema changes across versions
- **Rehydration**: `<PersistGate>` blocks rendering until localStorage state is loaded

---

## GraphQL Layer

### Client Setup (`src/config/graphql-client.ts`)

Apollo Client with a 3-link chain:

```
errorLink → authLink → httpLink
```

1. **errorLink** — Intercepts `401 Unauthorized`. Attempts auto-login using the stored profile (saved credentials or profile ID). On success, reloads the page. On failure, redirects to `/login`.
2. **authLink** — Injects `Authorization` header for desktop app (Wails), where cookies are unreliable.
3. **httpLink** — Posts to `/api/query` (relative URL; proxied to the backend in dev via Vite).

**Cache**: `InMemoryCache` with `no-cache` default fetch policy for both queries and mutations (always fresh data from the server).

### Code Generation

GraphQL Code Generator (`@graphql-codegen/cli`) produces `src/generated/graphql.tsx`:

- Input: `.graphql` files in `src/graphql/` and `src/mutations/`, plus backend schema at `core/graph/schema.graphqls`
- Output: TypeScript types for all operations + React Apollo hooks (`useXxxQuery`, `useXxxMutation`)
- Config: `codegen.ce.yml`
- Import alias: `@graphql` (configured in `tsconfig.json`)

### Usage Pattern

```typescript
// 1. Define operation in src/graphql/health.graphql
// 2. Run: pnpm run generate
// 3. Import and use:
import { useHealthQuery } from '@graphql';
const { data, loading, error } = useHealthQuery();
```

---

## Styling

### Tailwind CSS v4

Configured via Vite plugin (`@tailwindcss/vite`). Global styles in `src/index.css`:

```css
@import 'tailwindcss';
@import 'reactflow/dist/style.css';
@import '@clidey/ux/styles.css';
```

### CSS Variables (Dynamic Theming)

UI customization is driven by CSS variables set on `:root` / `.dark`:

- **Colors**: `--brand-foreground`, `--primary`, `--icon-foreground`
- **Font sizes**: `--font-size-xs` through `--font-size-3xl`
- **Spacing**: `--spacing-xs` through `--spacing-xl`

The `useThemeCustomization()` hook reads settings from Redux and applies CSS variable overrides to `document.documentElement.style`.

### UI Library

`@clidey/ux` provides base components (buttons, dialogs, forms, inputs, theme provider). Re-exported from `src/components/ux.tsx`.

---

## Keyboard Shortcuts

All shortcuts are centralized in `src/utils/shortcuts.ts`.

| Constant | Description |
|---|---|
| `SHORTCUTS.*` | Shortcut definitions (key, modifiers, displayKeys) |
| `matchesShortcut(event, def)` | Check if a keyboard event matches a shortcut |
| `resolveShortcut(platformDef)` | Pick Mac vs Windows variant |
| `formatShortcut(def)` | Render human-readable shortcut string |
| `getKeyDisplay(key)` | Convert key name to display symbol |

**Platform variants**: `PlatformShortcutDef` supports Mac (`Cmd`) vs Windows/Linux (`Alt`) for navigation shortcuts. Platform detection uses `getEffectiveIsMac()`, which respects the user's OS override in settings.

---

## Localization (i18n)

### Structure

YAML files organized by component path under `src/locales/`:

```
locales/
├── components/sidebar.yaml
├── pages/auth/login.yaml
├── hooks/use-translation.yaml
└── config/graphql-client.yaml
```

### Format

```yaml
en_US:
  key: "English text"
  greeting: "Hello, {name}"
```

### Usage

```typescript
const { t } = useTranslation('components/sidebar');
t('key')                              // → "English text"
t('greeting', { name: 'Alice' })      // → "Hello, Alice"
```

### Loading

`loadTranslationsSync()` in `src/utils/i18n.ts` uses Vite's `import.meta.glob` to eagerly bundle all YAML files at build time. Translations are cached after first load.

---

## Health Check Service

`src/services/health-check.ts` is a singleton that periodically queries the backend's `Health` GraphQL endpoint.

- **Starts** on login, **stops** on logout
- **Interval**: 5 seconds, with exponential backoff up to 60 seconds on failure
- **Dispatches** Redux actions to update `health` slice
- **UI**: `ServerDownOverlay` and `DatabaseDownOverlay` in `app.tsx` react to health state
- **Recovery**: Auto-reloads the page when connection is restored from an error state

---

## Build System

### Vite Configuration (`vite.config.ts`)

**Plugins**:
- `react()` — React Fast Refresh
- `tailwindcss()` — JIT Tailwind compilation
- `eeModulePlugin()` — Returns empty objects for missing EE imports (CE builds)
- `htmlMetaPlugin()` — Replaces `{{TITLE}}`/`{{DESCRIPTION}}` in `index.html`
- `istanbulPlugin()` — Code coverage instrumentation (test mode only, behind `VITE_E2E_TEST`)

**Path Aliases**:
- `@/` → `src/`
- `@graphql` → `src/generated/graphql.tsx` (CE) or EE equivalent

**Dev Server**:
- Port 3000
- Proxy: `/api/*` → `http://localhost:8080` (Go backend)

**Environment Variables** (build-time):
- `VITE_BUILD_EDITION` — `"ce"` or `"ee"`
- `VITE_E2E_TEST` — `"true"` enables coverage instrumentation
- `VITE_BACKEND_PORT` — Custom backend URL for dev proxy

### Build Commands

```bash
pnpm start          # Dev server (CE)
pnpm build          # Production build → build/
pnpm run generate   # GraphQL codegen
pnpm run typecheck  # TypeScript type checking
```

---

## Testing

### Playwright E2E (`e2e/`)

**Projects**:
- `standalone` — Read-only tests in Chromium
- `standalone-mutating` — Destructive tests (CRUD, import, mock data, etc.)
- `gateway` / `gateway-mutating` — Tests via Chrome DevTools Protocol

**Commands**:
```bash
pnpm e2e:ce              # Interactive (headed)
pnpm e2e:ce:headless     # Headless, all databases
pnpm e2e:db postgres     # Single database
pnpm e2e:feature graph   # Single feature
```

**Code Coverage**: `vite-plugin-istanbul` + `nyc` for instrumented test runs.

---

## Key Dependencies

| Category | Package | Version |
|---|---|---|
| Framework | `react`, `react-dom` | 18.3.1 |
| Bundler | `vite` | 7.1.11 |
| Language | `typescript` | 5.8.3 |
| State | `@reduxjs/toolkit`, `react-redux`, `redux-persist` | 2.9.0, 9.2.0, 6.0.0 |
| GraphQL | `@apollo/client`, `graphql` | 3.13.8, 16.11.0 |
| Routing | `react-router-dom` | 7.9.1 |
| UI | `@clidey/ux`, `@heroicons/react` | 0.39.0, 2.2.0 |
| CSS | `tailwindcss`, `tailwind-merge` | 4.1.12, 3.3.1 |
| Editor | `codemirror`, `@codemirror/lang-sql` | 6.0.2, 6.10.0 |
| Visualization | `reactflow`, `@dagrejs/dagre` | 11.11.4, 1.1.5 |
| Animation | `framer-motion` | 12.23.13 |
| i18n | `js-yaml` | 4.1.1 |
| E2E Testing | `@playwright/test` | 1.58.1 |

---

## Data Flow Diagram

```
User Interaction
       │
       ▼
┌─────────────┐     dispatch()     ┌──────────────────┐
│  React      │ ──────────────────▶│  Redux Store     │
│  Components │                    │  (Toolkit slices) │
│  (pages/    │ ◀──────────────────│                  │
│   components)│   useAppSelector() │  Persisted to    │
└──────┬──────┘                    │  localStorage    │
       │                           └──────────────────┘
       │ useXxxQuery()
       │ useXxxMutation()
       ▼
┌─────────────┐    HTTP POST       ┌──────────────────┐
│  Apollo      │ ──────────────────▶│  Go Backend      │
│  Client      │    /api/query      │  (GraphQL)       │
│  (links:     │ ◀──────────────────│                  │
│   error →    │    JSON response   └──────────────────┘
│   auth →     │
│   http)      │
└─────────────┘
```

---

## Architectural Patterns

**Functional components only** — No class components. All state and side effects use hooks.

**Lazy-loaded routes** — Every page uses `React.lazy()` + `<Suspense>` to code-split by route.

**Generated GraphQL types** — Operations defined in `.graphql` files, codegen produces typed hooks. No inline `gql` strings.

**Centralized keyboard shortcuts** — All shortcut definitions live in `shortcuts.ts`. Components use `matchesShortcut()` for event handling and `SHORTCUTS.*.displayKeys` for UI rendering.

**YAML-based localization** — Each component/page has a corresponding YAML file. The `useTranslation()` hook provides a `t()` function with interpolation support.

**CSS variable theming** — User preferences (font size, spacing, border radius) are applied as CSS variables on the document root, allowing all components to respond to setting changes without re-rendering.

**Health monitoring as a service** — A singleton service (not a component) manages periodic health checks with exponential backoff, dispatching state updates through Redux.

**Auto-login on 401** — The Apollo error link transparently retries authentication using stored credentials before surfacing errors to the UI.
