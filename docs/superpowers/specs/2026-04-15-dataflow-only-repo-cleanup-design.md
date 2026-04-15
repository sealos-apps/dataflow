# DataFlow-Only Repository Cleanup

**Date**: 2026-04-15
**Scope**: repository root (`frontend`, `dataflow`, `core`, `dev`, `docs`, `.claude`, `CLAUDE.md`)
**Goal**: Remove the legacy `frontend` application and clean the repo so `dataflow` becomes the only supported web frontend

## Problem

The repository currently presents two frontend stories at once:

- `frontend/` still exists as the original React application.
- `dataflow/` is the new frontend the team is actively building.
- top-level build, Docker, and documentation entrypoints still point at `frontend/`.

That leaves the codebase in an ambiguous state:

- contributors can start or build the wrong app
- the default Docker image does not represent the intended frontend
- developer docs describe architecture that is no longer the target
- `dev/` scripts and test entrypoints preserve a dead workflow around the legacy app

The result is not just extra files. It is an incorrect repository contract.

## Decision

Adopt a single-frontend repository model:

- `dataflow/` is the only supported web frontend.
- `frontend/` is removed completely.
- the default repository build, run, and Docker paths target `dataflow/`.
- legacy frontend-specific scripts and docs are deleted instead of kept as historical references.

This intentionally prefers a clean break over compatibility aliases. The repository should describe what is true now, not preserve stale entrypoints.

## Scope

### In scope

- delete the entire `frontend/` directory
- switch default build and run commands from `frontend` to `dataflow`
- merge `core/Dockerfile.dataflow` into the default `core/Dockerfile`
- delete `core/Dockerfile.dataflow`
- update root docs and developer docs to describe a single frontend
- remove legacy `dev/` scripts that are only useful for the old frontend and its E2E flow
- remove old frontend references from `.claude` guidance where they are no longer valid
- reword backend comments and logs that still assume the old frontend name

### Out of scope

- redesigning `dataflow` architecture
- creating new DataFlow E2E infrastructure to replace the removed legacy flow
- rewriting every historical document in `docs/`; only docs that define current build, development, or architecture expectations need cleanup
- changing backend APIs unless needed to keep build/runtime messaging consistent

## Design

### 1. Repository shape after cleanup

After cleanup, the repository should read as:

- `core/` for the Go backend
- `dataflow/` for the web frontend
- `dev/` only for shared local development helpers that still serve the current repo
- `docs/` and `.claude/` updated so they no longer reference a removed app

There should be no remaining repository-level concept of an "original frontend" or "two React frontends".

### 2. Build and runtime entrypoints

The root entrypoints should all converge on `dataflow`:

- `README.md` build-from-source instructions use `cd dataflow`
- root `Makefile` `build` and `run` targets use `dataflow`
- default Docker build uses `core/Dockerfile` to build `dataflow`
- `core/Dockerfile` copies `dataflow/package.json`, `dataflow/pnpm-lock.yaml`, and `dataflow/`
- `core/Dockerfile.dataflow` is removed because it becomes redundant

This makes the default path the correct path. There should be no separate "dataflow Dockerfile" once DataFlow is the product frontend.

### 3. Dev tooling cleanup

`dev/` currently contains multiple scripts that hardcode `frontend/` paths, Playwright config locations, coverage folders, and log directories.

The cleanup rule is:

- keep shared database/bootstrap assets that are frontend-agnostic
- delete old frontend-specific E2E and coverage scripts if they no longer serve the active workflow

This includes removing scripts such as:

- `dev/run-e2e.sh`
- `dev/setup-e2e.sh`
- `dev/cleanup-e2e.sh`
- `dev/clean-coverage.sh`

If a script has mixed responsibility, only preserve it if the remaining responsibility is still meaningful for the DataFlow-only repository. Otherwise delete it.

### 4. Documentation cleanup strategy

Documentation should be updated by truthfulness, not completeness theater.

Rules:

- if a document defines current developer workflow, update it to `dataflow`
- if a section only documents the removed frontend architecture or file layout, delete that section
- if a document is almost entirely about the removed frontend and has no current value, remove it
- do not invent replacement instructions for DataFlow capabilities that do not exist yet

Primary cleanup targets:

- `README.md`
- `CLAUDE.md`
- `.claude/docs/commands.md`
- `.claude/docs/verification.md`
- `.claude/docs/testing.md`
- `.claude/docs/documentation.md`
- `.claude/docs/localization.md`
- `.claude/docs/ssl.md`
- `docs/installation.mdx`
- `docs/DEVELOPER_GUIDE.md`

For broad documents like `docs/DEVELOPER_GUIDE.md`, the preferred approach is targeted removal and rewriting of the build/development/frontend architecture sections rather than trying to preserve obsolete Redux/Apollo/locales/E2E details.

### 5. Backend wording and asset lookup

The backend should stop describing the removed app as the expected frontend.

This cleanup includes:

- updating comments in `core/embed_dev.go`
- updating log/error wording in `core/src/router/file_server.go`
- simplifying static asset lookup candidates if old legacy roots are no longer needed

Behaviorally, the backend should still serve embedded static files from the build output. The cleanup should remove legacy naming and compatibility branches only where safe.

## File Strategy

### Delete

- `frontend/`
- `core/Dockerfile.dataflow`
- legacy frontend-only scripts in `dev/` that no longer serve the current repo
- obsolete `.claude/docs/*` documents or sections that only describe the removed frontend

### Modify

- `README.md`
- `Makefile`
- `core/Dockerfile`
- `core/embed_dev.go`
- `core/src/router/file_server.go`
- `CLAUDE.md`
- selected files in `.claude/docs/`
- selected files in `docs/`
- `.dockerignore`
- `.gitignore` where legacy frontend-only ignore rules become dead

### Keep

- `dataflow/`
- `core/`
- shared `dev/sample-data`, `dev/docker-compose.yml`, and similar database fixtures that remain useful

## Error Handling and Risk Management

### Risk 1: External workflows may still call `core/Dockerfile.dataflow`

This repository cleanup can break external callers that explicitly reference the old filename. That is acceptable for this change, but the repo should make the new default obvious in docs and command names.

### Risk 2: Global deletion can remove still-useful scripts

Before deleting `dev/` assets, confirm they are truly frontend-specific. Shared DB bootstrap and helper assets stay. Hardcoded `frontend/` E2E/coverage flows go.

### Risk 3: Documentation can become partially migrated

Partial migration is worse than explicit deletion. If a document cannot be updated accurately for DataFlow without larger product work, remove the stale section instead of keeping a misleading one.

## Testing and Verification

The cleanup is complete only if repository-level behavior is verified after the removal.

### Required checks

- `cd dataflow && pnpm run typecheck`
- `cd dataflow && pnpm run build`
- `cd core && go build ./...`
- repository-wide search for `frontend/` and `cd frontend`

### Expected outcomes

- DataFlow builds successfully as the only frontend
- backend build still succeeds after Docker/dev wording and asset-path cleanup
- default instructions no longer direct users to the deleted app
- any remaining `frontend` string has been reviewed individually; deleted-path references and old workflow instructions block completion

## Success Criteria

The cleanup is successful when all of the following are true:

- `frontend/` no longer exists
- `core/Dockerfile.dataflow` no longer exists
- the default build and run path is `dataflow`
- repository docs no longer describe two frontends or tell users to work in `frontend`
- stale legacy frontend-only `dev/` workflows are removed
- `dataflow` and `core` verification commands pass, or any failure is explicitly documented before closing the task
