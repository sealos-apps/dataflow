import { create } from 'zustand';
import {
  LoginDocument,
  type LoginMutation,
  type LoginMutationVariables,
  type LoginCredentials,
} from '@graphql';
import { graphqlClient } from '@/config/graphql-client';
import {
  type AuthCredentials,
  setAuthCredentials,
  clearAuth,
  restoreFromStorage,
  getAuth,
} from '@/config/auth-store';
import {
  isSealosContext,
  mapSealosDbType,
  getDefaultDatabase,
  decryptSealosCredential,
} from '@/config/sealos';

type AuthStatus = 'loading' | 'authenticated' | 'error';

interface AuthState {
  status: AuthStatus;
  credentials: AuthCredentials | null;
  error: string | null;
  /** Call once on app mount to bootstrap auth. */
  initialize: () => Promise<void>;
  /** Switch the active database. Re-runs Login mutation to verify. */
  switchDatabase: (newDatabase: string) => Promise<boolean>;
}

/** Execute a Login mutation via the Apollo client (no hook required). */
async function loginMutate(credentials: LoginCredentials): Promise<boolean> {
  const result = await graphqlClient.mutate<LoginMutation, LoginMutationVariables>({
    mutation: LoginDocument,
    variables: { credentials },
  });
  return result.data?.Login.Status ?? false;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  credentials: null,
  error: null,

  initialize: async () => {
    const params = new URLSearchParams(window.location.search);

    if (isSealosContext(params)) {
      await handleSealosLogin(params, set);
    } else {
      const restored = restoreFromStorage();
      if (restored) {
        set({ credentials: restored, status: 'authenticated' });
      } else {
        set({ error: 'No credentials available', status: 'error' });
      }
    }
  },

  switchDatabase: async (newDatabase) => {
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
      const ok = await loginMutate(loginInput);
      if (!ok) return false;
    } catch {
      return false;
    }

    const updatedCreds: AuthCredentials = { ...current, Database: newDatabase };
    setAuthCredentials(updatedCreds);
    set({ credentials: updatedCreds });
    return true;
  },
}));

async function handleSealosLogin(
  params: URLSearchParams,
  set: (state: Partial<AuthState>) => void,
): Promise<void> {
  clearAuth();

  const dbType = params.get('dbType')!;
  const credential = params.get('credential')!;
  const host = params.get('host') ?? '';
  const port = params.get('port') ?? '';
  const dbName = params.get('dbName') ?? undefined;

  window.history.replaceState({}, '', window.location.pathname);

  const whodbType = mapSealosDbType(dbType);
  if (!whodbType) {
    set({ error: `Unsupported database type: ${dbType}`, status: 'error' });
    return;
  }

  const aesKey = import.meta.env.VITE_WHODB_AES_KEY;
  let username: string;
  let password: string;
  try {
    ({ username, password } = await decryptSealosCredential(credential, aesKey));
  } catch (err) {
    console.error('[useAuthStore] decryption failed:', err);
    set({ error: 'Failed to decrypt credentials', status: 'error' });
    return;
  }

  const database = dbName || getDefaultDatabase(dbType);
  const advanced = port ? [{ Key: 'Port', Value: port }] : [];

  const loginInput: LoginCredentials = {
    Type: whodbType,
    Hostname: host,
    Username: username,
    Password: password,
    Database: database,
    Advanced: advanced,
  };

  try {
    const ok = await loginMutate(loginInput);
    if (!ok) {
      set({ error: 'Login failed: server rejected credentials', status: 'error' });
      return;
    }
  } catch (err) {
    console.error('[useAuthStore] login failed:', err);
    set({ error: `Login failed: ${err instanceof Error ? err.message : String(err)}`, status: 'error' });
    return;
  }

  const creds: AuthCredentials = {
    Type: whodbType,
    Hostname: host,
    Username: username,
    Password: password,
    Database: database,
    Advanced: advanced,
  };
  setAuthCredentials(creds);
  set({ credentials: creds, status: 'authenticated' });
}
