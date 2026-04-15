<p align="center">
  <img src="docs/logo/logo.png" alt="DataFlow" width="100" />
</p>

<h1 align="center">DataFlow</h1>

<p align="center">
  A browser-based database workspace for exploring schemas, editing data, running queries, and building lightweight analysis views.
</p>

---

## Overview

DataFlow is the web workspace in this repository. It runs on top of the Go backend in [`core/`](./core) and provides a single interface for day-to-day database inspection and analysis.

### Supported Databases

| SQL | Document / Key-Value | Analytics |
|-----|----------------------|-----------|
| PostgreSQL | MongoDB | ClickHouse |
| MySQL | Redis | Elasticsearch |
| MariaDB | | |
| SQLite | | |

### Core Workflows

- Browse databases, schemas, tables, collections, and keys
- View, edit, insert, and delete records
- Run SQL and raw database queries
- Import and export data
- Build charts and dashboard widgets from query results
- Work across SQL, MongoDB, and Redis in one workspace

## Local Development

### Prerequisites

- Go 1.21+
- Node.js 22+
- pnpm 10+

### Start the App

```bash
# Install frontend dependencies
cd dataflow
pnpm install

# Terminal 1: backend
cd ../core
go run .

# Terminal 2: frontend
cd ../dataflow
pnpm dev
```

The frontend dev server runs at `http://localhost:5173` and proxies API requests to the backend.

## Frontend Checks

```bash
cd dataflow
pnpm run typecheck
pnpm run build
pnpm run test
```

## Build an Embedded Binary

To build a production binary that embeds the frontend assets:

```bash
cd dataflow
pnpm install
pnpm run build

cd ..
rm -rf core/build
cp -R dataflow/build core/build

cd core
go build -tags prod -o dataflow-server .
```

## Build a Docker Image

```bash
docker build -f core/Dockerfile -t dataflow-local .
docker run --rm -p 8080:8080 dataflow-local
```

Open `http://localhost:8080` after the container starts.

## Project Structure

```text
core/                   # Go backend
  server.go             # Entry point
  src/plugins/          # Database connectors
  graph/                # GraphQL schema and resolvers
  Dockerfile            # Production image build

dataflow/               # React 19 + TypeScript frontend
  src/main.tsx          # Entry point
  src/stores/           # Zustand stores
  src/components/       # Database, editor, analysis, and layout UI

dev/                    # Local database fixtures and helper scripts
docs/                   # Product and engineering docs
```

## Tech Stack

- Backend: Go, GraphQL (gqlgen), Chi, GORM
- Frontend: React 19, TypeScript, Zustand, Apollo Client, Vite, Tailwind CSS 4, Monaco Editor, ECharts, react-grid-layout

## License

Apache 2.0. See [`LICENSE`](./LICENSE).
