/**
 * Auth header utilities for WhoDB Core API.
 *
 * All requests to Core carry an opaque session token in the Authorization
 * header. Database overrides are sent separately when needed.
 *
 * Shared auth header helpers for DataFlow requests.
 */

import { getAuthSession } from './auth-store';

/**
 * Builds the Authorization header value for the current session.
 *
 * @param databaseOverride - If provided, overrides the Database field in the
 *   credential payload. This enables per-request database targeting without
 *   mutating global auth state.
 * @returns Header value string, or null if no auth credentials are set.
 */
export function getAuthorizationHeader(databaseOverride?: string): string | null {
  const auth = getAuthSession();
  if (!auth) return null;
  return `Bearer session:${auth.sessionToken}`;
}

/**
 * Merges the Authorization header into an existing headers object.
 *
 * @param headers - Existing headers to merge into.
 * @param databaseOverride - If provided, overrides the Database field in the
 *   credential payload for this specific request.
 */
export function addAuthHeader(
  headers: Record<string, string> = {},
  databaseOverride?: string,
): Record<string, string> {
  const authHeader = getAuthorizationHeader(databaseOverride);
  if (!authHeader) {
    return headers;
  }

  const nextHeaders: Record<string, string> = {
    ...headers,
    Authorization: authHeader,
  };
  if (databaseOverride) {
    nextHeaders['X-WhoDB-Database'] = databaseOverride;
  }

  return nextHeaders;
}
