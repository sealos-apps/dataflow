import { create } from 'zustand';
import { graphqlClient } from '@/config/graphql-client';
import { useAuthStore } from '@/stores/useAuthStore';
import type { AuthCredentials } from '@/config/auth-store';
import {
  GetDatabaseDocument,
  type GetDatabaseQuery,
  type GetDatabaseQueryVariables,
  GetSchemaDocument,
  type GetSchemaQuery,
  GetStorageUnitsDocument,
  type GetStorageUnitsQuery,
  type GetStorageUnitsQueryVariables,
} from '@graphql';

export interface Connection {
  id: string;
  name: string;
  type: 'MYSQL' | 'POSTGRES' | 'MONGODB' | 'REDIS' | 'CLICKHOUSE';
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  createdAt: string;
}

export type SelectedItemType = 'connection' | 'database' | 'schema' | 'table' | 'collection' | 'key' | 'redis_keys_list' | null;

export interface SelectedItem {
  type: SelectedItemType;
  id: string;
  name: string;
  parentId?: string;
  connectionId?: string;
  metadata?: any;
}

interface ConnectionState {
  connections: Connection[];
  selectedItem: SelectedItem | null;
  addConnection: (connection: Omit<Connection, 'id' | 'createdAt'>) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  editConnection: (id: string, updates: Partial<Connection>) => void;
  createDatabase: (connectionId: string, databaseName: string, charset: string, collation: string) => Promise<boolean>;
  updateDatabase: (connectionId: string, databaseName: string, newName: string) => Promise<boolean>;
  deleteDatabase: (connectionId: string, databaseName: string) => Promise<boolean>;
  createTable: (connectionId: string, databaseName: string, tableName: string, columns: any[]) => Promise<boolean>;
  updateTable: (connectionId: string, databaseName: string, tableName: string, columns: any[]) => Promise<boolean>;
  deleteTable: (connectionId: string, databaseName: string, tableName: string) => Promise<boolean>;
  selectItem: (item: SelectedItem | null) => void;
  fetchDatabases: (connectionId: string) => Promise<string[]>;
  fetchSchemas: (connectionId: string, database: string) => Promise<string[]>;
  fetchTables: (connectionId: string, database: string, schema?: string) => Promise<string[]>;
}

const connectionTypeMap: Record<string, Connection['type']> = {
  Postgres: 'POSTGRES',
  MySQL: 'MYSQL',
  MongoDB: 'MONGODB',
  Redis: 'REDIS',
  ClickHouse: 'CLICKHOUSE',
};

function deriveConnection(creds: AuthCredentials, createdAt: string): Connection {
  return {
    id: 'sealos',
    name: `${creds.Type} @ ${creds.Hostname}`,
    type: connectionTypeMap[creds.Type] ?? 'POSTGRES',
    host: creds.Hostname,
    port: creds.Advanced?.find((a) => a.Key === 'Port')?.Value ?? '',
    user: creds.Username,
    password: creds.Password,
    database: creds.Database,
    createdAt,
  };
}

const createdAt = new Date().toISOString();

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: [],
  selectedItem: null,

  // Connection management is a no-op in Sealos single-credential mode
  addConnection: () => {},
  removeConnection: () => {},
  updateConnection: () => {},
  editConnection: () => {},

  selectItem: (item) => set({ selectedItem: item }),

  fetchDatabases: async (_connectionId) => {
    const creds = useAuthStore.getState().credentials;
    if (!creds) return [];
    const { data, error } = await graphqlClient.query<GetDatabaseQuery, GetDatabaseQueryVariables>({
      query: GetDatabaseDocument,
      variables: { type: creds.Type },
    });
    if (error) {
      console.error('[useConnectionStore] fetchDatabases failed:', error);
      throw error;
    }
    return data?.Database ?? [];
  },

  fetchSchemas: async (_connectionId, database) => {
    const creds = useAuthStore.getState().credentials;
    if (!creds) return [];
    if (creds.Database !== database) {
      const switched = await useAuthStore.getState().switchDatabase(database);
      if (!switched) return [];
    }
    const { data, error } = await graphqlClient.query<GetSchemaQuery>({
      query: GetSchemaDocument,
    });
    if (error) {
      console.error('[useConnectionStore] fetchSchemas failed:', error);
      throw error;
    }
    return data?.Schema ?? [];
  },

  fetchTables: async (_connectionId, database, schema?) => {
    const creds = useAuthStore.getState().credentials;
    if (!creds) return [];
    if (creds.Database !== database) {
      const switched = await useAuthStore.getState().switchDatabase(database);
      if (!switched) return [];
    }
    const schemaParam = schema ?? database;
    const { data, error } = await graphqlClient.query<GetStorageUnitsQuery, GetStorageUnitsQueryVariables>({
      query: GetStorageUnitsDocument,
      variables: { schema: schemaParam },
    });
    if (error) {
      console.error('[useConnectionStore] fetchTables failed:', error);
      throw error;
    }
    return data?.StorageUnit?.map((u) => u.Name) ?? [];
  },

  createDatabase: async () => {
    console.warn('createDatabase: pending Phase 4 GraphQL wiring');
    return false;
  },
  updateDatabase: async () => {
    console.warn('updateDatabase: pending Phase 4 GraphQL wiring');
    return false;
  },
  deleteDatabase: async () => {
    console.warn('deleteDatabase: pending Phase 4 GraphQL wiring');
    return false;
  },
  createTable: async () => {
    console.warn('createTable: pending Phase 4 GraphQL wiring');
    return false;
  },
  updateTable: async () => {
    console.warn('updateTable: pending Phase 4 GraphQL wiring');
    return false;
  },
  deleteTable: async () => {
    console.warn('deleteTable: pending Phase 4 GraphQL wiring');
    return false;
  },
}));

// Keep `connections` in sync with auth credentials.
// The original ConnectionContext used useMemo(credentials) — this subscription is the Zustand equivalent.
useAuthStore.subscribe((s) => {
  const creds = s.credentials;
  useConnectionStore.setState({
    connections: creds ? [deriveConnection(creds, createdAt)] : [],
  });
});
