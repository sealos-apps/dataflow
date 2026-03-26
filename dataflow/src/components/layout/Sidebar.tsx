
import React, { useState, useEffect } from "react";
import {
    Database,
    Plus,
    PlusCircle,
    ChevronRight,
    ChevronDown,
    Loader2,
    LayoutGrid,
    Table,
    Files,
    Key,
    RefreshCw,
    Unplug,
    Edit2,
    Trash2,
    Download,
    Upload,
    Terminal,
    List
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionStore, type Connection } from "@/stores/useConnectionStore";
import { ContextMenu } from "../ui/ContextMenu";
import { ConfirmationModal } from "../ui/ConfirmationModal";
import { AlertModal } from "../ui/AlertModal";
import { ConnectionModal } from "../connection/ConnectionModal";
import { DeleteConnectionModal } from "../connection/DeleteConnectionModal";
import { CreateDatabaseModal } from "../database/CreateDatabaseModal";
import { CreateTableModal } from "../database/CreateTableModal";
import { EditDatabaseModal } from "../database/EditDatabaseModal";
import { DeleteDatabaseModal } from "../database/DeleteDatabaseModal";
import { EditTableModal } from "../database/EditTableModal";
import { DeleteTableModal } from "../database/DeleteTableModal";

import { ExportDataModal } from "../database/ExportDataModal";
import { ExportDatabaseModal } from "../database/ExportDatabaseModal";
import { ImportDatabaseModal } from "../database/ImportDatabaseModal";
import { ImportDataModal } from "../database/ImportDataModal";
import { EmptyTableModal } from "@/components/database/EmptyTableModal";
import { TruncateTableModal } from "@/components/database/TruncateTableModal";
import { CopyTableModal } from "@/components/database/CopyTableModal";
import { Eraser, Scissors, Copy } from "lucide-react";

import { ExportCollectionModal } from "@/components/database/ExportCollectionModal";
import { ImportCollectionModal } from "@/components/database/ImportCollectionModal";
import { useTabStore } from "@/stores/useTabStore";

interface SidebarProps {
    onRefreshCollection?: () => void;
}

const DB_ICONS: Record<string, string> = {
    MYSQL: "/images/mysql.svg",
    POSTGRES: "/images/postgresql.svg",
    MONGODB: "/images/mongodb.svg",
    REDIS: "/images/redis.svg"
};

