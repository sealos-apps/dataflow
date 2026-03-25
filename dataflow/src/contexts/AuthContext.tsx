// dataflow/src/contexts/AuthContext.tsx

/**
 * Authentication context for Sealos dbprovider integration.
 *
 * Lifecycle:
 * 1. Fresh Sealos entry (URL has `dbType` param):
 *    clear old sessionStorage -> decrypt URL credentials -> Login mutation -> persist
 * 2. Page refresh (no URL params):
 *    restore from sessionStorage -> mark authenticated
 * 3. No credentials available:
 *    show error state
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLoginMutation, type LoginCredentials } from '@graphql';
import {
  type AuthCredentials,
  setAuthCredentials,
  clearAuth,
  restoreFromStorage,
  getAuth,
} from '@/src/config/auth-store';
import {
  isSealosContext,
  mapSealosDbType,
  getDefaultDatabase,
  decryptSealosCredential,
} from '@/src/config/sealos';

type AuthStatus = 'loading' | 'authenticated' | 'error';

interface AuthContextValue {
  /** Current authentication status. */
  status: AuthStatus;
  /** Current credentials (null when not authenticated). */
  credentials: AuthCredentials | null;
  /** Error message when status is 'error'. */
  error: string | null;
  /** Switch the active database. Re-runs Login mutation to verify. */
  switchDatabase: (newDatabase: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [credentials, setCredentials] = useState<AuthCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [login] = useLoginMutation();
  // Prevent double-init in React 19 StrictMode (dev only fires effects twice)
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // URL params take precedence over sessionStorage: a fresh Sealos iframe
    // entry must override stale credentials from a previous session.
    const params = new URLSearchParams(window.location.search);

    if (isSealosContext(params)) {
      handleSealosLogin(params, login, setCredentials, setStatus, setError).catch((err) => {
        console.error('[AuthContext] unexpected error:', err);
        setError('Unexpected authentication error');
        setStatus('error');
      });
    } else {
      const restored = restoreFromStorage();
      if (restored) {
        setCredentials(restored);
        setStatus('authenticated');
      } else {
        setError('No credentials available');
        setStatus('error');
      }
    }
  }, [login]);

  const switchDatabase = useCallback(async (newDatabase: string): Promise<boolean> => {
    const auth = getAuth();
    if (!auth || auth.kind !== 'inline') return false;

    const current = auth.credentials;
    const loginInput: LoginCredentials = {
      Type: current.Type,
      Hostname: current.Hostname,
      Username: current.Username,
      Password: current.Password,
      Database: newDatabase,
      Advanced: current.Advanced,
    };

    try {
      const result = await login({ variables: { credentials: loginInput } });
      if (!result.data?.Login.Status) return false;
    } catch {
      return false;
    }

    const updatedCreds: AuthCredentials = { ...current, Database: newDatabase };
    setAuthCredentials(updatedCreds);
    setCredentials(updatedCreds);
    return true;
  }, [login]);

  return (
    <AuthContext.Provider value={{ status, credentials, error, switchDatabase }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Access auth state and actions. Must be used within AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Handle Sealos dbprovider login flow: extract URL params, decrypt credentials,
 * verify via Login mutation, persist to auth-store + React state.
 *
 * Defined outside the component so useEffect dependencies are explicit (no eslint-disable).
 */
async function handleSealosLogin(
  params: URLSearchParams,
  login: ReturnType<typeof useLoginMutation>[0],
  setCredentials: React.Dispatch<React.SetStateAction<AuthCredentials | null>>,
  setStatus: React.Dispatch<React.SetStateAction<AuthStatus>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
): Promise<void> {
  // Clear stale credentials from previous session
  clearAuth();

  const dbType = params.get('dbType')!;
  const credential = params.get('credential')!;
  const host = params.get('host') ?? '';
  const port = params.get('port') ?? '';
  const dbName = params.get('dbName') ?? undefined;

  // Clear URL immediately to hide ciphertext
  window.history.replaceState({}, '', window.location.pathname);

  // Map KubeBlocks type -> WhoDB type
  const whodbType = mapSealosDbType(dbType);
  if (!whodbType) {
    setError(`Unsupported database type: ${dbType}`);
    setStatus('error');
    return;
  }

  // Decrypt AES-encrypted credentials
  const aesKey = import.meta.env.VITE_WHODB_AES_KEY;
  let username: string;
  let password: string;
  try {
    ({ username, password } = await decryptSealosCredential(credential, aesKey));
  } catch (err) {
    console.error('[AuthContext] decryption failed:', err);
    setError('Failed to decrypt credentials');
    setStatus('error');
    return;
  }

  const database = dbName || getDefaultDatabase(dbType);
  const advanced = port ? [{ Key: 'Port', Value: port }] : [];

  // Verify connection via Login mutation
  const loginInput: LoginCredentials = {
    Type: whodbType,
    Hostname: host,
    Username: username,
    Password: password,
    Database: database,
    Advanced: advanced,
  };

  try {
    const result = await login({ variables: { credentials: loginInput } });
    if (!result.data?.Login.Status) {
      setError('Login failed: server rejected credentials');
      setStatus('error');
      return;
    }
  } catch (err) {
    console.error('[AuthContext] login failed:', err);
    setError(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
    setStatus('error');
    return;
  }

  // Persist to auth-store (in-memory + sessionStorage)
  const creds: AuthCredentials = {
    Type: whodbType,
    Hostname: host,
    Username: username,
    Password: password,
    Database: database,
    Advanced: advanced,
  };
  setAuthCredentials(creds);
  setCredentials(creds);
  setStatus('authenticated');
}
