import { create } from 'zustand';
import { graphqlClient } from '@/config/graphql-client';
import { useAuthStore } from '@/stores/useAuthStore';
import type { AuthCredentials } from '@/config/auth-store';
import { getAuth } from '@/config/auth-store';
import {
  GetDatabaseDocument,
  type GetDatabaseQuery,
  type GetDatabaseQueryVariables,
  GetDatabaseMetadataDocument,
  type GetDatabaseMetadataQuery,
  GetSchemaDocument,
  type GetSchemaQuery,
  GetStorageUnitsDocument,
  type GetStorageUnitsQuery,
  type GetStorageUnitsQueryVariables,
  ExecuteConfirmedSqlDocument,
  type ExecuteConfirmedSqlMutation,
  type ExecuteConfirmedSqlMutationVariables,
  AddStorageUnitDocument,
  type AddStorageUnitMutation,
  type AddStorageUnitMutationVariables,
  type RecordInput,
  RawExecuteDocument,
  type RawExecuteQuery,
  type RawExecuteQueryVariables,
} from '@graphql';
import type { SqlDialect } from '@/utils/ddl-sql';
import {
  createDatabaseSQL, dropDatabaseSQL, renameDatabaseSQL,
  dropTableSQL, truncateTableSQL, deleteAllRowsSQL,
  renameTableSQL, copyTableStructureSQL, copyTableWithDataSQL,
} from '@/utils/ddl-sql';

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

export type SelectedItemType = 'connection' | 'database' | 'schema' | 'table' | 'view' | 'collection' | 'key' | 'redis_keys_list' | null;

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
  tableRefreshKey: number;
  triggerTableRefresh: () => void;
  collectionRefreshKey: number;
  triggerCollectionRefresh: () => void;
  createDatabase: (databaseName: string) => Promise<DDLResult>;
  renameDatabase: (oldName: string, newName: string) => Promise<DDLResult>;
  deleteDatabase: (databaseName: string) => Promise<DDLResult>;
  createTable: (databaseName: string, schema: string, tableName: string, fields: RecordInput[]) => Promise<DDLResult>;
  renameTable: (databaseName: string, schema: string | undefined, oldName: string, newName: string) => Promise<DDLResult>;
  deleteTable: (databaseName: string, schema: string | undefined, tableName: string) => Promise<DDLResult>;
  clearTableData: (databaseName: string, schema: string | undefined, tableName: string, mode: 'truncate' | 'delete') => Promise<DDLResult>;
  copyTable: (databaseName: string, schema: string | undefined, sourceTable: string, targetTable: string, copyData: boolean) => Promise<DDLResult>;
  dropCollection: (databaseName: string, collectionName: string) => Promise<DDLResult>;
  selectItem: (item: SelectedItem | null) => void;
  fetchDatabases: (connectionId: string) => Promise<string[]>;
  fetchSchemas: (connectionId: string, database: string) => Promise<string[]>;
  fetchTables: (connectionId: string, database: string, schema?: string) => Promise<{ name: string; type: string }[]>;
  systemSchemas: string[];
  /** Node IDs where system objects are visible */
  showSystemObjectsFor: Set<string>;
  toggleSystemObjects: (nodeId: string) => void;
  fetchSystemSchemas: () => Promise<void>;
}

export interface DDLResult {
  success: boolean;
  message?: string;
}

/** Map auth store Type (e.g. "Postgres") to SqlDialect. */
function getDialect(): SqlDialect {
  const dbType = getAuth()?.Type;
  const map: Record<string, SqlDialect> = {
    Postgres: 'POSTGRES', MySQL: 'MYSQL',
    SQLite3: 'SQLITE3', ClickHouse: 'CLICKHOUSE',
  };
  return map[dbType ?? ''] ?? 'POSTGRES';
}

