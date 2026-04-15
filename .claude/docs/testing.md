# Testing Guide

This document covers the current test infrastructure for WhoDB: DataFlow checks, Go backend tests, and CLI tests.

## Quick Reference

```bash
# DataFlow
cd dataflow && pnpm run typecheck
cd dataflow && pnpm run build
cd dataflow && pnpm run test

# Backend
cd core && go test ./...
bash dev/run-backend-tests.sh all
bash dev/run-backend-tests.sh unit
bash dev/run-backend-tests.sh integration

# CLI
bash dev/run-cli-tests.sh
cd cli && go test ./...
```

## DataFlow

- Unit tests run through Vitest: `cd dataflow && pnpm run test`
- Type and build checks are required before completion:
  - `cd dataflow && pnpm run typecheck`
  - `cd dataflow && pnpm run build`
- GraphQL code generation depends on the backend schema being available:
  - `cd core && go run .`
  - `cd dataflow && pnpm run generate`

## Backend

- Use `cd core && go test ./...` for Go package tests
- Use `bash dev/run-backend-tests.sh <mode>` for backend unit/integration suites
- Shared test databases are defined in `dev/docker-compose.yml`

## CLI

- Use `bash dev/run-cli-tests.sh` for the full CLI suite
- Use `cd cli && go test ./...` for package-level checks
