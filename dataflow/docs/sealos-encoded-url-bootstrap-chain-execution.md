# Sealos Kubeconfig Bootstrap Execution Plan

**Date**: 2026-04-15  
**Source**: `dataflow/docs/sealos-encoded-url-bootstrap-chain.md`  
**Status**: Draft execution plan  
**Scope**: `dataflow/` frontend bootstrap, `core/` auth/session, local dev tooling, staged rollout

## 1. Review Outcome

The proposal is directionally correct and should proceed, but the execution plan must absorb the following corrections before implementation starts:

1. Persist a bootstrap descriptor in addition to the opaque auth session.
   The proposed `AuthSession` shape keeps `sessionToken`, display metadata, and expiry, but it drops `resourceName`. Once the frontend removes bootstrap params from the URL, it can no longer satisfy the documented "401 -> bootstrap once again" behavior without a separately stored descriptor.

2. Treat `BootstrapSealosSession` as a public GraphQL operation.
   The current auth middleware allows `Login`, `LoginWithProfile`, and a fixed set of public operations before credentials exist. The new bootstrap mutation must be added to that allowlist or the request will be rejected before the server session can be created.

3. Expand the frontend scope beyond the file list in the proposal.
   The design requires two runtime behaviors that are not covered by the current file-level impact section:
   - one-shot rebootstrap on `401 Unauthorized`
   - runtime locale sync from Sealos `CHANGE_I18N`
   Both require changes in Apollo client wiring and i18n bootstrap flow, not only auth storage.

4. Include dependency and tooling work in phase scope.
   The repo currently has no Kubernetes client dependency in `core/go.mod`, still injects `VITE_WHODB_AES_KEY` during container builds, and still generates local Sealos URLs with encrypted `credential`. Those updates belong in the rollout plan, not in a later cleanup bucket.

## 2. Execution Assumptions

This plan uses the following assumptions so implementation stays narrow and avoids speculative fallback logic:

1. Upstream Sealos startup URLs will provide `resourceName` before the feature flag is enabled in production.
2. Phase 1 will not implement backend inference from `host` or `port` back to a Kubernetes resource name.
3. Manual login remains on the existing inline-credential path in phase 1.
4. `WHODB_SESSION_DSN` reuses `WHODB_METADATA_DSN` when unset; this fallback is accepted for phase 1 rollout.
5. Session TTL stays environment-driven and defaults to `24h`.

If any of these assumptions becomes false, update the design first rather than adding compatibility code ad hoc.

## 3. Deliverables

Implementation is complete only when all of the following exist:

1. A backend GraphQL mutation that accepts Sealos bootstrap input, resolves DB credentials from Kubernetes, verifies connectivity, and returns an opaque session token.
2. A server-side session store that encrypts `engine.Credentials`, stores only `sha256(token)`, and supports expiry lookup.
3. Frontend bootstrap that uses Sealos session data plus URL metadata, then persists only session summary plus bootstrap descriptor.
4. Request auth that sends `Authorization: Bearer session:<token>` and passes database overrides separately.
5. One-shot 401 recovery in Sealos mode.
6. Updated local dev tooling so the new flow can be exercised without the old AES credential path.

## 4. File Inventory

### Backend

- Modify: `core/go.mod`
- Modify: `core/src/env/env.go`
- Modify: `core/graph/schema.graphqls`
- Modify: `core/graph/schema.resolvers.go`
- Modify: `core/src/auth/auth.go`
- Modify: `core/src/auth/auth_middleware_test.go`
- Modify: `core/src/auth/auth_test.go`
- Create: `core/src/session/models.go`
- Create: `core/src/session/repository.go`
- Create: `core/src/session/crypto.go`
- Create: `core/src/session/service.go`
- Create: `core/src/session/service_test.go`
- Create: `core/src/sealos/types.go`
- Create: `core/src/sealos/resolver.go`
- Create: `core/src/sealos/resolver_test.go`
- Create: `core/graph/sealos_bootstrap_test.go`

### Frontend

