# Dataflow Internationalization Design

## Goal

Add project-wide internationalization to `dataflow` with English and Chinese support while keeping the product behavior URL-driven:

- `lang=zh` renders Chinese
- `lang=en` renders English
- missing or unsupported `lang` falls back to Chinese
- `lang` and `theme` remain in the URL after initialization
- authentication parameters are removed from the URL after bootstrap

This design keeps the codebase English-oriented while making the default user-facing language Chinese.

## Scope

In scope:

- user-visible UI strings in the Dataflow SPA
- application bootstrap and URL parameter handling
- shared i18n provider, hook, locale dictionaries, and interpolation support
- representative test coverage for locale resolution, URL cleanup, fallback behavior, and component rendering

Out of scope:

- server-side rendering
- runtime language switching UI
- localStorage/sessionStorage persistence for locale
- translation of database object names, user input, schema names, table names, collection names, or raw backend error text
- pluralization, ICU message syntax, or locale-aware date/number formatting beyond the current requirements

## Current State

`dataflow` is a Vite + React 19 + TypeScript SPA. It currently has:

- no i18n library or locale abstraction
- user-visible strings hardcoded across layout, sidebar, SQL, MongoDB, Redis, analysis, and shared UI components
- bootstrap auth logic in `src/stores/useAuthStore.ts` that reads Sealos URL parameters, logs in, then clears the entire query string with `window.history.replaceState`

The current full-query cleanup would incorrectly remove non-sensitive parameters such as `lang` and `theme`, so URL handling must be made selective.

## Requirements

### Functional Requirements

1. Support two locales: `zh` and `en`.
2. Read locale only from the `lang` URL query parameter.
3. Default to `zh` when `lang` is missing or unsupported.
4. Preserve `lang` and `theme` in the browser URL after initialization.
5. Remove auth-related query parameters after initialization:
   - `dbType`
   - `credential`
   - `host`
   - `port`
   - `dbName`
6. Make project-wide user-visible copy translatable.
7. Allow dynamic string interpolation for titles, alerts, confirmations, and similar UI messages.
8. Keep implementation simple enough for ongoing maintenance by the current team.

### Non-Functional Requirements

1. Keep code-level identifiers, keys, and module names English-oriented.
2. Avoid introducing a heavyweight i18n framework when a small in-repo solution is sufficient.
3. Make missing translation mismatches visible during development.
4. Preserve existing application architecture and avoid unrelated refactors.

## Chosen Approach

Implement a lightweight in-repo i18n layer backed by React context and typed locale dictionaries.

This approach is preferred over `react-i18next` or similar libraries because the project only needs:

- two static locales
- startup-only locale resolution
- no manual locale switching
- no SSR integration
- simple interpolation and fallback behavior

The implementation should use:

- typed locale dictionaries under `src/i18n/locales/`
- a small locale resolution helper that reads `lang` from `window.location.search`
- a URL cleanup helper that removes only sensitive auth parameters
- an `I18nProvider` mounted at app root
- a `useI18n()` hook exposing `locale` and `t()`

## Architecture

### 1. Locale Resolution

Locale is resolved once during app bootstrap from the current URL.

Rules:

- `lang=zh` resolves to `zh`
- `lang=en` resolves to `en`
- any other value resolves to `zh`
- missing `lang` resolves to `zh`

No runtime locale mutation API is exposed because the product requirement is URL-only control.

### 2. URL Parameter Handling

Bootstrap parameter handling is split into two responsibilities:

- authentication bootstrap continues to live in `useAuthStore`
- shared URL parsing and cleanup logic moves into a dedicated helper under `src/i18n/` or `src/utils/`

Behavior after bootstrap:

- auth parameters are removed from the URL
- `lang` remains
- `theme` remains
- unrelated non-sensitive parameters remain

Example:

Input:

```text
http://localhost:3000?dbType=postgresql&credential=...&host=localhost&port=5432&dbName=postgres&lang=zh&theme=dark
```

Output after initialization:

```text
http://localhost:3000/?lang=zh&theme=dark
```

### 3. I18n Runtime

The i18n runtime consists of:

- `I18nProvider`
- `useI18n()`
- typed message dictionaries
- a `t(key, params?)` function with simple token replacement

`main.tsx` wraps the application with `I18nProvider` so all React components can read translated strings without prop drilling.

The context surface should be read-only:

- `locale`
- `messages`
- `t()`

There is intentionally no `setLocale()`.

### 4. Dictionary Structure

Use English semantic keys, not full English sentences as keys.

Recommended structure:

```text
src/i18n/
  I18nProvider.tsx
  useI18n.ts
  locale.ts
  url-params.ts
  locales/
    zh/
      common.ts
      layout.ts
      sidebar.ts
      sql.ts
      mongodb.ts
      redis.ts
      analysis.ts
      index.ts
    en/
      common.ts
      layout.ts
      sidebar.ts
      sql.ts
      mongodb.ts
      redis.ts
      analysis.ts
      index.ts
```

Example keys:

- `common.actions.refresh`
- `layout.activity.connections`
- `layout.empty.noTabsTitle`
- `sidebar.menu.newQuery`
- `sql.table.actions.addData`
- `mongodb.collection.deleteDocument.confirmTitle`
- `redis.alert.deleteSuccess`