export function Sidebar({ onRefreshCollection }: SidebarProps) {
    const { connections, selectedItem, selectItem, fetchDatabases, fetchSchemas, fetchTables } = useConnectionStore();
    const { openTab } = useTabStore();
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [treeData, setTreeData] = useState<Record<string, any[]>>({});
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
    const [isRestoring, setIsRestoring] = useState(true);

    // Save expanded items to localStorage
    useEffect(() => {
        if (!isRestoring) {
            localStorage.setItem('sidebar_expanded_items', JSON.stringify(Array.from(expandedItems)));
        }
    }, [expandedItems, isRestoring]);

    // Restore expanded items and re-fetch data
    useEffect(() => {
        const restoreState = async () => {
            const stored = localStorage.getItem('sidebar_expanded_items');
            if (stored && connections.length > 0) {
                try {
                    const expandedIds = new Set<string>(JSON.parse(stored));
                    setExpandedItems(expandedIds);

                    // Helper function to recursively fetch and restore tree data
                    const fetchRecursively = async (items: any[], parentTreeData: Record<string, any[]>) => {
                        const newTreeData = { ...parentTreeData };

                        for (const item of items) {
                            if (!expandedIds.has(item.id)) continue;

                            setIsLoading(prev => ({ ...prev, [item.id]: true }));

                            try {
                                let children: any[] = [];

                                if (item.type === 'connection') {
                                    const dbs = await fetchDatabases(item.id);
                                    children = dbs.map(db => ({
                                        id: `${item.id}-${db}`,
                                        name: db,
                                        type: 'database',
                                        parentId: item.id,
                                        connectionId: item.id,
                                        metadata: { database: db }
                                    }));
                                } else if (item.type === 'database') {
                                    const conn = connections.find(c => c.id === item.connectionId);
                                    if (conn?.type === 'POSTGRES') {
                                        const schemas = await fetchSchemas(item.connectionId, item.name);
                                        children = schemas.map(schema => ({
                                            id: `${item.id}-${schema}`,
                                            name: schema,
                                            type: 'schema',
                                            parentId: item.id,
                                            connectionId: item.connectionId,
                                            metadata: { database: item.name, schema }
                                        }));
                                    } else if (conn?.type === 'REDIS') {
                                        // For Redis, show "All Data" node
                                        children = [{
                                            id: `${item.id}-all-keys`,
                                            name: '全部数据',
                                            type: 'redis_keys_list',
                                            parentId: item.id,
                                            connectionId: item.connectionId,
                                            metadata: { database: item.name }
                                        }];
                                    } else {
                                        const tables = await fetchTables(item.connectionId, item.name);
                                        children = tables.map(table => ({
                                            id: `${item.id}-${table}`,
                                            name: table,
                                            type: conn?.type === 'MONGODB' ? 'collection' : 'table',
                                            parentId: item.id,
                                            connectionId: item.connectionId,
                                            metadata: { database: item.name, table }
                                        }));
                                    }
                                } else if (item.type === 'schema') {
                                    const tables = await fetchTables(item.connectionId, item.metadata.database, item.name);
                                    children = tables.map(table => ({
                                        id: `${item.id}-${table}`,
                                        name: table,
                                        type: 'table',
                                        parentId: item.id,
                                        connectionId: item.connectionId,
                                        metadata: { database: item.metadata.database, schema: item.name, table }
                                    }));
                                }

                                newTreeData[item.id] = children;
                                setTreeData(prev => ({ ...prev, [item.id]: children }));

                                // Recursively fetch children if they are expanded
                                if (children.length > 0) {
                                    await fetchRecursively(children, newTreeData);
                                }
                            } catch (error) {
                                console.error('Failed to restore node:', item.id, error);
                            } finally {
                                setIsLoading(prev => ({ ...prev, [item.id]: false }));
                            }
                        }
                    };

                    // Start with connections
                    const connectionItems = connections.map(c => ({ ...c, type: 'connection' }));
                    await fetchRecursively(connectionItems, {});

                } catch (e) {
                    console.error("Failed to restore expanded items", e);
                }
            }
            setIsRestoring(false);
        };

        if (connections.length > 0) {
            restoreState();
        }
    }, [connections.length]); // Dependencies: only run when connections are first loaded

    // Modal states
    const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
    const [editingConnection, setEditingConnection] = useState<Connection | undefined>(undefined);
    const [deletingConnection, setDeletingConnection] = useState<Connection | undefined>(undefined);
    const [creatingDbConnectionId, setCreatingDbConnectionId] = useState<string | null>(null);
    const [creatingTableDb, setCreatingTableDb] = useState<{ connectionId: string; databaseName: string; schema?: string } | null>(null);

    // New Modal States
    // New Modal States
    const [editingDatabase, setEditingDatabase] = useState<{ connectionId: string; databaseName: string } | null>(null);
    const [deletingDatabase, setDeletingDatabase] = useState<{ connectionId: string; databaseName: string } | null>(null);
    const [editingTable, setEditingTable] = useState<{ connectionId: string; databaseName: string; schema?: string; tableName: string } | null>(null);
    const [deletingTable, setDeletingTable] = useState<{ connectionId: string; databaseName: string; schema?: string; tableName: string } | null>(null);
    const [exportDataParams, setExportDataParams] = useState<{
        connectionId: string;
        databaseName: string;
        schema: string | null;
        tableName: string;
    } | null>(null);

    const [exportDatabaseParams, setExportDatabaseParams] = useState<{
        connectionId: string;
        databaseName: string;
    } | null>(null);

    const [importDatabaseParams, setImportDatabaseParams] = useState<{
        connectionId: string;
        databaseName: string;
    } | null>(null);

    const [importDataParams, setImportDataParams] = useState<{ connectionId: string, databaseName: string, schema?: string | null, tableName?: string } | null>(null);
    const [emptyingTable, setEmptyingTable] = useState<{ connectionId: string; databaseName: string; schema?: string; tableName: string } | null>(null);
    const [truncatingTable, setTruncatingTable] = useState<{ connectionId: string; databaseName: string; schema?: string; tableName: string } | null>(null);
    const [copyingTable, setCopyingTable] = useState<{ connectionId: string; databaseName: string; schema?: string; tableName: string } | null>(null);

    // MongoDB Collection Modals
    const [exportCollectionModal, setExportCollectionModal] = useState<{ isOpen: boolean; connectionId: string; databaseName: string; collectionName: string }>({ isOpen: false, connectionId: '', databaseName: '', collectionName: '' });
    const [importCollectionParams, setImportCollectionParams] = useState<{
        connectionId: string;
        databaseName: string;
        collectionName: string;
    } | null>(null);

    const [dropCollectionParams, setDropCollectionParams] = useState<{
        connectionId: string;
        databaseName: string;
        collectionName: string;
    } | null>(null);

    // Alert Modal State for showing operation results
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({ isOpen: false, title: '', message: '', type: 'info' });

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        item: any;
        type: 'connection' | 'database' | 'schema' | 'table' | 'collection';
    } | null>(null);

    const fetchNodeChildren = async (item: any) => {
        setIsLoading(prev => ({ ...prev, [item.id]: true }));
        try {
            let children: any[] = [];
            if (item.type === 'connection') {
                const conn = connections.find(c => c.id === item.id);
                const dbs = await fetchDatabases(item.id);
                children = dbs.map(db => ({
                    id: `${item.id}-${db}`,
                    name: db,
                    type: 'database',
                    parentId: item.id,
                    connectionId: item.id,
                    metadata: { database: db }
                }));

            } else if (item.type === 'database') {
                // For PostgreSQL, fetch schemas first
                const conn = connections.find(c => c.id === item.connectionId);
                if (conn?.type === 'POSTGRES') {
                    const schemas = await fetchSchemas(item.connectionId, item.name);
                    children = schemas.map(schema => ({
                        id: `${item.id}-${schema}`,
                        name: schema,
                        type: 'schema',
                        parentId: item.id,
                        connectionId: item.connectionId,
                        metadata: { database: item.name, schema }
                    }));
                } else if (conn?.type === 'REDIS') {
                    // For Redis, show "All Data" node instead of fetching keys directly
                    console.log('[Sidebar] Redis database expanded, creating All Data node for:', item.name);
                    children = [{
                        id: `${item.id}-all-keys`,
                        name: '全部数据',
                        type: 'redis_keys_list',
                        parentId: item.id,
                        connectionId: item.connectionId,
                        metadata: { database: item.name }
                    }];
                    console.log('[Sidebar] Created children:', children);
                } else {
                    // For MySQL, fetch tables directly
                    const tables = await fetchTables(item.connectionId, item.name);
                    children = tables.map(table => ({
                        id: `${item.id}-${table}`,
                        name: table,
                        type: conn?.type === 'MONGODB' ? 'collection' : 'table',
                        parentId: item.id,
                        connectionId: item.connectionId,
                        metadata: { database: item.name, table }
                    }));
                }
            } else if (item.type === 'schema') {
                // For PostgreSQL schema, fetch tables
                const tables = await fetchTables(item.connectionId, item.metadata.database, item.name);
                children = tables.map(table => ({
                    id: `${item.id}-${table}`,
                    name: table,
                    type: 'table',
                    parentId: item.id,
                    connectionId: item.connectionId,
                    metadata: { database: item.metadata.database, schema: item.name, table }
                }));
            }
            setTreeData(prev => ({ ...prev, [item.id]: children }));
        } catch (error: any) {
            console.error('Failed to fetch children:', error);
            // Show alert if connection fails
            if (item.type === 'connection') {
                setAlertState({
                    isOpen: true,
                    title: 'Connection Failed',
                    message: error.message || 'Failed to connect to database. Please check your connection settings.',
                    type: 'error'
                });
            }
        } finally {
            setIsLoading(prev => ({ ...prev, [item.id]: false }));
        }
    };

    const refreshNode = async (item: any) => {
        // Clear current data
        setTreeData(prev => {
            const newData = { ...prev };
            delete newData[item.id];
            return newData;
        });

        // If expanded, re-fetch immediately
        if (expandedItems.has(item.id)) {
            await fetchNodeChildren(item);
        }
    };

    const toggleItem = async (item: any) => {
        const newExpanded = new Set(expandedItems);
        const isExpanded = newExpanded.has(item.id);

        if (isExpanded) {
            newExpanded.delete(item.id);
        } else {
            newExpanded.add(item.id);
            // Fetch children if not already loaded, OR if it's a database (always refresh)
            const shouldFetch = !treeData[item.id] || item.type === 'database';
            if (shouldFetch) {
                await fetchNodeChildren(item);
            }
        }
        setExpandedItems(newExpanded);
    };

    const handleItemClick = (item: any) => {
        console.log('[Sidebar] 🖱️ Item clicked:', { type: item.type, name: item.name });
        selectItem(item);

        // Toggle expansion for folder-like items
        if (['connection', 'database', 'schema'].includes(item.type)) {
            toggleItem(item);
        }

        if (item.type === 'table') {
            console.log('[Sidebar] 📄 Opening table tab');
            openTab({
                type: 'table',
                title: `${item.name}`,
                connectionId: item.connectionId,
                databaseName: item.metadata?.database,
                schemaName: item.metadata?.schema,
                tableName: item.name,
            });
        } else if (item.type === 'collection') {
            console.log('[Sidebar] 📄 Opening collection tab');
            openTab({
                type: 'collection',
                title: `${item.name}`,
                connectionId: item.connectionId,
                databaseName: item.metadata?.database,
                collectionName: item.name,
            });
            onRefreshCollection?.();
        } else if (item.type === 'redis_keys_list') {
            console.log('[Sidebar] 📄 Opening redis keys list tab');
            openTab({
                type: 'redis_keys_list',
                title: `${item.metadata.database} Keys`,
                connectionId: item.connectionId,
                databaseName: item.metadata.database
            });
        }
    };

    const handleContextMenu = (e: React.MouseEvent, item: any, type: 'connection' | 'database' | 'schema' | 'table' | 'collection') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            item,
            type,
        });
    };

    const handleContextMenuAction = (action: string) => {
        if (!contextMenu) return;
        const { item, type } = contextMenu;

        switch (action) {
            case 'new_query':
                const queryConnectionId = item.connectionId || item.id;
                const queryDatabaseName = item.metadata?.database || (type === 'database' ? item.name : undefined);
                const querySchemaName = item.metadata?.schema;
                const queryTitle = queryDatabaseName
                    ? `Query - ${queryDatabaseName}`
                    : `Query - ${connections.find(c => c.id === queryConnectionId)?.name || 'Untitled'}`;

                openTab({
                    type: 'query',
                    title: queryTitle,
                    connectionId: queryConnectionId,
                    databaseName: queryDatabaseName,
                    schemaName: querySchemaName,
                });
                break;
            case 'edit_connection':
                setEditingConnection(item);
                setIsConnectionModalOpen(true);
                break;
            case 'delete_connection':
                setDeletingConnection(item);
                break;
            case 'new_database':
                setCreatingDbConnectionId(item.id);
                break;
            case 'new_table':
                setCreatingTableDb({
                    connectionId: item.connectionId,
                    databaseName: type === 'database' ? item.name : item.metadata.database,
                    schema: type === 'schema' ? item.name : undefined
                });
                break;
            case 'edit_database':
                setEditingDatabase({
                    connectionId: item.connectionId,
                    databaseName: item.name
                });
                break;
            case 'delete_database':
                setDeletingDatabase({
                    connectionId: item.connectionId,
                    databaseName: item.name
                });
                break;
            case 'edit_table':
                setEditingTable({
                    connectionId: item.connectionId,
                    databaseName: item.metadata.database,
                    schema: item.metadata?.schema,
                    tableName: item.name
                });
                break;
            case 'delete_table':
                setDeletingTable({
                    connectionId: item.connectionId,
                    databaseName: item.metadata.database,
                    schema: item.metadata?.schema,
                    tableName: item.name
                });
                break;
            case 'drop_collection':
                handleDropCollection(item);
                break;
            case 'export_data':
                setExportDataParams({
                    connectionId: item.connectionId,
                    databaseName: item.metadata.database,
                    schema: item.metadata.schema || null,
                    tableName: item.name
                });
                break;
            case 'export_database':
                setExportDatabaseParams({
                    connectionId: item.connectionId,
                    databaseName: item.name
                });
                break;
            case 'import_database':
                setImportDatabaseParams({
                    connectionId: type === 'connection' ? item.id : item.connectionId,
                    databaseName: type === 'connection' ? '' : item.name
                });
                break;
            case 'import_data':
                if (type === 'database') {
                    // For database level import
                    const conn = connections.find(c => c.id === item.connectionId);
                    const isPostgres = conn?.type === 'POSTGRES';

                    setImportDataParams({
                        connectionId: item.connectionId,
                        databaseName: item.name,
                        schema: isPostgres ? 'public' : undefined, // Default to public for PG
                        tableName: undefined // No table selected yet
                    });
                } else {
                    // For table level import
                    setImportDataParams({
                        connectionId: item.connectionId,
                        databaseName: item.metadata.database,
                        schema: item.metadata.schema,
                        tableName: item.name
                    });
                }
                break;
            case 'empty_table':
                setEmptyingTable({
                    connectionId: item.connectionId,
                    databaseName: item.metadata.database,
                    schema: item.metadata?.schema,
                    tableName: item.name
                });
                break;
            case 'truncate_table':
                setTruncatingTable({
                    connectionId: item.connectionId,
                    databaseName: item.metadata.database,
                    schema: item.metadata?.schema,
                    tableName: item.name
                });
                break;
            case 'copy_table':
                setCopyingTable({
                    connectionId: item.connectionId,
                    databaseName: item.metadata.database,
                    schema: item.metadata?.schema,
                    tableName: item.name
                });
                break;
            case 'refresh':
                {
                    const itemWithCorrectType = { ...item, type };
                    // If already expanded, just re-fetch to update the list
                    if (expandedItems.has(item.id)) {
                        fetchNodeChildren(itemWithCorrectType);
                    } else {
                        // If not expanded, expand it (which triggers fetch)
                        toggleItem(itemWithCorrectType);
                    }
                }
                break;
            case 'disconnect':
                // Collapse item
                const newExpanded = new Set(expandedItems);
                newExpanded.delete(item.id);
                setExpandedItems(newExpanded);
                break;
        }
        setContextMenu(null);
    };

    const handleExportCollection = () => {
        if (!contextMenu) return;
        const { item } = contextMenu;

        setExportCollectionModal({
            isOpen: true,
            connectionId: item.connectionId,
            databaseName: item.metadata.database,
            collectionName: item.name
        });
        setContextMenu(null);
    };

    const handleImportCollection = () => {
        if (!contextMenu || contextMenu.type !== 'collection') return;
        setContextMenu(null);
        setImportCollectionParams({
            connectionId: contextMenu.item.connectionId,
            databaseName: contextMenu.item.metadata.database,
            collectionName: contextMenu.item.name
        });
    };

    const handleDropCollection = (item: any) => {
        setDropCollectionParams({
            connectionId: item.connectionId,
            databaseName: item.metadata.database,
            collectionName: item.name
        });
    };

    const confirmDropCollection = async () => {
        if (!dropCollectionParams) return;

        // Get connection details
        const conn = connections.find(c => c.id === dropCollectionParams.connectionId);
        if (!conn) {
            console.error('Connection not found');
            return;
        }

        try {
            const response = await fetch('/api/connections/drop-collection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: conn.type.toLowerCase(),
                    host: conn.host,
                    port: conn.port,
                    user: conn.user,
                    password: conn.password,
                    databaseName: dropCollectionParams.databaseName,
                    collectionName: dropCollectionParams.collectionName,
                }),
            });

            const result = await response.json();
            if (result.success) {
                // Show success alert
                setAlertState({
                    isOpen: true,
                    title: 'Success',
                    message: `Collection "${dropCollectionParams.collectionName}" dropped successfully.`,
                    type: 'success'
                });

                // Clear the selected item to show empty detail view
                selectItem(null);

                // Refresh collection list
                const connectionId = dropCollectionParams.connectionId;
                const databaseName = dropCollectionParams.databaseName;
                const dbNodeId = `${connectionId}-${databaseName}`;

                setIsLoading(prev => ({ ...prev, [dbNodeId]: true }));
                try {
                    const collections = await fetchTables(connectionId, databaseName);
                    const children = collections.map(col => ({
                        id: `${connectionId}-${databaseName}-${col}`,
                        name: col,
                        type: 'collection',
                        parentId: dbNodeId,
                        connectionId,
                        metadata: { database: databaseName }
                    }));
                    setTreeData(prev => ({
                        ...prev,
                        [dbNodeId]: children
                    }));
                } finally {
                    setIsLoading(prev => ({ ...prev, [dbNodeId]: false }));
                }
            } else {
                setAlertState({
                    isOpen: true,
                    title: 'Error',
                    message: `Failed to drop collection: ${result.error}`,
                    type: 'error'
                });
            }
        } catch (error: any) {
            setAlertState({
                isOpen: true,
                title: 'Error',
                message: `An error occurred: ${error.message}`,
                type: 'error'
            });
        } finally {
            setDropCollectionParams(null);
        }
    };
    const handleCreateDatabase = () => {
        setEditingConnection(undefined);
        setIsConnectionModalOpen(true);
    };

    const handleNewConnection = () => {
        setEditingConnection(undefined);
        setIsConnectionModalOpen(true);
    };

    return (
        <div className="flex h-full w-64 flex-col border-r bg-background">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b h-14 shrink-0">
                <h2 className="font-semibold text-sm">数据库连接</h2>
                <button
                    onClick={handleNewConnection}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="新建连接"
                >
                    <PlusCircle className="h-5 w-5" />
                </button>
            </div>

            {/* Connection Tree */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
                {connections.map((conn) => (
                    <div key={conn.id}>
                        <div
                            className={cn(
                                "group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors cursor-pointer select-none",
                                selectedItem?.id === conn.id
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            onClick={() => handleItemClick({ ...conn, type: 'connection' })}
                            onContextMenu={(e) => handleContextMenu(e, conn, 'connection')}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItem({ ...conn, type: 'connection' });
                                }}
                                className={cn(
                                    "rounded p-0.5 transition-colors",
                                    selectedItem?.id === conn.id ? "hover:bg-primary/20" : "hover:bg-muted"
                                )}
                            >
                                {expandedItems.has(conn.id) ? (
                                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                                ) : (
                                    <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                                )}
                            </button>
                            {DB_ICONS[conn.type] ? (
                                <img
                                    src={DB_ICONS[conn.type]}
                                    alt={conn.type}
                                    className="h-4 w-4 shrink-0"
                                />
                            ) : (
                                <Database className={cn("h-4 w-4", selectedItem?.id === conn.id ? "text-primary" : "text-blue-500/80")} />
                            )}
                            <span className="truncate flex-1">{conn.name}</span>
                            {isLoading[conn.id] && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>

                        {/* Render Children */}
                        {expandedItems.has(conn.id) && treeData[conn.id] && (
                            <div className="ml-2 pl-2 border-l border-border/50 mt-1 space-y-0.5">
                                {treeData[conn.id].map((child) => (
                                    <div key={child.id}>
                                        <div
                                            className={cn(
                                                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer select-none",
                                                selectedItem?.id === child.id
                                                    ? "bg-white text-foreground font-medium shadow-sm ring-1 ring-border/50"
                                                    : "text-muted-foreground hover:bg-white/60 hover:text-foreground"
                                            )}
                                            onClick={() => handleItemClick(child)}
                                            onContextMenu={(e) => handleContextMenu(e, child, child.type)}
                                        >
                                            {['database', 'schema'].includes(child.type) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleItem(child);
                                                    }}
                                                    className={cn(
                                                        "rounded p-0.5 transition-colors",
                                                        selectedItem?.id === child.id ? "hover:bg-primary/20" : "hover:bg-muted"
                                                    )}
                                                >
                                                    {expandedItems.has(child.id) ? (
                                                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                                                    ) : (
                                                        <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                                                    )}
                                                </button>
                                            )}
                                            {child.type === 'database' && (
                                                conn.type === 'REDIS'
                                                    ? <Database className="h-3.5 w-3.5 text-red-500/80" />
                                                    : <Database className="h-3.5 w-3.5 text-purple-500/80" />
                                            )}
                                            {child.type === 'schema' && <LayoutGrid className="h-3.5 w-3.5 text-orange-500/80" />}
                                            {child.type === 'table' && <Table className="h-3.5 w-3.5 text-emerald-500/80" />}
                                            {child.type === 'collection' && <Files className="h-3.5 w-3.5 text-green-500/80" />}
                                            {child.type === 'redis_keys_list' && <List className="h-3.5 w-3.5 text-blue-500/80" />}
                                            {child.type === 'key' && <Key className="h-3.5 w-3.5 text-red-500/80" />}

                                            <span className="truncate flex-1">{child.name}</span>
                                            {isLoading[child.id] && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                        </div>

                                        {/* Nested Children (for DBs and Schemas) */}
                                        {expandedItems.has(child.id) && treeData[child.id] && (
                                            <div className="ml-2 pl-2 border-l border-border/50 mt-1 space-y-0.5">
                                                {treeData[child.id].map((grandChild) => (
                                                    <div key={grandChild.id}>
                                                        <div
                                                            className={cn(
                                                                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer select-none",
                                                                selectedItem?.id === grandChild.id
                                                                    ? "bg-white text-foreground font-medium shadow-sm ring-1 ring-border/50"
                                                                    : "text-muted-foreground hover:bg-white/60 hover:text-foreground"
                                                            )}
                                                            onClick={() => handleItemClick(grandChild)}
                                                            onContextMenu={(e) => handleContextMenu(e, grandChild, grandChild.type)}
                                                        >
                                                            {grandChild.type === 'schema' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleItem(grandChild);
                                                                    }}
                                                                    className={cn(
                                                                        "rounded p-0.5 transition-colors",
                                                                        selectedItem?.id === grandChild.id ? "hover:bg-primary/20" : "hover:bg-muted"
                                                                    )}
                                                                >
                                                                    {expandedItems.has(grandChild.id) ? (
                                                                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                                                                    ) : (
                                                                        <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                                                                    )}
                                                                </button>
                                                            )}
                                                            {grandChild.type === 'table' && <Table className="h-3.5 w-3.5 text-emerald-500/80" />}
                                                            {grandChild.type === 'schema' && <LayoutGrid className="h-3.5 w-3.5 text-orange-500/80" />}
                                                            {grandChild.type === 'collection' && <Files className="h-3.5 w-3.5 text-green-500/80" />}
                                                            {grandChild.type === 'key' && <Key className="h-3.5 w-3.5 text-red-500/80" />}
                                                            {grandChild.type === 'redis_keys_list' && <List className="h-3.5 w-3.5 text-blue-500/80" />}

                                                            <span className="truncate flex-1">{grandChild.name}</span>
                                                            {isLoading[grandChild.id] && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                        </div>

                                                        {/* Level 4: Tables inside Schemas (PostgreSQL) */}
                                                        {expandedItems.has(grandChild.id) && treeData[grandChild.id] && (
                                                            <div className="ml-2 pl-2 border-l border-border/50 mt-1 space-y-0.5">
                                                                {treeData[grandChild.id].map((greatGrandChild) => (
                                                                    <div
                                                                        key={greatGrandChild.id}
                                                                        className={cn(
                                                                            "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer select-none",
                                                                            selectedItem?.id === greatGrandChild.id
                                                                                ? "bg-white text-foreground font-medium shadow-sm ring-1 ring-border/50"
                                                                                : "text-muted-foreground hover:bg-white/60 hover:text-foreground"
                                                                        )}
                                                                        onClick={() => handleItemClick(greatGrandChild)}
                                                                        onContextMenu={(e) => handleContextMenu(e, greatGrandChild, greatGrandChild.type)}
                                                                    >
                                                                        <Table className="h-3.5 w-3.5 text-emerald-500/80" />
                                                                        <span className="truncate flex-1">{greatGrandChild.name}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        ...(contextMenu.type === 'connection' ? [
                            { label: 'New Query', onClick: () => handleContextMenuAction('new_query'), icon: <Terminal className="h-4 w-4" /> },
                            { separator: true } as const,
                            // Redis doesn't support "New Database" (fixed set) or "Import Database" in this tool's context
                            ...((contextMenu.item.type !== 'REDIS') ? [
                                { label: 'New Database', onClick: () => handleContextMenuAction('new_database'), icon: <Plus className="h-4 w-4" /> },
                                { label: 'Import Database', onClick: () => handleContextMenuAction('import_database'), icon: <Upload className="h-4 w-4" /> },
                            ] : []),
                            { separator: true } as const,
                            { label: 'Edit Connection', onClick: () => handleContextMenuAction('edit_connection'), icon: <Edit2 className="h-4 w-4" /> },
                            { label: 'Delete Connection', onClick: () => handleContextMenuAction('delete_connection'), icon: <Trash2 className="h-4 w-4 text-red-500" />, danger: true },
                            { separator: true } as const,
                            { label: 'Close Connection', onClick: () => handleContextMenuAction('disconnect'), icon: <Unplug className="h-4 w-4" /> },
                        ] : []),
                        ...(contextMenu.type === 'database' ? [
                            { label: 'New Query', onClick: () => handleContextMenuAction('new_query'), icon: <Terminal className="h-4 w-4" /> },
                            { separator: true } as const,
                            // Check connection type for database context menu
                            ...(() => {
                                const conn = connections.find(c => c.id === contextMenu.item.connectionId);
                                if (conn?.type === 'REDIS') {
                                    return []; // Redis databases don't support these table/import/export operations
                                }
                                return [
                                    { label: 'New Table', onClick: () => handleContextMenuAction('new_table'), icon: <Plus className="h-4 w-4" /> },
                                    { label: 'Import Data', onClick: () => handleContextMenuAction('import_data'), icon: <Upload className="h-4 w-4" /> },
                                    { separator: true } as const,
                                    { label: 'Export Database', onClick: () => handleContextMenuAction('export_database'), icon: <Download className="h-4 w-4" /> },
                                    { separator: true } as const,
                                ];
                            })(),
                            { label: 'Edit Database', onClick: () => handleContextMenuAction('edit_database'), icon: <Edit2 className="h-4 w-4" /> },
                            { label: 'Delete Database', onClick: () => handleContextMenuAction('delete_database'), icon: <Trash2 className="h-4 w-4 text-red-500" />, danger: true },
                            { separator: true } as const,
                        ] : []),
                        ...(contextMenu.type === 'collection' ? [
                            { label: 'Export Collection', onClick: handleExportCollection, icon: <Download className="h-4 w-4" /> },
                            { label: 'Import Collection', onClick: handleImportCollection, icon: <Upload className="h-4 w-4" /> },
                            { separator: true } as const,
                            { label: 'Drop Collection', onClick: () => handleContextMenuAction('drop_collection'), icon: <Trash2 className="h-4 w-4 text-red-500" />, danger: true },

                        ] : []),
                        ...(contextMenu.type === 'table' ? [
                            { label: 'Import Data', onClick: () => handleContextMenuAction('import_data'), icon: <Upload className="h-4 w-4" /> },
                            { label: 'Export Data', onClick: () => handleContextMenuAction('export_data'), icon: <Download className="h-4 w-4" /> },
                            { separator: true } as const,
                            { label: 'Clear Data', onClick: () => handleContextMenuAction('truncate_table'), icon: <Eraser className="h-4 w-4 text-orange-500" /> },
                            { label: 'Duplicate Table', onClick: () => handleContextMenuAction('copy_table'), icon: <Copy className="h-4 w-4 text-blue-500" /> },
                            { separator: true } as const,
                            { label: 'Design Table', onClick: () => handleContextMenuAction('edit_table'), icon: <Edit2 className="h-4 w-4" /> },
                            { label: 'Delete Table', onClick: () => handleContextMenuAction('delete_table'), icon: <Trash2 className="h-4 w-4 text-red-500" />, danger: true },
                            { separator: true } as const,
                        ] : []),
                        { label: 'Refresh', onClick: () => handleContextMenuAction('refresh'), icon: <RefreshCw className="h-4 w-4" /> },
                    ]}
                />
            )}

            {/* Modals */}
            <ConnectionModal
                isOpen={isConnectionModalOpen}
                onClose={() => {
                    setIsConnectionModalOpen(false);
                    setEditingConnection(undefined);
                }}
                initialData={editingConnection}
            />

            {deletingConnection && (
                <DeleteConnectionModal
                    isOpen={!!deletingConnection}
                    onClose={() => setDeletingConnection(undefined)}
                    connectionId={deletingConnection.id}
                    connectionName={deletingConnection.name}
                />
            )}

            {creatingDbConnectionId && (
                <CreateDatabaseModal
                    isOpen={!!creatingDbConnectionId}
                    onClose={() => setCreatingDbConnectionId(null)}
                    connectionId={creatingDbConnectionId}
                    onSuccess={() => {
                        const conn = connections.find(c => c.id === creatingDbConnectionId);
                        if (conn) {
                            refreshNode({ ...conn, type: 'connection' });
                        }
                    }}
                />
            )}

            {creatingTableDb && (
                <CreateTableModal
                    isOpen={!!creatingTableDb}
                    onClose={() => setCreatingTableDb(null)}
                    connectionId={creatingTableDb.connectionId}
                    databaseName={creatingTableDb.databaseName}
                    onSuccess={() => {
                        // Refresh parent node (Database or Schema)
                        const conn = connections.find(c => c.id === creatingTableDb.connectionId);
                        const isPostgres = conn?.type === 'POSTGRES';

                        // For PostgreSQL, default to 'public' schema if not specified
                        const schema = creatingTableDb.schema || (isPostgres ? 'public' : undefined);

                        if (schema) {
                            // Postgres Schema Parent
                            const schemaId = `${creatingTableDb.connectionId}-${creatingTableDb.databaseName}-${schema}`;
                            refreshNode({
                                id: schemaId,
                                name: schema,
                                type: 'schema',
                                connectionId: creatingTableDb.connectionId,
                                metadata: { database: creatingTableDb.databaseName, schema: schema }
                            });
                        } else {
                            // Database Parent (MySQL/MongoDB)
                            const dbItem = {
                                id: `${creatingTableDb.connectionId}-${creatingTableDb.databaseName}`,
                                name: creatingTableDb.databaseName,
                                type: 'database',
                                connectionId: creatingTableDb.connectionId,
                                metadata: { database: creatingTableDb.databaseName }
                            };
                            refreshNode(dbItem);
                        }
                    }}
                />
            )}

            {exportDataParams && (
                <ExportDataModal
                    isOpen={!!exportDataParams}
                    onClose={() => setExportDataParams(null)}
                    connectionId={exportDataParams.connectionId}
                    databaseName={exportDataParams.databaseName}
                    schema={exportDataParams.schema}
                    tableName={exportDataParams.tableName}
                />
            )}

            {exportDatabaseParams && (
                <ExportDatabaseModal
                    isOpen={!!exportDatabaseParams}
                    onClose={() => setExportDatabaseParams(null)}
                    connectionId={exportDatabaseParams.connectionId}
                    databaseName={exportDatabaseParams.databaseName}
                />
            )}

            {importDatabaseParams && (
                <ImportDatabaseModal
                    isOpen={!!importDatabaseParams}
                    onClose={() => setImportDatabaseParams(null)}
                    connectionId={importDatabaseParams.connectionId}
                    databaseName={importDatabaseParams.databaseName}
                />
            )}

            {importDataParams && (
                <ImportDataModal
                    isOpen={!!importDataParams}
                    onClose={() => setImportDataParams(null)}
                    connectionId={importDataParams.connectionId}
                    databaseName={importDataParams.databaseName}
                    schema={importDataParams.schema}
                    tableName={importDataParams.tableName}
                    onSuccess={() => {
                        if (importDataParams.tableName) {
                            // Table level import - refresh table if we had that (but we don't have table list refresh yet)
                            // Maybe refresh database
                        } else {
                            // Database level import - Refresh Database Node
                            // If schema provided (Postgres)
                            const conn = connections.find(c => c.id === importDataParams.connectionId);
                            const isPostgres = conn?.type === 'POSTGRES';

                            if (isPostgres && importDataParams.schema) {
                                // Refresh Schema Node
                                const schemaId = `${importDataParams.connectionId}-${importDataParams.databaseName}-${importDataParams.schema}`;
                                refreshNode({
                                    id: schemaId,
                                    name: importDataParams.schema,
                                    type: 'schema',
                                    connectionId: importDataParams.connectionId,
                                    metadata: { database: importDataParams.databaseName, schema: importDataParams.schema }
                                });
                            } else {
                                // Refresh Database Node
                                const dbId = `${importDataParams.connectionId}-${importDataParams.databaseName}`;
                                refreshNode({
                                    id: dbId,
                                    name: importDataParams.databaseName,
                                    type: 'database',
                                    connectionId: importDataParams.connectionId,
                                    metadata: { database: importDataParams.databaseName }
                                });
                            }
                        }
                    }}
                />
            )}

            {editingDatabase && (
                <EditDatabaseModal
                    isOpen={!!editingDatabase}
                    onClose={() => setEditingDatabase(null)}
                    connectionId={editingDatabase.connectionId}
                    databaseName={editingDatabase.databaseName}
                    onSuccess={() => {
                        const conn = connections.find(c => c.id === editingDatabase.connectionId);
                        if (conn) {
                            refreshNode({ ...conn, type: 'connection' });
                        }
                    }}
                />
            )}

            {deletingDatabase && (
                <DeleteDatabaseModal
                    isOpen={!!deletingDatabase}
                    onClose={() => setDeletingDatabase(null)}
                    connectionId={deletingDatabase.connectionId}
                    databaseName={deletingDatabase.databaseName}
                    onSuccess={() => {
                        // Clear the selected item to show empty detail view
                        selectItem(null);

                        const conn = connections.find(c => c.id === deletingDatabase.connectionId);
                        if (conn) {
                            refreshNode({ ...conn, type: 'connection' });
                        }
                    }}
                />
            )}

            {editingTable && (
                <EditTableModal
                    isOpen={!!editingTable}
                    onClose={() => setEditingTable(null)}
                    connectionId={editingTable.connectionId}
                    databaseName={editingTable.databaseName}
                    tableName={editingTable.tableName}
                    onSuccess={() => {
                        if (editingTable.schema) {
                            const schemaId = `${editingTable.connectionId}-${editingTable.databaseName}-${editingTable.schema}`;
                            refreshNode({
                                id: schemaId,
                                name: editingTable.schema,
                                type: 'schema',
                                connectionId: editingTable.connectionId,
                                metadata: { database: editingTable.databaseName, schema: editingTable.schema }
                            });
                        } else {
                            const dbItem = {
                                id: `${editingTable.connectionId}-${editingTable.databaseName}`,
                                name: editingTable.databaseName,
                                type: 'database',
                                connectionId: editingTable.connectionId,
                                metadata: { database: editingTable.databaseName }
                            };
                            refreshNode(dbItem);
                        }
                    }}
                />
            )}

            {deletingTable && (
                <DeleteTableModal
                    isOpen={!!deletingTable}
                    onClose={() => setDeletingTable(null)}
                    connectionId={deletingTable.connectionId}
                    databaseName={deletingTable.databaseName}
                    tableName={deletingTable.tableName}
                    onSuccess={() => {
                        // Clear the selected item to show empty detail view
                        selectItem(null);

                        if (deletingTable.schema) {
                            const schemaId = `${deletingTable.connectionId}-${deletingTable.databaseName}-${deletingTable.schema}`;
                            refreshNode({
                                id: schemaId,
                                name: deletingTable.schema,
                                type: 'schema',
                                connectionId: deletingTable.connectionId,
                                metadata: { database: deletingTable.databaseName, schema: deletingTable.schema }
                            });
                        } else {
                            const dbItem = {
                                id: `${deletingTable.connectionId}-${deletingTable.databaseName}`,
                                name: deletingTable.databaseName,
                                type: 'database',
                                connectionId: deletingTable.connectionId,
                                metadata: { database: deletingTable.databaseName }
                            };
                            refreshNode(dbItem);
                        }
                    }}
                />
            )}

            {emptyingTable && (
                <EmptyTableModal
                    isOpen={!!emptyingTable}
                    onClose={() => setEmptyingTable(null)}
                    connectionId={emptyingTable.connectionId}
                    databaseName={emptyingTable.databaseName}
                    tableName={emptyingTable.tableName}
                    onSuccess={() => {
                        // Refresh table detail view if it's open
                        (window as any).__refreshTableDetailView?.();
                    }}
                />
            )}

            {truncatingTable && (
                <TruncateTableModal
                    isOpen={!!truncatingTable}
                    onClose={() => setTruncatingTable(null)}
                    connectionId={truncatingTable.connectionId}
                    databaseName={truncatingTable.databaseName}
                    tableName={truncatingTable.tableName}
                    onSuccess={() => {
                        // Refresh table detail view if it's open
                        (window as any).__refreshTableDetailView?.();
                    }}
                />
            )}

            {copyingTable && (
                <CopyTableModal
                    isOpen={!!copyingTable}
                    onClose={() => setCopyingTable(null)}
                    connectionId={copyingTable.connectionId}
                    databaseName={copyingTable.databaseName}
                    tableName={copyingTable.tableName}
                    onSuccess={() => {
                        if (copyingTable.schema) {
                            const schemaId = `${copyingTable.connectionId}-${copyingTable.databaseName}-${copyingTable.schema}`;
                            refreshNode({
                                id: schemaId,
                                name: copyingTable.schema,
                                type: 'schema',
                                connectionId: copyingTable.connectionId,
                                metadata: { database: copyingTable.databaseName, schema: copyingTable.schema }
                            });
                        } else {
                            const dbItem = {
                                id: `${copyingTable.connectionId}-${copyingTable.databaseName}`,
                                name: copyingTable.databaseName,
                                type: 'database',
                                connectionId: copyingTable.connectionId,
                                metadata: { database: copyingTable.databaseName }
                            };
                            refreshNode(dbItem);
                        }
                    }}
                />
            )}
            {/* MongoDB Collection Modals */}
            <ExportCollectionModal
                isOpen={exportCollectionModal.isOpen}
                onClose={() => setExportCollectionModal(prev => ({ ...prev, isOpen: false }))}
                connectionId={exportCollectionModal.connectionId}
                databaseName={exportCollectionModal.databaseName}
                collectionName={exportCollectionModal.collectionName}
            />

            <ImportCollectionModal
                isOpen={!!importCollectionParams}
                onClose={() => setImportCollectionParams(null)}
                connectionId={importCollectionParams?.connectionId || ''}
                databaseName={importCollectionParams?.databaseName || ''}
                collectionName={importCollectionParams?.collectionName || ''}
            />
            {/* Drop Collection Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!dropCollectionParams}
                onClose={() => setDropCollectionParams(null)}
                onConfirm={confirmDropCollection}
                title="Drop Collection"
                message={`Are you sure you want to drop the collection "${dropCollectionParams?.collectionName}"? This action cannot be undone.`}
                confirmText="Drop Collection"
                isDestructive={true}
            />

            {/* Alert Modal for operation results */}
            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