- Modify: `dataflow/package.json`
- Modify: `dataflow/src/main.tsx`
- Modify: `dataflow/src/config/auth-store.ts`
- Modify: `dataflow/src/config/auth-headers.ts`
- Modify: `dataflow/src/config/graphql-client.ts`
- Modify: `dataflow/src/config/sealos.ts`
- Modify: `dataflow/src/stores/useAuthStore.ts`
- Modify: `dataflow/src/stores/useConnectionStore.ts`
- Modify: `dataflow/src/i18n/I18nProvider.tsx`
- Modify: `dataflow/src/i18n/url-params.ts`
- Modify: `dataflow/src/i18n/locales/en/common.ts`
- Modify: `dataflow/src/i18n/locales/zh/common.ts`
- Create: `dataflow/src/stores/useSealosStore.ts`
- Create: `dataflow/src/graphql/mutations/bootstrap-sealos-session.graphql`
- Modify: `dataflow/src/generated/graphql.tsx` via codegen
- Create: `dataflow/src/test/auth-headers.test.ts`
- Create: `dataflow/src/test/url-params.test.ts`
- Create: `dataflow/src/test/useAuthStore.sealos.test.ts`

### Tooling and Dev Support

- Modify: `dev/generate-sealos-url.mjs`
- Modify: `core/Dockerfile`

## 5. Execution Sequence

### Step 1. Add backend session primitives

**Goal:** Create the server-owned auth session layer before touching the frontend flow.

**Work:**

1. Add session configuration declarations to `core/src/env/env.go`.
   Required values:
   - `WHODB_SESSION_DSN`
   - `WHODB_SESSION_ENCRYPTION_KEY`
   - `WHODB_SESSION_TTL`
   - `WHODB_SEALOS_BOOTSTRAP_ENABLED`

2. Add Kubernetes client dependencies in `core/go.mod`.
   Keep all Kubernetes-specific code inside `core/src/sealos/`; do not leak client-specific types into shared auth or plugin code.

3. Implement `core/src/session/`.
   Recommended responsibilities:
   - `models.go`: GORM model for `auth_sessions`
   - `repository.go`: create/get/revoke/update-last-seen methods
   - `crypto.go`: AES-GCM encrypt/decrypt helpers plus token hashing
   - `service.go`: open DB, run `AutoMigrate`, create/load/revoke sessions, parse TTL

4. Reuse the same metadata-store pattern as `core/src/dashboard`, but keep the session package isolated.
   Do not mix dashboard and auth session tables in the same package.

**Exit criteria:**

1. A session can be created from `engine.Credentials`, loaded by raw token, and rejected when expired or revoked.
2. Unit tests cover encrypt/decrypt roundtrip, hashing, TTL handling, and repository persistence.

### Step 2. Implement Sealos secret resolution and bootstrap mutation

**Goal:** Move Sealos bootstrap from frontend credential decryption to backend Kubernetes secret lookup.

**Work:**

1. Implement `core/src/sealos/`.
   Recommended responsibilities:
   - `types.go`: bootstrap input normalization and resolved secret payload
   - `resolver.go`: kubeconfig client construction, namespace resolution, Secret lookup, dbType-to-secret-key mapping, host normalization, host/port assertion

   This package should be treated as a `dbprovider` compatibility layer, not as a fresh interpretation of Sealos behavior.

   Required parity with current `dbprovider` behavior:
   - resolve namespace as `context.namespace || ns-<current-user-name>`
   - keep Secret naming as `<resourceName>-conn-credential`
   - keep Secret key mapping aligned with `dbprovider`
   - normalize Secret host as:
     - use as-is when it already contains `.svc`
     - otherwise append `.<namespace>.svc`
   - ensure host assertion compares against that normalized host value

   When building the Kubernetes client from `kubeconfig`, preserve compatibility with the current Sealos runtime behavior instead of assuming raw kubeconfig loading is sufficient in every deployment environment.

2. Add new schema types and mutation in `core/graph/schema.graphqls`:
   - `SealosBootstrapInput`
   - `AuthSessionPayload`
   - `BootstrapSealosSession`

3. Run gqlgen after schema changes:
   - `cd core && go generate ./...`

4. Implement the resolver in `core/graph/schema.resolvers.go`.
   Resolver sequence:
   - reject if feature flag is off
   - validate required input
   - resolve Secret from Kubernetes
   - build `engine.Credentials`
   - verify availability with the existing plugin path
   - create server session
   - return session summary plus opaque token

5. Add the new mutation to the public-operation allowlist in `core/src/auth/auth.go`.

**Exit criteria:**

1. `BootstrapSealosSession` works without a prior DataFlow auth token.
2. Resolver tests cover success, unsupported `dbType`, missing Secret fields, host mismatch, port mismatch, and database connectivity failure.
3. Compatibility tests prove the WhoDB Sealos resolver produces the same effective namespace, Secret name, normalized host, and port as the current `dbprovider` logic for the same kubeconfig and Secret fixture.

### Step 3. Extend auth middleware for session tokens

**Goal:** Support `Bearer session:<opaque-token>` while keeping the old inline path intact.

**Work:**

