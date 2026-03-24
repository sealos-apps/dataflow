# Dev Tools Guide

Reference for the scripts and resources in `dev/`.

## Quick Start

```bash
# Run all E2E tests (headless)
./dev/run-e2e.sh true

# Run backend unit tests (no Docker needed)
./dev/run-backend-tests.sh unit

# Clean up everything when done
./dev/cleanup-e2e.sh ce
```

## Scripts

### `run-e2e.sh` — Playwright E2E Tests

```bash
./dev/run-e2e.sh [headless] [database] [spec]
```

| Argument | Default | Values |
|----------|---------|--------|
| `headless` | `true` | `true`, `false` |
| `database` | `all` | `postgres`, `mysql`, `mysql8`, `mariadb`, `sqlite`, `mongodb`, `redis`, `elasticsearch`, `clickhouse`, `all` |
| `spec` | all specs | A specific spec file name (e.g., `tables-list`) |

Examples:
```bash
./dev/run-e2e.sh true postgres tables-list   # One database, one spec
./dev/run-e2e.sh false all                   # GUI mode, all databases
./dev/run-e2e.sh true mysql                  # Headless, mysql only
```

Environment variables:
- `WHODB_DATABASES` — space-separated list of databases to test
- `WHODB_DB_CATEGORIES` — colon-separated db:category pairs (e.g., `"postgres:sql mysql:sql"`)
- `WHODB_SETUP_MODE` — mode to pass to `setup-e2e.sh` (default: `ce`)
- `WHODB_LOG_LEVEL` — log level (default: `error`)
- `CDP_ENDPOINT` — connect to an existing browser instead of launching Chromium

Or use the pnpm shortcuts from `frontend/`:
```bash
cd frontend
pnpm e2e:ce:headless    # Headless, all databases
pnpm e2e:ce             # Interactive (headed)
```

### `run-backend-tests.sh` — Go Backend Tests

```bash
./dev/run-backend-tests.sh [mode]
```

| Mode | What it runs | Docker needed? |
|------|-------------|----------------|
| `all` (default) | Unit + integration | Yes |
| `unit` | CE unit tests (+ EE if `ee/` exists) | No |
| `integration` | Live integration tests against Docker databases | Yes |
| `ssl` | SSL-specific integration tests | Yes |

Docker Compose is managed automatically — containers start before tests and stop after. Set `WHODB_MANAGE_COMPOSE=0` if you already have the containers running.

### `setup-e2e.sh` — Set Up E2E Environment

```bash
./dev/setup-e2e.sh [edition] [database]
```

- Starts Docker containers for the target database(s)
- Seeds sample data
- Builds and starts the test server

Examples:
```bash
./dev/setup-e2e.sh ce              # All CE databases
./dev/setup-e2e.sh ce postgres     # Postgres only
```

### `cleanup-e2e.sh` — Tear Down E2E Environment

```bash
./dev/cleanup-e2e.sh [edition]
```

What it does:
- Stops all Docker containers (including SSL profile)
- Removes volumes and prunes dangling volumes
- Kills the test server process
- Frees ports 3000 and 8080
- Cleans up temp files (preserves binary hash cache)

### `wait-for-services.sh` — Wait for Services

```bash
./dev/wait-for-services.sh
```

Waits (up to 60s by default) for backend (`:8080`) and frontend (`:3000`) to be ready. Configurable via:
- `BACKEND_URL` (default: `http://localhost:8080`)
- `FRONTEND_URL` (default: `http://localhost:3000`)
- `MAX_WAIT` (default: `60`)

### `clean-coverage.sh` — Clean Coverage Data

```bash
./dev/clean-coverage.sh
```

Removes both backend (`core/coverage.out`) and frontend (`.nyc_output/`, `coverage/`) coverage artifacts.

## Docker Compose Services

`docker-compose.yml` defines all test databases:

| Service | Port | Credentials |
|---------|------|-------------|
| Postgres | 5432 | `user` / `jio53$*(@nfe)` |
| MySQL | 3306 | `user` / `password` |
| MySQL 8.4.2 | 3307 | `user` / `password` |
| MariaDB | 3308 | `user` / `password` |
| MongoDB | 27017 | `user` / `password` |
| Redis | 6379 | `eYVX7EwVmmxKPCDmwMtyKVge8oLd2t81` |
| Elasticsearch | 9200 | `elastic` / `elastic123` |
| ClickHouse | 9001 (HTTP) / 9002 (native) | `default` / `clickhouse123` |

SSL variants are available under the `ssl` Docker Compose profile.

## Supporting Directories

| Directory | Purpose |
|-----------|---------|
| `sample-data/` | Init scripts seeded into containers on startup (one per DB) |
| `sample-import-data/` | Test files for import feature testing |
| `conf/` | SSL config files for each database |
| `certs/` | Test TLS certs + `generate.sh` to regenerate — **not for production** |

## Common Workflows

**Test a single database end-to-end:**
```bash
./dev/setup-e2e.sh ce postgres
./dev/run-e2e.sh true postgres
./dev/cleanup-e2e.sh ce
```

**Fast backend iteration (no Docker):**
```bash
./dev/run-backend-tests.sh unit
```

**Full integration suite:**
```bash
./dev/run-backend-tests.sh all
```

**Reset everything:**
```bash
./dev/cleanup-e2e.sh ce
./dev/clean-coverage.sh
```