/** Execute a DDL statement via ExecuteConfirmedSQL and return a result. */
async function executeDDL(sql: string, database?: string): Promise<DDLResult> {
  try {
    const { data, errors } = await graphqlClient.mutate<
      ExecuteConfirmedSqlMutation,
      ExecuteConfirmedSqlMutationVariables
    >({
      mutation: ExecuteConfirmedSqlDocument,
      variables: { query: sql, operationType: 'DDL' },
      context: database ? { database } : undefined,
    });
    if (errors?.length) {
      return { success: false, message: errors[0].message };
    }
    const msg = data?.ExecuteConfirmedSQL;
    if (msg?.Type === 'error') {
      return { success: false, message: msg.Text };
    }
    return { success: true, message: msg?.Text };
  } catch (err: any) {
    return { success: false, message: err.message ?? 'Unknown error' };
  }
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
  tableRefreshKey: 0,
  /** Increment table refresh key to trigger re-fetch in TableDetailView. */
  triggerTableRefresh: () => set((s) => ({ tableRefreshKey: s.tableRefreshKey + 1 })),
  collectionRefreshKey: 0,
  /** Increment collection refresh key to trigger re-fetch in CollectionViewProvider. */
  triggerCollectionRefresh: () => set((s) => ({ collectionRefreshKey: s.collectionRefreshKey + 1 })),
  systemSchemas: [],
  showSystemObjectsFor: new Set<string>(),
  toggleSystemObjects: (nodeId) => set((state) => {
    const next = new Set(state.showSystemObjectsFor);
    if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
    return { showSystemObjectsFor: next };
  }),

  fetchSystemSchemas: async () => {
    const { data } = await graphqlClient.query<GetDatabaseMetadataQuery>({
      query: GetDatabaseMetadataDocument,
    });
    set({ systemSchemas: data?.DatabaseMetadata?.systemSchemas ?? [] });
  },

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
    const { data, error } = await graphqlClient.query<GetSchemaQuery>({
      query: GetSchemaDocument,
      context: { database },
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
    const schemaParam = schema ?? database;
    const { data, error } = await graphqlClient.query<GetStorageUnitsQuery, GetStorageUnitsQueryVariables>({
      query: GetStorageUnitsDocument,
      variables: { schema: schemaParam },
      context: { database },
    });
    if (error) {
      console.error('[useConnectionStore] fetchTables failed:', error);
      throw error;
    }
    return data?.StorageUnit?.map((u) => ({
      name: u.Name,
      type: u.Attributes.find(a => a.Key === "Type")?.Value ?? "table",
    })) ?? [];
  },

  createDatabase: async (databaseName) => {
    const sql = createDatabaseSQL(getDialect(), databaseName);
    return executeDDL(sql);
  },

  renameDatabase: async (oldName, newName) => {
    const sql = renameDatabaseSQL(getDialect(), oldName, newName);
    if (!sql) {
      return { success: false, message: 'Rename database is not supported for this database type' };
    }
    return executeDDL(sql);
  },

  deleteDatabase: async (databaseName) => {
    const sql = dropDatabaseSQL(getDialect(), databaseName);
    return executeDDL(sql);
  },

  createTable: async (databaseName, schema, tableName, fields) => {
    try {
      const { data, errors } = await graphqlClient.mutate<
        AddStorageUnitMutation,
        AddStorageUnitMutationVariables
      >({
        mutation: AddStorageUnitDocument,
        variables: { schema, storageUnit: tableName, fields },
        context: { database: databaseName },
      });
      if (errors?.length) {
        return { success: false, message: errors[0].message };
      }
      return { success: data?.AddStorageUnit.Status ?? false };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Unknown error' };
    }
  },

  renameTable: async (databaseName, schema, oldName, newName) => {
    const sql = renameTableSQL(getDialect(), oldName, newName, schema);
    return executeDDL(sql, databaseName);
  },

  deleteTable: async (databaseName, schema, tableName) => {
    const sql = dropTableSQL(getDialect(), tableName, schema);
    return executeDDL(sql, databaseName);
  },

  clearTableData: async (databaseName, schema, tableName, mode) => {
    const dialect = getDialect();
    const sql = mode === 'truncate'
      ? truncateTableSQL(dialect, tableName, schema)
      : deleteAllRowsSQL(dialect, tableName, schema);
    return executeDDL(sql, databaseName);
  },

  copyTable: async (databaseName, schema, sourceTable, targetTable, copyData) => {
    const dialect = getDialect();
    const sql = copyData
      ? copyTableWithDataSQL(dialect, sourceTable, targetTable, schema)
      : copyTableStructureSQL(dialect, sourceTable, targetTable, schema);
    const statements = sql.split('\n').filter(s => s.trim());
    for (const stmt of statements) {
      const result = await executeDDL(stmt, databaseName);
      if (!result.success) return result;
    }
    return { success: true };
  },

  /** Drop a MongoDB collection via RawExecute. The database is determined by the active session. */
  dropCollection: async (databaseName, collectionName) => {
    try {
      const { data, errors } = await graphqlClient.query<
        RawExecuteQuery,
        RawExecuteQueryVariables
      >({
        query: RawExecuteDocument,
        variables: { query: `db.${collectionName}.drop()` },
        fetchPolicy: 'no-cache',
      });
      if (errors?.length) {
        return { success: false, message: errors[0].message };
      }
      const acknowledged = data?.RawExecute?.Rows?.[0]?.[0];
      return { success: acknowledged === 'true' };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Unknown error' };
    }
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