1. Update `core/src/auth/auth.go` to branch before base64 decoding:
   - if header starts with `Bearer session:`, resolve server session
   - otherwise keep the existing base64 JSON logic

2. Apply database override from `X-WhoDB-Database` only in the new session branch.
   The override should mutate the in-memory `engine.Credentials` used for that request, not the stored session row.

3. Keep `Login` and `LoginWithProfile` behavior unchanged in phase 1.

4. Add middleware tests for:
   - valid session token
   - expired token
   - revoked token
   - missing token
   - database override
   - compatibility with legacy inline credentials

**Exit criteria:**

1. Existing auth tests still pass.
2. New session tokens can access the same plugin-backed operations as legacy inline credentials.

### Step 4. Replace frontend Sealos auth bootstrap

**Goal:** The frontend should bootstrap with Sealos session data and stop storing DB username/password.

**Work:**

1. Add the Sealos bootstrap mutation file:
   - `dataflow/src/graphql/mutations/bootstrap-sealos-session.graphql`

2. Regenerate frontend GraphQL types:
   - `cd dataflow && pnpm run generate`

3. Replace `AuthCredentials` in `dataflow/src/config/auth-store.ts` with two persisted records:
   - `AuthSessionSummary`
   - `BootstrapDescriptor`

   Recommended shape:

   ```ts
   type AuthSessionSummary = {
     sessionToken: string;
     type: string;
     hostname: string;
     port: string;
     database: string;
     displayName: string;
     expiresAt: string;
   };

   type BootstrapDescriptor = {
     dbType: string;
     resourceName: string;
     databaseName: string;
     host?: string;
     port?: string;
     namespace?: string;
     fingerprint: string;
   };
   ```

4. Update `dataflow/src/config/sealos.ts`.
   Keep:
   - dbType mapping
   - default database helpers
   - bootstrap param parsing

   Remove:
   - AES decrypt helper
   - all references to `VITE_WHODB_AES_KEY`

5. Rewrite `dataflow/src/stores/useAuthStore.ts`.
   New responsibilities:
   - parse Sealos bootstrap params
   - obtain Sealos `kubeconfig`
   - call `BootstrapSealosSession`
   - persist session summary plus bootstrap descriptor
   - remove bootstrap params only after successful bootstrap
   - restore existing session summary when no bootstrap params are present
   - expose `rebootstrap()` for one-shot retry

6. Stop storing DB credentials in `sessionStorage`.
   `dataflow/src/config/auth-store.ts` should never persist `Username`, `Password`, or `Advanced`.

**Exit criteria:**

1. No frontend storage record contains DB credentials.
2. Refresh within the same tab restores the opaque session summary and the bootstrap descriptor.

### Step 5. Update request auth and 401 recovery

**Goal:** Carry only the opaque token on normal requests and support one automatic rebootstrap in Sealos mode.

**Work:**

1. Update `dataflow/src/config/auth-headers.ts`.
   New behavior:
   - `Authorization: Bearer session:<token>`
   - `X-WhoDB-Database: <database>` only when a per-request override is present

2. Update `dataflow/src/config/graphql-client.ts`.
   Add a guarded retry path in `errorLink`:
   - if a request fails with `401`
   - and the app is in Sealos mode
   - and the request has not already been retried
   - call `useAuthStore.getState().rebootstrap()`
   - replay the request once

3. Keep non-Sealos failures on the existing error path.

4. Add frontend tests for:
   - auth header formatting
   - database override header
   - one-shot 401 recovery
   - no infinite retry loop

**Exit criteria:**

1. Normal GraphQL requests no longer send base64-encoded DB credentials in the Authorization header.
2. A single expired server session causes at most one rebootstrap attempt.

### Step 6. Add Sealos runtime store and i18n synchronization

**Goal:** Match the design requirement for `getSession()`, `getLanguage()`, and runtime language changes.

**Work:**

1. Add the Sealos Desktop SDK dependency in `dataflow/package.json`.
   Use the same SDK surface assumed by the design doc:
   - `createSealosApp()`
   - `sealosApp.getSession()`
   - `sealosApp.getLanguage()`
   - `CHANGE_I18N` event subscription

2. Create `dataflow/src/stores/useSealosStore.ts`.
   Responsibilities:
   - initialize Sealos SDK
   - load `getSession()`
   - load `getLanguage()`
   - expose `loading`, `session`, `language`, `isInSealosDesktop`
   - subscribe to `CHANGE_I18N`

3. Update `dataflow/src/main.tsx`.
   Replace eager `useAuthStore.getState().initialize()` with an app bootstrap component that waits for:
   - Sealos initialization
   - auth initialization

