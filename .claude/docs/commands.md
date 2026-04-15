# Development Commands Reference

## Backend

```bash
# Run backend
cd core && go run .

# Build CE binary
cd core && go build -o whodb .

# Run tests (see testing.md for full guide)
cd core && go test ./...
bash dev/run-backend-tests.sh all
```

## DataFlow

```bash
# Run DataFlow (separate terminal)
cd dataflow && pnpm dev

# Type check
cd dataflow && pnpm run typecheck

# Build
cd dataflow && pnpm run build

# Unit tests
cd dataflow && pnpm run test

# GraphQL code generation
cd dataflow && pnpm run generate
```

## CLI

```bash
# Build CLI
cd cli && go build -o whodb-cli .

# Run interactive mode
cd cli && go run .

# Run CLI tests
bash dev/run-cli-tests.sh
cd cli && go test ./...
```

## GraphQL Workflow

When modifying GraphQL:

1. Edit schema: `core/graph/schema.graphqls`
2. Run backend code generation: `cd core && go generate ./...`
3. Start the backend server
4. Run DataFlow code generation: `cd dataflow && pnpm run generate`
5. Import generated hooks from `@/generated/graphql`
