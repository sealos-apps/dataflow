# WhoDB Development Guide

WhoDB is a database management tool with a Go backend (`/core`) and a React frontend (`/dataflow`).

## Non-Negotiable Rules

1. **Analyze before coding** - Read relevant files and understand patterns before writing code. Always check to see if something existing was done, or if an existing pattern can be reused or adapted.
2. **GraphQL-first** - All new API functionality via GraphQL. Never add HTTP resolvers unless explicitly needed (e.g., file downloads)
3. **No SQL injection** - Never use `fmt.Sprintf` with user input for SQL. Use parameterized queries or GORM builders. See `.claude/docs/sql-security.md`
4. **Plugin architecture** - Never use `switch dbType` or `if dbType ==` in shared code. All database-specific logic goes in plugins. See `.claude/docs/plugin-architecture.md`
5. **Documentation requirements** - All exported Go functions/types need doc comments. All exported TypeScript functions/components need JSDoc. See `.claude/docs/documentation.md`
7. **Localization requirements** - All user-facing strings must use `t()` with YAML keys. No fallback strings. No hardcoded UI text. See `.claude/docs/localization.md`
8. **Verify before completing** - After finishing any task, verify: (1) `cd dataflow && pnpm run typecheck && pnpm run build`, (2) `cd core && go build ./...`, (3) no linting errors, (4) all added code is actually used (no dead code). See `.claude/docs/verification.md`
9. **Fallback clarification** - Do not include fallback logic UNLESS you were asked to. If you think the project could benefit from fallback logic, first ask and clarify
10. **Show proof** - When making a claim about how something outside of our codebase works, for example a 3rd party library or function, always provide official documentation or the actual code to back that up. Check online if you have to.
11. **No defensive code** - Do not program defensively. If there is an edge or use case that you think needs to be handled, first ask.

## Project Structure

```
core/                   # CE backend (Go)
  server.go             # Entry point (func main)
  src/src.go            # Engine initialization, plugin registration
  src/engine/plugin.go  # PluginFunctions interface
  src/env/              # Environment variable declarations (pure, no log dependency)
  src/envconfig/        # Config-loading functions that need both env and log
  src/plugins/          # Database connectors (each implements PluginFunctions)
  graph/schema.graphqls # GraphQL schema
  graph/*.resolvers.go  # GraphQL resolvers

dataflow/               # DataFlow analysis platform (React 19/TypeScript/Vite)
  src/main.tsx         # Entry point (@/* alias maps to src/)
  src/stores/          # Zustand state (auth, connection, tab, layout, analysis*)
  src/config/          # Apollo client, auth headers, sealos runtime config
  src/graphql/         # .graphql operation files (queries/, mutations/)
  src/generated/       # GraphQL codegen output (graphql.tsx)
  src/i18n/            # I18nProvider + locales/{en,zh}
  src/components/      # layout, sidebar, dashboard-sidebar, database (sql/mongodb/redis/shared),
                       #   analysis (chart-create, editor), editor (Monaco/SQL), ui (shadcn-style)
  src/utils/           # database-export, ddl-sql, mongodb-shell, sql-split, search-parser
  src/lib/utils.ts     # cn() — clsx + tailwind-merge
  src/test/            # Vitest tests + renderWithI18n helper
  docs/PRD.md          # Product requirements

dev/                    # Docker compose, test scripts, sample data
docs/                   # Integration plan and analysis
```

Additional docs: `.claude/docs/testing.md` (testing).

## Testing

See `.claude/docs/testing.md` for comprehensive testing documentation including:
- DataFlow type/build/test checks
- Docker container setup for test databases
- Go backend unit and integration tests

Quick reference:
```bash
# DataFlow checks
cd dataflow && pnpm run typecheck
cd dataflow && pnpm run build
cd dataflow && pnpm run test

# Backend Go tests
bash dev/run-backend-tests.sh all           # Unit + integration
```

## When Working on Backend (Go)

- Use `any` instead of `interface{}` (Go 1.18+)
- Use `plugins.WithConnection()` for all database operations - handles connection lifecycle
- SQL plugins should extend `GormPlugin` base class (`core/src/plugins/gorm/plugin.go`)
- When adding plugin functionality: add to `PluginFunctions` interface, implement in each plugin
- Use `ErrorHandler` (`core/src/plugins/gorm/errors.go`) for user-friendly error messages
- Never log sensitive data (passwords, API keys, tokens, connection strings)
- `env` package is for pure env var declarations only (no `log` import). Functions that parse env vars and need `log` for error reporting go in `envconfig`
- Delete build binaries after testing (`go build` artifacts)

## When Working on Frontend — DataFlow (`/dataflow`)

- Use PNPM, not NPM. Use pnpx, not npx
- Vite SPA with React 19, TypeScript, Tailwind CSS 4
- State management: Zustand (`dataflow/src/stores/`)
- Path alias: `@/*` maps to `src/` (configured in `vite.config.ts` and `tsconfig.json`)
- Styling: `cn()` utility (clsx + tailwind-merge), CSS variables in `src/globals.css`
- GraphQL codegen: define operations in `.graphql` files, run `pnpm run generate`
- Key libraries: Apollo Client, Monaco Editor, ECharts, react-grid-layout, xlsx, jszip

## When Updating Dependencies

Use `core/go.mod` as the reference point for dependency versions.

## Commands Quick Reference

See `.claude/docs/commands.md` for full reference.

```bash
# Backend: cd core && go run .
# Frontend: cd dataflow && pnpm dev
```

## Development Principles

- Clean, readable code over clever code
- Only add what is required - no overengineering
- Do not modify existing functionality without justification
- Do not rename variables/files unless necessary
- Remove unused code - no leftovers 
- Only comment edge cases and complex logic, not obvious code
- Ask questions to understand requirements fully
- Use subagents to accomplish tasks faster
- Maintain professional, neutral tone without excessive enthusiasm
- When you finish a task, go back and check your work. Check that it is correct and that it is not over-engineered
