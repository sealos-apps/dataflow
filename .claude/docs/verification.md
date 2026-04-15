# Verification Checklist

Before marking any task as complete, run through this verification checklist.

## DataFlow (TypeScript/React)

### Type Checking
```bash
cd dataflow && pnpm run typecheck
```

### Build Verification
```bash
cd dataflow && pnpm run build
```

### Unit Tests
```bash
cd dataflow && pnpm run test
```

### Dead Code Check
After adding new code, verify it's actually used:
- Search for function/component names to confirm they're imported and called
- Check that new exports are imported somewhere
- Remove any unused imports, variables, or functions

## Backend (Go)

### Build Verification
```bash
cd core && go build ./...
```

### Vet Check
```bash
cd core && go vet ./...
```

### Dead Code Check
- Verify exported functions are called from somewhere
- Check that new types are actually used
- Remove unused imports (Go compiler will catch these)

## Quick Verification Commands

```bash
# DataFlow full check
cd dataflow && pnpm run typecheck && pnpm run build && pnpm run test

# Backend full check
cd core && go build ./... && go vet ./...
```