4. Update `dataflow/src/i18n/I18nProvider.tsx`.
   The provider currently receives a fixed locale prop at mount time. Make locale runtime-updatable so Sealos language change events can trigger UI updates without full page reload.

5. Add or update i18n keys in:
   - `dataflow/src/i18n/locales/en/common.ts`
   - `dataflow/src/i18n/locales/zh/common.ts`

   Required additions:
   - bootstrap failure states
   - unsupported dbType
   - retry-in-progress state
   - rebootstrap failed state

**Exit criteria:**

1. Sealos language changes update the UI at runtime.
2. All new user-facing strings are localized through the existing TypeScript locale files.

### Step 7. Rework connection summary derivation

**Goal:** Remove frontend assumptions that a live connection object always carries DB credentials.

**Work:**

1. Update `dataflow/src/stores/useConnectionStore.ts` to derive the single Sealos connection from `AuthSessionSummary`, not from `AuthCredentials`.
2. Audit the `Connection` interface.
   Current repo usage only writes `user` and `password` inside `deriveConnection()`. Remove those fields unless a real UI requirement is discovered during implementation.
3. Keep database switching behavior driven by request context and `X-WhoDB-Database`, not by mutating stored auth state.

**Exit criteria:**

1. Sidebar and editor flows still render correctly with token-only auth state.
2. No frontend component requires DB password to render or execute a query.

### Step 8. Update tooling and rollout support

**Goal:** Make the new path testable locally and remove the old AES bootstrap path when the flag is ready.

**Work:**

1. Update `dev/generate-sealos-url.mjs`.
   Phase 1 local generator should emit:
   - `dbType`
   - `resourceName`
   - `host`
   - `port`
   - `databaseName`
   - `lang`
   - `theme`

   It should no longer generate encrypted `credential` blobs for the new path.

2. Update `core/Dockerfile`.
   Phase 1:
   - stop relying on `WHODB_AES_KEY` for new flow builds

   Phase 3 cleanup:
   - remove the remaining `VITE_WHODB_AES_KEY` injection entirely

3. Add staging environment wiring for:
   - `WHODB_SESSION_DSN`
   - `WHODB_SESSION_ENCRYPTION_KEY`
   - `WHODB_SESSION_TTL`
   - `WHODB_SEALOS_BOOTSTRAP_ENABLED`

4. Keep old manual login routes available until Sealos rollout is stable.

**Exit criteria:**

1. Local and staging environments can exercise the new bootstrap path without the old AES URL format.
2. Phase 1 can be feature-flagged on for Sealos only.

## 6. Rollout Gates

Move from one phase to the next only when the previous gate is green.

### Gate A. Backend ready

1. Session repository and crypto tests pass.
2. Bootstrap resolver works in unit tests.
3. Auth middleware supports both token formats.

### Gate B. Frontend ready

1. No DB credentials remain in `sessionStorage`.
2. New bootstrap flow works from a Sealos URL with `resourceName`.
3. One-shot 401 recovery works in tests.

### Gate C. Staging ready

1. Feature flag enabled only in staging.
2. Local URL generator and environment setup are updated.
3. End-to-end bootstrap succeeds against a real Sealos-managed database.

### Gate D. Cleanup ready

1. Upstream no longer sends `credential`.
2. Sealos consumers have switched to `resourceName` and `databaseName`.
3. `VITE_WHODB_AES_KEY` can be removed from docs, scripts, and Docker build args.

## 7. Verification Checklist

Run these checks before calling the migration complete:

### Frontend

```bash
cd dataflow
pnpm run generate
pnpm run typecheck
pnpm run build
pnpm run test
pnpm run lint
```

### Backend

```bash
cd core
go generate ./...
go test ./...
go build ./...
```

### Manual validation

1. Start from a Sealos bootstrap URL that contains `resourceName` and does not contain `credential`.
2. Confirm the frontend stores only opaque session data in `sessionStorage`.
3. Confirm later GraphQL requests send `Bearer session:<token>` rather than base64 credentials.
4. Confirm a forced expired session produces exactly one automatic rebootstrap attempt.
5. Confirm changing Sealos language updates the UI without a full page reload.
6. Confirm manual login still works unchanged.

## 8. Explicit Non-Goals for This Execution Plan

1. Migrating manual login to server-side sessions.
2. Inferring `resourceName` from legacy `host` or `port`.
3. Storing kubeconfig on the server.
4. Changing database plugin behavior or adding shared `dbType` switches outside Sealos-specific code.
