# WhoDB Frontend Authentication

## Overview

Authentication is cookie-based for web and header-based for desktop (Wails). The frontend stores profiles in Redux (persisted to localStorage), communicates with the backend via three GraphQL mutations (`Login`, `LoginWithProfile`, `Logout`), and handles session recovery transparently through Apollo's error link.

---

## Auth State (`src/store/auth.ts`)

```typescript
type IAuthState = {
  status: "logged-in" | "unauthorized";
  current?: LocalLoginProfile;
  profiles: LocalLoginProfile[];
  sslStatus?: SSLStatus;
  isEmbedded: boolean;
};

type LocalLoginProfile = LoginCredentials & {
  Id: string;                     // Client-generated UUID (or deterministic hash on desktop)
  Saved?: boolean;                // True for server-known profiles (AWS/config/env)
  IsEnvironmentDefined?: boolean; // True for env-var profiles
  SSLConfigured?: boolean;        // True if SSL certs are configured
};
```

### Actions

| Action | Effect |
|---|---|
| `login(credentials)` | Creates/updates profile, sets status to `"logged-in"`, deduplicates by ID |
| `switch({id})` | Switches active profile, clears SSL status |
| `remove({id})` | Removes profile from list, clears current if it matches |
| `logout()` | Clears all profiles, resets status to `"unauthorized"` |
| `setSSLStatus(status)` | Updates SSL configuration status |
| `setLoginProfileDatabase({id, database})` | Updates database field on a specific profile |
| `setEmbedded(bool)` | Sets embedded mode flag |

Auth state is persisted to `localStorage` via Redux Persist (key: `persist:auth`). Health state is **not** persisted.

---

## GraphQL Operations

### Login (credentials-based)

```graphql
mutation Login($credentials: LoginCredentials!) {
  Login(credentials: $credentials) {
    Status
  }
}
```

`LoginCredentials` includes: `Id`, `Type`, `Hostname`, `Database`, `Username`, `Password`, `Advanced` (key-value pairs for port, SSL, etc.).

### LoginWithProfile (saved profile)

```graphql
mutation LoginWithProfile($profile: LoginProfileInput!) {
  LoginWithProfile(profile: $profile) {
    Status
  }
}
```

`LoginProfileInput` includes: `Id`, `Type`, optional `Database`. The server resolves the full credentials from its profile store.

### Logout

```graphql
mutation Logout {
  Logout {
    Status
  }
}
```

### GetProfiles (available profiles)

```graphql
query GetProfiles {
  Profiles {
    Alias
    Id
    Type
    Hostname
    Database
    IsEnvironmentDefined
    Source
    SSLConfigured
  }
}
```

Returns backend-known profiles (from environment variables, config files, AWS discovery).

---

## Login Flow

### Credentials-Based Login

```
User fills form → handleSubmit() validates fields
  → useLoginMutation({ credentials })
  → Backend sets session cookie, returns { Status: true }
  → dispatch(AuthActions.login(credentials))
  → navigate to dashboard
  → Redux Persist saves to localStorage
```

### Profile-Based Login (Saved/Environment-Defined)

```
User selects profile from dropdown
  → useLoginWithProfileMutation({ profile: { Id, Type, Database? } })
  → Backend resolves credentials from profile store, sets session cookie
  → dispatch(AuthActions.login({ ...partialProfile, Saved: true }))
  → navigate to dashboard
```

### Embedded / URL Parameter Login

URL parameters trigger auto-login without user interaction:

| Parameter | Behavior |
|---|---|
| `?credentials=<base64>` | Decodes JSON, prefills form, auto-submits |
| `?resource=<profileId>` | Auto-logs in with saved profile by ID |
| `?login=1` | Auto-submits form with current field values |
| `?locale=<lang>` | Sets UI language |
| `?mode=<light\|dark\|system>` | Sets theme |
| `?os=<linux\|macos\|windows>` | Sets platform override |

Embedded mode hides the password toggle and cleans up URL parameters after successful login.

---

## Logout Flow

```
User navigates to /logout
  → LogoutPage mounts, shows "Logging out..." spinner
  → useLogoutMutation()
  → Backend invalidates session
  → dispatch(AuthActions.logout())  // clears all profiles & state
  → health check service stops
  → redirect to /login
```

---

## Route Protection

`PrivateRoute` in `src/config/routes.tsx`:

```typescript
const PrivateRoute: FC = () => {
  const loggedIn = useAppSelector(state => state.auth.status === "logged-in");
  if (loggedIn) return <Outlet />;
  return <Navigate to="/login" />;
};
```

All routes except `/login` are wrapped in `PrivateRoute`. Unauthenticated users are redirected to `/login`.

---

## Session Recovery (401 Handling)

The Apollo error link (`src/config/graphql-client.ts`) intercepts `401 Unauthorized` responses:

```
GraphQL request fails with 401
  → Check Redux auth state for current profile
  │
  ├─ Profile exists & Saved/EnvDefined:
  │    → fetch("/api/query", LoginWithProfile, { Id, Type })
  │    → Success: reload page
  │    → Failure: redirect to /login with toast
  │
  ├─ Profile exists & local credentials:
  │    → fetch("/api/query", Login, { full credentials })
  │    → Success: reload page
  │    → Failure: redirect to /login with toast
  │
  └─ No profile:
       → redirect to /login with "Session expired" toast
```

