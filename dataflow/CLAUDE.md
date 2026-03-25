# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DataFlow — a database management and analysis platform. Frontend built as a Vite SPA, backend powered by [WhoDB](https://github.com/clidey/whodb) core (Go). The production build produces static files in `build/` that are embedded into the WhoDB Go binary via `go:embed`.

## Commands

```bash
pnpm dev        # Vite dev server at localhost:3000 (proxies /api to localhost:8080)
pnpm build      # Production build: tsc && vite build → output in build/
pnpm preview    # Preview production build locally
pnpm lint       # ESLint
pnpm typecheck  # TypeScript type checking (tsc --noEmit)
```

No test framework is configured.

## Architecture

**Vite SPA** with React 19, TypeScript, Tailwind CSS 4.

- Entry point: `src/main.tsx` renders `<App />` into `index.html`
- Router: client-side routing via `src/App.tsx`
- Build output: `build/` directory (static files, embedded by Go backend)

### Current State (Post-Cleanup)

- **No backend API routes** — backend is WhoDB core (Go) serving GraphQL
- **No AI layer** — `lib/ai/` has been removed
- **No database drivers** — `mongodb`, `mysql2`, `pg`, `redis` packages removed
- **No persistence layer** — conversations, dashboards, connections are not persisted
- **Frontend components remain** — database views, editor, dashboard builder exist but have non-functional API calls (pending WhoDB integration)

### Client State

- **React Context** (`contexts/`): `ConnectionContext` (connection list in localStorage, stub API functions), `TabContext` (open tabs, active tab)
- **Zustand stores** (`stores/`): `useAnalysisStore` (dashboards, components, layout — in-memory only)

### Component Organization

- `components/layout/` — MainLayout, ActivityBar (sidebar nav), Sidebar (tree browser), TabBar, TabContent
- `components/database/` — table/collection/Redis views and CRUD modals (~28 files, API calls pending WhoDB wiring)
- `components/analysis/` — dashboard builder with draggable grid widgets (react-grid-layout)
- `components/editor/` — SQL editor with Monaco (query execution pending WhoDB wiring)
- `components/ui/` — shared primitives (Button, Input, Badge, Modal, ContextMenu)

### Key Libraries

- **Monaco Editor** for SQL editing (loaded from CDN via `@monaco-editor/react`)
- **ECharts** for data visualization
- **react-grid-layout** for dashboard widget positioning
- **xlsx** for Excel/CSV export

### Next Step: WhoDB Integration

WhoDB core (Go) will serve as the backend via GraphQL API. The frontend components' `fetch()` calls need to be rewired to WhoDB's GraphQL endpoints for:
- Database connection management (WhoDB Login Profiles)
- Schema browsing (`GetDatabases`, `GetAllSchemas`, `GetStorageUnits`)
- Data CRUD (`GetRows`, `AddRow`, `DeleteRow`, etc.)
- Query execution (`RawExecute`)
- Dashboard persistence (via WhoDB's SQLite plugin)

## Conventions

- Path alias: `@/*` maps to the project root (configured in both `vite.config.ts` and `tsconfig.json`)
- Styling: `cn()` utility from `lib/utils.ts` (clsx + tailwind-merge). CSS variables defined in `src/index.css` (Nebula Pro Palette).
- Connection types are uppercase enums: `'MYSQL' | 'POSTGRES' | 'MONGODB' | 'REDIS'`
- Fonts: Inter (sans) + JetBrains Mono (monospace), loaded via Google Fonts in `index.html`
