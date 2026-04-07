// dataflow/src/config/auth-store.ts

/**
 * Module-level auth credential store with sessionStorage backing.
 *
 * Apollo Client's authLink runs outside the React tree and needs synchronous
 * access to the current credentials. This module holds them in memory and
 * mirrors writes to sessionStorage for cross-refresh persistence.
 *
 * useAuthStore.initialize() controls when to restore from storage (not auto-restored on load).
 */

const STORAGE_KEY = 'dataflow_auth';

export interface AuthCredentials {
  /** Connection ID (assigned by Core on login) */
  Id?: string;
  /** WhoDB DatabaseType enum value (e.g. "Postgres", "MySQL") */
  Type: string;
  Hostname: string;
  Username: string;
  Password: string;
  Database: string;
  Advanced?: Array<{ Key: string; Value: string }>;
}

let currentAuth: AuthCredentials | null = null;

/** Set credentials after a successful Login mutation. Persists to sessionStorage. */
export function setAuthCredentials(credentials: AuthCredentials): void {
  currentAuth = credentials;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

/** Clear credentials. Removes from sessionStorage. */
export function clearAuth(): void {
  currentAuth = null;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Read current auth state (used by authLink). */
export function getAuth(): AuthCredentials | null {
  return currentAuth;
}

/**
 * Restore credentials from sessionStorage into in-memory store.
 * Called by useAuthStore.initialize() on mount when no Sealos URL params are present.
 * Returns the restored credentials, or null if none were found.
 */
export function restoreFromStorage(): AuthCredentials | null {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const credentials: AuthCredentials = JSON.parse(stored);
    currentAuth = credentials;
    return credentials;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
