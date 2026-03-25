import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Connection {
    id: string;
    name: string;
    type: 'MYSQL' | 'POSTGRES' | 'MONGODB' | 'REDIS';
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

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load connections from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('dataflow_connections');
        let userConnections: Connection[] = [];

        if (stored) {
            try {
                userConnections = JSON.parse(stored);
            } catch (error) {
                console.error('Failed to parse stored connections:', error);
            }
        }

        setConnections(userConnections);
        setIsLoaded(true);
    }, []);

    // Save connections to localStorage whenever they change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('dataflow_connections', JSON.stringify(connections));
        }
    }, [connections, isLoaded]);

    const addConnection = (connection: Omit<Connection, 'id' | 'createdAt'>) => {
        const newConnection: Connection = {
            ...connection,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };
        setConnections((prev) => [...prev, newConnection]);
    };

    const removeConnection = (id: string) => {
        setConnections((prev) => prev.filter((c) => c.id !== id));
        if (selectedItem?.id === id || selectedItem?.connectionId === id) {
            setSelectedItem(null);
        }
    };

    const updateConnection = (id: string, updates: Partial<Connection>) => {
        setConnections((prev) =>
            prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
        );
    };

    const editConnection = (id: string, updates: Partial<Connection>) => {
        updateConnection(id, updates);
    };

    // TODO: Wire to WhoDB API
    const createDatabase = async (_connectionId: string, _databaseName: string, _charset: string, _collation: string): Promise<boolean> => {
        console.warn('createDatabase: not implemented — pending WhoDB integration');
        return false;
    };

    const updateDatabase = async (_connectionId: string, _databaseName: string, _newName: string): Promise<boolean> => {
        console.warn('updateDatabase: not implemented — pending WhoDB integration');
        return false;
    };

    const deleteDatabase = async (_connectionId: string, _databaseName: string): Promise<boolean> => {
        console.warn('deleteDatabase: not implemented — pending WhoDB integration');
        return false;
    };

    const createTable = async (_connectionId: string, _databaseName: string, _tableName: string, _columns: any[]): Promise<boolean> => {
        console.warn('createTable: not implemented — pending WhoDB integration');
        return false;
    };

    const updateTable = async (_connectionId: string, _databaseName: string, _tableName: string, _columns: any[]): Promise<boolean> => {
        console.warn('updateTable: not implemented — pending WhoDB integration');
        return false;
    };

    const deleteTable = async (_connectionId: string, _databaseName: string, _tableName: string): Promise<boolean> => {
        console.warn('deleteTable: not implemented — pending WhoDB integration');
        return false;
    };

    const selectItem = (item: SelectedItem | null) => {
        setSelectedItem(item);
    };

    // TODO: Wire to WhoDB API
    const fetchDatabases = async (_connectionId: string): Promise<string[]> => {
        console.warn('fetchDatabases: not implemented — pending WhoDB integration');
        return [];
    };

    const fetchSchemas = async (_connectionId: string, _database: string): Promise<string[]> => {
        console.warn('fetchSchemas: not implemented — pending WhoDB integration');
        return [];
    };

    const fetchTables = async (_connectionId: string, _database: string, _schema?: string): Promise<string[]> => {
        console.warn('fetchTables: not implemented — pending WhoDB integration');
        return [];
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
                fetchTables
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
