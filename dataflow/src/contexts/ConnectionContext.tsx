import React, { createContext, useContext, useState, useMemo, useRef, ReactNode } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import type { AuthCredentials } from '@/config/auth-store';
import {
  useGetDatabaseLazyQuery,
  useGetSchemaLazyQuery,
  useGetStorageUnitsLazyQuery,
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

interface ConnectionContextType {
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

/** Map WhoDB DatabaseType to DataFlow connection type. */
const connectionTypeMap: Record<string, Connection['type']> = {
  Postgres: 'POSTGRES',
  MySQL: 'MYSQL',
  MongoDB: 'MONGODB',
  Redis: 'REDIS',
  ClickHouse: 'CLICKHOUSE',
};

/** Derive a Connection object from AuthContext credentials. */
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

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const credentials = useAuthStore((s) => s.credentials);
  const switchDatabase = useAuthStore((s) => s.switchDatabase);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const createdAtRef = useRef(new Date().toISOString());

  const [getDatabases] = useGetDatabaseLazyQuery({ fetchPolicy: 'no-cache' });
  const [getSchemas] = useGetSchemaLazyQuery({ fetchPolicy: 'no-cache' });
  const [getStorageUnits] = useGetStorageUnitsLazyQuery({ fetchPolicy: 'no-cache' });

  // Single connection derived from AuthContext credentials
  const connections = useMemo<Connection[]>(() => {
    if (!credentials) return [];
    return [deriveConnection(credentials, createdAtRef.current)];
  }, [credentials]);

  // Connection management is a no-op in Sealos single-credential mode
  const addConnection: ConnectionContextType['addConnection'] = () => {};
  const removeConnection: ConnectionContextType['removeConnection'] = () => {};
  const updateConnection: ConnectionContextType['updateConnection'] = () => {};
  const editConnection: ConnectionContextType['editConnection'] = () => {};

  const selectItem = (item: SelectedItem | null) => {
    setSelectedItem(item);
  };

  const fetchDatabases = async (_connectionId: string): Promise<string[]> => {
    if (!credentials) return [];
    const { data, error } = await getDatabases({
      variables: { type: credentials.Type },
    });
    if (error) {
      console.error('[ConnectionContext] fetchDatabases failed:', error);
      throw error;
    }
    return data?.Database ?? [];
  };

  const fetchSchemas = async (_connectionId: string, database: string): Promise<string[]> => {
    if (!credentials) return [];
    if (credentials.Database !== database) {
      const switched = await switchDatabase(database);
      if (!switched) return [];
    }
    const { data, error } = await getSchemas();
    if (error) {
      console.error('[ConnectionContext] fetchSchemas failed:', error);
      throw error;
    }
    return data?.Schema ?? [];
  };

  const fetchTables = async (_connectionId: string, database: string, schema?: string): Promise<string[]> => {
    if (!credentials) return [];
    if (credentials.Database !== database) {
      const switched = await switchDatabase(database);
      if (!switched) return [];
    }
    const schemaParam = schema ?? database;
    const { data, error } = await getStorageUnits({
      variables: { schema: schemaParam },
    });
    if (error) {
      console.error('[ConnectionContext] fetchTables failed:', error);
      throw error;
    }
    return data?.StorageUnit?.map((u) => u.Name) ?? [];
  };

  const createDatabase = async (_connectionId: string, _databaseName: string, _charset: string, _collation: string): Promise<boolean> => {
    console.warn('createDatabase: pending Phase 4 GraphQL wiring');
    return false;
  };

  const updateDatabase = async (_connectionId: string, _databaseName: string, _newName: string): Promise<boolean> => {
    console.warn('updateDatabase: pending Phase 4 GraphQL wiring');
    return false;
  };

  const deleteDatabase = async (_connectionId: string, _databaseName: string): Promise<boolean> => {
    console.warn('deleteDatabase: pending Phase 4 GraphQL wiring');
    return false;
  };

  const createTable = async (_connectionId: string, _databaseName: string, _tableName: string, _columns: any[]): Promise<boolean> => {
    console.warn('createTable: pending Phase 4 GraphQL wiring');
    return false;
  };

  const updateTable = async (_connectionId: string, _databaseName: string, _tableName: string, _columns: any[]): Promise<boolean> => {
    console.warn('updateTable: pending Phase 4 GraphQL wiring');
    return false;
  };

  const deleteTable = async (_connectionId: string, _databaseName: string, _tableName: string): Promise<boolean> => {
    console.warn('deleteTable: pending Phase 4 GraphQL wiring');
    return false;
  };

  return (
    <ConnectionContext.Provider
      value={{
        connections,
        selectedItem,
        addConnection,
        removeConnection,
        updateConnection,
        editConnection,
        createDatabase,
        updateDatabase,
        deleteDatabase,
        createTable,
        updateTable,
        deleteTable,
        selectItem,
        fetchDatabases,
        fetchSchemas,
        fetchTables,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnections() {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnections must be used within a ConnectionProvider');
  }
  return context;
}