Key details:
- Uses raw `fetch()` (not Apollo) to avoid circular error handling
- Sends base64-encoded token in `Authorization` header
- Checks `window.location.pathname` to prevent infinite redirect loops
- Skips auto-login for AWS profiles when cloud providers are disabled

---

## Web vs Desktop Auth

### Web (Browser)

- **Session**: HTTP-only cookie set by backend on login
- **Requests**: `credentials: "include"` on Apollo's httpLink sends cookies automatically
- **Profile IDs**: Random UUIDs (allows duplicate credential sets)

### Desktop (Wails)

- **Problem**: Wails webview doesn't reliably send cookies; SSL certificates in `Advanced` fields can exceed the 4KB cookie size limit
- **Solution**: `Authorization: Bearer <base64>` header on every request
- **Profile IDs**: Deterministic hash of `type::hostname::username::database` (prevents duplicate keyring entries)

Header generation (`src/utils/auth-headers.ts`):

```typescript
// Saved profiles: send minimal payload
{ Id, Database }

// Local profiles: send full credentials
{ Id, Type, Hostname, Username, Password, Database, Advanced, IsProfile: false }
```

Desktop detection (`isDesktopScheme()`):
1. Check for Wails runtime bindings (`window.go.main.App` or `window.go.common.App`)
2. Fall back to protocol check (non-`http:`/`https:` = desktop)

---

## SSL/TLS Configuration

Configured via `SSLConfig` component (`src/components/ssl-config.tsx`), stored in the `Advanced` fields of `LoginCredentials`.

### SSL Modes

| Mode | Certificates Required |
|---|---|
| Disabled | None |
| Required / Require | None (encrypts but no verification) |
| Verify-CA | CA certificate |
| Verify-Identity / Enabled | CA certificate (+ optional server name) |

### Certificate Fields

| Key | Purpose | Required For |
|---|---|---|
| `SSL CA Content` | CA certificate (PEM) | verify-ca, verify-identity |
| `SSL Client Cert Content` | Client certificate (PEM) | Mutual TLS |
| `SSL Client Key Content` | Client private key (PEM) | Mutual TLS |
| `SSL Server Name` | SNI hostname override | verify-identity |

### Input Modes

- **File picker**: Reads PEM file content client-side
- **Paste**: Manual PEM text entry

### Database Limitations

- **MSSQL, Oracle**: Only support system CA (driver limitation) — no custom certificate upload
- **All others**: Support custom CA + client certificates

### Security Warnings

- HTTP warning when not on HTTPS (except localhost)
- Additional warning for private key input over insecure connections

---

## Profile Switching

`useProfileSwitch` hook (`src/hooks/use-profile-switch.ts`):

```
switchProfile(profile, database?)
  → Clear current schema state
  → Saved/EnvDefined? → LoginWithProfile mutation
  → Local?            → Login mutation with credentials
  → On success:
      → Update last-accessed timestamp in localStorage
      → Update profile database if changed
      → dispatch(AuthActions.switch({ id }))
      → Navigate to dashboard
  → On error:
      → Show error toast
```

---

## Health Check Integration

The health check service (`src/services/health-check.ts`) interacts with auth:

- **Starts** when `auth.status` becomes `"logged-in"`
- **Stops** when user logs out
- **Polls** the `GetHealth` GraphQL query with exponential backoff (5s to 60s)
- **On recovery**: Reloads the page if the server/database was previously down
- **Login errors**: Network failures during login set health status to `error`, triggering the `ServerDownOverlay`

Health state is transient (not persisted to localStorage) — resets to `unknown` on page load.

---

## Profile Metadata

### Last Accessed Tracking

Stored directly in localStorage (not Redux):

```
Key:   whodb_profile_last_accessed_<profileId>
Value: ISO 8601 date string
```

Updated via `updateProfileLastAccessed(profileId)` after each successful login or profile switch. Displayed in `ProfileInfoTooltip` with timezone.

### Profile ID Validation

Profile IDs are validated as alphanumeric with spaces, dashes, and underscores, max 64 characters.

---

## Sequence Diagram

```
┌──────┐     ┌──────────┐     ┌─────────┐     ┌─────────┐
│ User │     │ LoginPage│     │  Apollo  │     │ Backend │
└──┬───┘     └────┬─────┘     └────┬────┘     └────┬────┘
   │  Enter creds │                │                │
   │─────────────>│                │                │
   │              │  Login()       │                │
   │              │───────────────>│  POST /api/query
   │              │                │───────────────>│
   │              │                │  Set-Cookie    │
   │              │                │<───────────────│
   │              │  { Status: true }              │
   │              │<───────────────│                │
   │              │                │                │
   │              │ dispatch(login)│                │
   │              │ navigate(/)    │                │
   │<─────────────│                │                │
   │              │                │                │
   │  (later)     │                │                │
   │  Navigate    │                │ GET data       │
   │─────────────────────────────>│───────────────>│
   │              │                │  401           │
   │              │                │<───────────────│
   │              │                │                │
   │              │                │ Auto-retry     │
   │              │                │ Login(creds)   │
   │              │                │───────────────>│
   │              │                │ Set-Cookie     │
   │              │                │<───────────────│
   │              │                │ reload()       │
   │<─────────────────────────────│                │
```