Chinese acts as the canonical baseline dictionary. English must conform to the same shape by using TypeScript typing such as `satisfies typeof zhMessages`.

### 5. Message Interpolation

`t(key, params?)` supports simple placeholder interpolation using tokens like:

- `{database}`
- `{table}`
- `{key}`
- `{value}`

This is sufficient for:

- dynamic tab titles
- success and error alerts
- delete confirmations
- instructional labels

Advanced ICU formatting is intentionally excluded.

### 6. Fallback Behavior

Fallback rules:

- unsupported locale falls back to `zh`
- missing locale key falls back to the Chinese value for the same key
- if a key is missing in both dictionaries, return the key string itself
- in development, emit a warning for missing keys or missing non-Chinese translations

This keeps the UI usable while surfacing gaps during development.

## Component Migration Boundaries

The migration is project-wide, but the work should proceed in controlled slices.

### Slice 1: Shell and Shared UI

Translate high-visibility shell surfaces first:

- layout activity labels
- tab bar labels and empty states
- sidebar context menu labels
- shared UI default placeholders, buttons, alerts, confirmation text, and reusable toolbar copy

This establishes the core system and proves locale switching early.

### Slice 2: Database Views

Translate SQL, MongoDB, and Redis user-facing strings:

- toolbar labels
- modal titles and descriptions
- empty states
- confirmation copy
- local alert wrappers around backend errors
- provider-generated status copy shown in UI

### Slice 3: Analysis Views

Translate analysis sidebar, dashboard editor, chart creation, and related modal copy.

### Slice 4: Remaining Store and Provider Strings

Sweep remaining strings emitted from stores/providers into UI, especially:

- alerts
- fallback messages
- validation messages
- initialization and unsupported-mode copy

## Content Rules

Translate:

- labels
- buttons
- empty states
- modal titles and descriptions
- alert wrappers
- confirmation prompts
- search placeholders
- local validation messages

Do not translate:

- database names
- schema names
- table names
- collection names
- Redis key names
- user-entered content
- backend raw error messages

For backend or exception errors, translate only the surrounding shell text. Example:

- translate `Failed to connect to database`
- preserve the raw backend message appended after it if present

## Testing Strategy

The package currently has no test infrastructure, so minimal test support must be added before the broad string migration.

### Required Test Coverage

#### I18n Core Tests

- locale resolution for `zh`
- locale resolution for `en`
- fallback to `zh` when `lang` is missing
- fallback to `zh` when `lang` is unsupported
- auth URL cleanup removes only sensitive params
- `lang` and `theme` survive cleanup
- `t()` interpolates placeholders correctly
- `t()` falls back to Chinese when English translation is missing

#### Component Tests

At least two representative component-level tests:

- a shell component such as `ActivityBar` or `TabContent` renders Chinese and English correctly under different locale contexts
- one component or provider path with interpolation-based copy, such as an alert or confirmation message

### Verification Commands

Implementation is not part of this spec, but the final plan must include verification for:

- unit tests
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

## Risks and Mitigations

### Risk 1: Missed Hardcoded Strings

Strings are widely distributed, especially inside providers and modal components.

Mitigation:

- migrate by module slices
- use repository-wide string searches during the cleanup pass
- treat visible English or Chinese literals as migration targets unless they are data values

### Risk 2: Dynamic Copy Regressions

Some labels and titles are assembled from variables, such as:

- `Query - ${database}`
- `${database} Keys`

Mitigation:

- move dynamic UI copy behind `t()` with interpolation
- keep object identifiers outside translation keys

### Risk 3: Over-translation of Backend Errors

Raw backend messages may already contain useful technical detail.

Mitigation:

- translate wrapper copy only
- preserve backend payload text unchanged

### Risk 4: Locale Dictionary Drift

English may lag behind Chinese as the code evolves.

Mitigation:

- type the English dictionary against the Chinese baseline
- emit development warnings for missing translations

## Acceptance Criteria

The design is complete when implementation satisfies all of the following:

1. `lang=zh` renders the main UI in Chinese.
2. `lang=en` renders the main UI in English.
3. Missing or unsupported `lang` renders Chinese.
4. After startup, auth parameters are removed from the URL.
5. After startup, `lang` and `theme` remain in the URL.
6. The app root, sidebar, tab shell, SQL views, MongoDB views, Redis views, analysis views, and shared user-facing modals use translated copy instead of hardcoded user-visible strings.
7. Dynamic UI copy uses interpolation instead of inline string concatenation where translation is required.
8. Build, typecheck, lint, and newly added i18n tests pass.

## File Impact Summary

Expected new areas:

- `dataflow/src/i18n/**`
- test files for i18n runtime and representative components

Expected modified areas:

- `dataflow/src/main.tsx`
- `dataflow/src/stores/useAuthStore.ts`
- layout components
- sidebar components
- shared UI components with default text
- SQL, MongoDB, Redis, and analysis components/providers that expose user-visible copy

## Open Decisions Resolved

The following product decisions are fixed by this design:

- locale source: URL `lang` parameter only
- supported locales: `zh`, `en`
- default locale: `zh`
- runtime locale switcher: not included
- URL cleanup policy: remove auth params, preserve `lang` and `theme`
- codebase language for keys and structure: English
- default displayed language with no `lang`: Chinese
