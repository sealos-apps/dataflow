/**
 * Module-level auth credential store.
 *
 * Apollo Client's authLink runs outside the React tree and needs synchronous
 * access to the current credentials. This module holds them. ConnectionContext
 * calls setAuthCredentials() on login and clearAuthCredentials() on logout.
 */

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

export interface SavedProfileCredentials {
  Id: string;
  Type: string;
  Database: string;
}

type CurrentAuth =
  | { kind: 'inline'; credentials: AuthCredentials }
  | { kind: 'profile'; profile: SavedProfileCredentials }
  | null;

let currentAuth: CurrentAuth = null;

/** Set credentials after a successful Login mutation. */
export function setAuthCredentials(credentials: AuthCredentials): void {
  currentAuth = { kind: 'inline', credentials };
}

/** Set credentials after a successful LoginWithProfile mutation. */
export function setProfileAuth(profile: SavedProfileCredentials): void {
  currentAuth = { kind: 'profile', profile };
}

/** Clear credentials on logout. */
export function clearAuth(): void {
  currentAuth = null;
}

/** Read current auth state (used by authLink). */
export function getAuth(): CurrentAuth {
  return currentAuth;
}
