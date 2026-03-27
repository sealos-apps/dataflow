import React, { useState, useEffect } from "react";
import { X, Table, Save, Loader2, Plus, Trash2, Key, Link as LinkIcon, CheckCircle, XCircle, ChevronDown } from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { cn } from "@/lib/utils";
import { useRawExecuteLazyQuery, useExecuteConfirmedSqlMutation } from '@graphql';
import type { SqlDialect } from '@/utils/ddl-sql';
import {
  addColumnSQL, dropColumnSQL, modifyColumnSQL,
  createIndexSQL, dropIndexSQL,
  addForeignKeySQL, dropForeignKeySQL,
  columnsQuery, indexesQuery, foreignKeysQuery,
} from '@/utils/ddl-sql';

interface EditTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    tableName: string;
    schema?: string; // For PostgreSQL
    onSuccess?: () => void;
}

interface ColumnDefinition {
    id: string;
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isNullable: boolean;
    comment: string;
    isNew?: boolean; // Track if this is a new column
}

interface IndexDefinition {
    id: string;
    name: string;
    columns: string[];
    type: string;
    isUnique: boolean;
    comment: string;
    isNew?: boolean;
}

interface ForeignKeyDefinition {
    id: string;
    name: string;
    column: string;
    referencedTable: string;
    referencedColumn: string;
    onDelete: string;
    onUpdate: string;
    isNew?: boolean;
}

interface OperationResult {
    success: boolean;
    message: string;
    executedSql?: string;
}

const COLUMN_TYPES = [
    "INT", "BIGINT", "SMALLINT", "TINYINT",
    "VARCHAR(50)", "VARCHAR(100)", "VARCHAR(255)", "VARCHAR(500)",
    "TEXT", "LONGTEXT", "MEDIUMTEXT",
    "BOOLEAN", "BIT",
    "DATE", "DATETIME", "TIMESTAMP", "TIME",
    "DECIMAL(10,2)", "DECIMAL(18,4)", "FLOAT", "DOUBLE",
    "JSON", "BLOB"
];

const INDEX_TYPES = ["BTREE", "HASH", "FULLTEXT", "SPATIAL"];
const FK_ACTIONS = ["RESTRICT", "CASCADE", "SET NULL", "NO ACTION", "SET DEFAULT"];

export function EditTableModal({ isOpen, onClose, connectionId, databaseName, tableName, schema, onSuccess }: EditTableModalProps) {
    const { connections } = useConnectionStore();
    const [activeTab, setActiveTab] = useState<'fields' | 'indexes' | 'foreignKeys'>('fields');

    const [columns, setColumns] = useState<ColumnDefinition[]>([]);
    const [indexes, setIndexes] = useState<IndexDefinition[]>([]);
    const [foreignKeys, setForeignKeys] = useState<ForeignKeyDefinition[]>([]);

    // Track original state for detecting changes
    const [originalColumns, setOriginalColumns] = useState<ColumnDefinition[]>([]);
    const [originalIndexes, setOriginalIndexes] = useState<IndexDefinition[]>([]);
    const [originalForeignKeys, setOriginalForeignKeys] = useState<ForeignKeyDefinition[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isExecuting, setIsExecuting] = useState(false);

    // Result modal state
    const [showResultModal, setShowResultModal] = useState(false);
    const [operationResults, setOperationResults] = useState<OperationResult[]>([]);

    const conn = connections.find(c => c.id === connectionId);

    const [rawExecute] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' });
    const [executeConfirmedSql] = useExecuteConfirmedSqlMutation();

    const dialect: SqlDialect = (() => {
      const dbType = conn?.type;
      const map: Record<string, SqlDialect> = {
        MYSQL: 'MYSQL', POSTGRES: 'POSTGRES', MARIADB: 'MARIADB',
        SQLITE3: 'SQLITE3', CLICKHOUSE: 'CLICKHOUSE',
      };
      return map[dbType ?? ''] ?? 'POSTGRES';
    })();

    useEffect(() => {
        if (isOpen) {
            fetchTableSchema();
        }
    }, [isOpen, connectionId, databaseName, tableName, connections]);

    const fetchTableSchema = async () => {
        setIsLoading(true);
        if (!conn) { setIsLoading(false); return; }

        try {
            // Fetch columns
            const { data: colData } = await rawExecute({
                variables: { query: columnsQuery(dialect, databaseName, tableName, schema) },
                context: { database: databaseName },
            });
            if (colData?.RawExecute) {
                const colNames = colData.RawExecute.Columns.map(c => c.Name.toLowerCase());
                const cols: ColumnDefinition[] = colData.RawExecute.Rows.map((row, i) => {
                    const get = (name: string) => row[colNames.indexOf(name)] ?? '';
                    return {
                        id: `col_${i}`,
                        name: get('column_name') || get('name'),
                        type: get('column_type') || get('data_type') || get('type'),
                        isPrimaryKey: (get('column_key') || get('pk')) === 'PRI' || get('pk') === '1',
                        isNullable: (get('is_nullable') || get('notnull')) !== 'NO' && get('notnull') !== '1',
                        comment: get('column_comment') || '',
                        isNew: false,
                    };
                });
                setColumns(cols);
                setOriginalColumns(JSON.parse(JSON.stringify(cols)));
            }

            // Fetch indexes
            const { data: idxData } = await rawExecute({
                variables: { query: indexesQuery(dialect, databaseName, tableName, schema) },
                context: { database: databaseName },
            });
            if (idxData?.RawExecute) {
                const idxNames = idxData.RawExecute.Columns.map(c => c.Name.toLowerCase());
                const idxs: IndexDefinition[] = idxData.RawExecute.Rows.map((row, i) => {
                    const get = (name: string) => row[idxNames.indexOf(name)] ?? '';
                    return {
                        id: `idx_${i}`,
                        name: get('index_name') || get('name'),
                        columns: (get('columns') || get('column_name') || '').split(',').filter(Boolean),
                        type: get('index_type') || 'BTREE',
                        isUnique: get('is_unique') === 'true' || get('is_unique') === 't' || get('non_unique') === '0',
                        comment: '',
                        isNew: false,
                    };
                });
                setIndexes(idxs);
                setOriginalIndexes(JSON.parse(JSON.stringify(idxs)));
            }

            // Fetch foreign keys
            const { data: fkData } = await rawExecute({
                variables: { query: foreignKeysQuery(dialect, databaseName, tableName, schema) },
                context: { database: databaseName },
            });
            if (fkData?.RawExecute) {
                const fkNames = fkData.RawExecute.Columns.map(c => c.Name.toLowerCase());
                const fks: ForeignKeyDefinition[] = fkData.RawExecute.Rows.map((row, i) => {
                    const get = (name: string) => row[fkNames.indexOf(name)] ?? '';
                    return {
                        id: `fk_${i}`,
                        name: get('constraint_name'),
                        column: get('column_name'),
                        referencedTable: get('referenced_table_name'),
                        referencedColumn: get('referenced_column_name'),
                        onDelete: get('delete_rule') || 'RESTRICT',
                        onUpdate: get('update_rule') || 'RESTRICT',
                        isNew: false,
                    };
                });
                setForeignKeys(fks);
                setOriginalForeignKeys(JSON.parse(JSON.stringify(fks)));
            }
        } catch (error) {
            console.error('Error fetching table schema:', error);
            setColumns([]); setIndexes([]); setForeignKeys([]);
        }
        setIsLoading(false);
    };

    if (!isOpen) return null;

    // --- API Call Helper ---
    const executeOperation = async (sql: string): Promise<OperationResult> => {
        const statements = sql.split(';\n').map(s => s.trim()).filter(Boolean);
        const allSql = sql;

        for (const stmt of statements) {
            try {
                const { data, errors } = await executeConfirmedSql({
                    variables: { query: stmt, operationType: 'DDL' },
                    context: { database: databaseName },
                });
                if (errors?.length) {
                    return { success: false, message: errors[0].message, executedSql: allSql };
                }
                const msg = data?.ExecuteConfirmedSQL;
                if (msg?.Type === 'error') {
                    return { success: false, message: msg.Text, executedSql: allSql };
                }
            } catch (err: any) {
                return { success: false, message: err.message, executedSql: allSql };
            }
        }
        return { success: true, message: 'Operation completed', executedSql: allSql };
    };

    // --- Column Handlers ---
    const handleAddColumn = () => {
        setColumns([
            ...columns,
            {
                id: Math.random().toString(36).substr(2, 9),
                name: "",
                type: "VARCHAR(255)",
                isPrimaryKey: false,
                isNullable: true,
                comment: "",
                isNew: true
            }
        ]);
    };

    const handleRemoveColumn = async (col: ColumnDefinition) => {
        if (col.isNew) {
            // Just remove from local state
            setColumns(columns.filter(c => c.id !== col.id));
            return;
        }

        // Execute DROP COLUMN
        setIsExecuting(true);
        const sql = dropColumnSQL(dialect, tableName, col.name, schema);
        const result = await executeOperation(sql);
        setOperationResults([result]);
        setShowResultModal(true);
        setIsExecuting(false);

        if (result.success) {
            setColumns(columns.filter(c => c.id !== col.id));
            setOriginalColumns(originalColumns.filter(c => c.name !== col.name));
        }
    };

    const updateColumn = (id: string, field: keyof ColumnDefinition, value: any) => {
        setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleSaveColumn = async (col: ColumnDefinition) => {
        if (!col.name.trim()) {
            setOperationResults([{ success: false, message: 'Column name is required' }]);
            setShowResultModal(true);
            return;
        }

        setIsExecuting(true);

        const sql = col.isNew
            ? addColumnSQL(dialect, tableName, col.name, col.type, col.isNullable, schema)
            : modifyColumnSQL(dialect, tableName, col.name, col.type, col.isNullable, schema);
        const result = await executeOperation(sql);

        setOperationResults([result]);
        setShowResultModal(true);
        setIsExecuting(false);

        if (result.success) {
            // Mark as no longer new
            setColumns(columns.map(c => c.id === col.id ? { ...c, isNew: false } : c));
            // Update original state
            if (col.isNew) {
                setOriginalColumns([...originalColumns, { ...col, isNew: false }]);
            } else {
                setOriginalColumns(originalColumns.map(c => c.name === col.name ? { ...col, isNew: false } : c));
            }
        }
    };

    // --- Index Handlers ---
    const handleAddIndex = () => {
        setIndexes([
            ...indexes,
            {
                id: Math.random().toString(36).substr(2, 9),
                name: `idx_${tableName}_${Math.random().toString(36).substr(2, 5)}`,
                columns: [],
                type: "BTREE",
                isUnique: false,
                comment: "",
                isNew: true
            }
        ]);
    };

    const handleRemoveIndex = async (idx: IndexDefinition) => {
        if (idx.isNew) {
            setIndexes(indexes.filter(i => i.id !== idx.id));
            return;
        }

        setIsExecuting(true);
        const sql = dropIndexSQL(dialect, tableName, idx.name, schema);
        const result = await executeOperation(sql);
        setOperationResults([result]);
        setShowResultModal(true);
        setIsExecuting(false);

        if (result.success) {
            setIndexes(indexes.filter(i => i.id !== idx.id));
            setOriginalIndexes(originalIndexes.filter(i => i.name !== idx.name));
        }
    };

    const updateIndex = (id: string, field: keyof IndexDefinition, value: any) => {
        setIndexes(indexes.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const toggleIndexColumn = (indexId: string, columnName: string) => {
        setIndexes(indexes.map(idx => {
            if (idx.id !== indexId) return idx;
            const cols = idx.columns.includes(columnName)
                ? idx.columns.filter(c => c !== columnName)
                : [...idx.columns, columnName];
            return { ...idx, columns: cols };
        }));
    };

    const handleSaveIndex = async (idx: IndexDefinition) => {
        if (!idx.name.trim()) {
            setOperationResults([{ success: false, message: 'Index name is required' }]);
            setShowResultModal(true);
            return;
        }
        if (idx.columns.length === 0) {
            setOperationResults([{ success: false, message: 'Please select at least one column for the index' }]);
            setShowResultModal(true);
            return;
        }

        setIsExecuting(true);

        // For existing indexes, we need to drop and recreate
        if (!idx.isNew) {
            const originalIdx = originalIndexes.find(oi => oi.id === idx.id);
            const nameToDrop = originalIdx ? originalIdx.name : idx.name;

            const dropSql = dropIndexSQL(dialect, tableName, nameToDrop, schema);
            const dropResult = await executeOperation(dropSql);
            if (!dropResult.success) {
                setOperationResults([dropResult]);
                setShowResultModal(true);
                setIsExecuting(false);
                return;
            }
        }

        const createSql = createIndexSQL(dialect, tableName, idx.name, idx.columns, idx.isUnique, schema);
        const result = await executeOperation(createSql);

        setOperationResults([result]);
        setShowResultModal(true);
        setIsExecuting(false);

        if (result.success) {
            setIndexes(indexes.map(i => i.id === idx.id ? { ...i, isNew: false } : i));
            if (idx.isNew) {
                setOriginalIndexes([...originalIndexes, { ...idx, isNew: false }]);
            }
        }
    };

    // --- Foreign Key Handlers ---
    const handleAddForeignKey = () => {
        setForeignKeys([
            ...foreignKeys,
            {
                id: Math.random().toString(36).substr(2, 9),
                name: `fk_${tableName}_${Math.random().toString(36).substr(2, 5)}`,
                column: "",
                referencedTable: "",
                referencedColumn: "",
                onDelete: "RESTRICT",
                onUpdate: "RESTRICT",
                isNew: true
            }
        ]);
    };

    const handleRemoveForeignKey = async (fk: ForeignKeyDefinition) => {
        if (fk.isNew) {
            setForeignKeys(foreignKeys.filter(f => f.id !== fk.id));
            return;
        }

        setIsExecuting(true);
        const sql = dropForeignKeySQL(dialect, tableName, fk.name, schema);
        const result = await executeOperation(sql);
        setOperationResults([result]);
        setShowResultModal(true);
        setIsExecuting(false);

        if (result.success) {
            setForeignKeys(foreignKeys.filter(f => f.id !== fk.id));
            setOriginalForeignKeys(originalForeignKeys.filter(f => f.name !== fk.name));
        }
    };

    const updateForeignKey = (id: string, field: keyof ForeignKeyDefinition, value: any) => {
        setForeignKeys(foreignKeys.map(fk => fk.id === id ? { ...fk, [field]: value } : fk));
    };

    const handleSaveForeignKey = async (fk: ForeignKeyDefinition) => {
        if (!fk.name.trim() || !fk.column.trim() || !fk.referencedTable.trim() || !fk.referencedColumn.trim()) {
            setOperationResults([{ success: false, message: 'All foreign key fields are required' }]);
            setShowResultModal(true);
            return;
        }

        setIsExecuting(true);

        // For existing FKs, drop first
        if (!fk.isNew) {
            const dropSql = dropForeignKeySQL(dialect, tableName, fk.name, schema);
            const dropResult = await executeOperation(dropSql);
            if (!dropResult.success) {
                setOperationResults([dropResult]);
                setShowResultModal(true);
                setIsExecuting(false);
                return;
            }
        }

        const sql = addForeignKeySQL(dialect, tableName, fk.name, fk.column, fk.referencedTable, fk.referencedColumn, fk.onDelete, fk.onUpdate, schema);
        const result = await executeOperation(sql);

        setOperationResults([result]);
        setShowResultModal(true);
        setIsExecuting(false);

        if (result.success) {
            setForeignKeys(foreignKeys.map(f => f.id === fk.id ? { ...f, isNew: false } : f));
            if (fk.isNew) {
                setOriginalForeignKeys([...originalForeignKeys, { ...fk, isNew: false }]);
            }
        }
    };

    const handleClose = () => {
        setShowResultModal(false);
        setOperationResults([]);
        onClose();
    };

    // Get column names for index column selection
    const columnNames = columns.filter(c => c.name.trim()).map(c => c.name);

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="w-full max-w-5xl rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Table className="h-5 w-5 text-emerald-500" />
                            Edit Table: {tableName}
                        </h2>
                        <button onClick={handleClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 px-6 pt-4 border-b shrink-0">
                        <button
                            onClick={() => setActiveTab('fields')}
                            className={cn(
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                                activeTab === 'fields'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Table className="h-4 w-4" />
                            Fields ({columns.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('indexes')}
                            className={cn(
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                                activeTab === 'indexes'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Key className="h-4 w-4" />
                            Indexes ({indexes.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('foreignKeys')}
                            className={cn(
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                                activeTab === 'foreignKeys'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LinkIcon className="h-4 w-4" />
                            Foreign Keys ({foreignKeys.length})
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Fields Tab */}
                                {activeTab === 'fields' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-end">
                                            <button
                                                onClick={handleAddColumn}
                                                className="text-xs flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <Plus className="h-3 w-3" />
                                                Add Field
                                            </button>
                                        </div>
                                        <div className="rounded-md border">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-medium">Name</th>
                                                        <th className="px-3 py-2 text-left font-medium">Type</th>
                                                        <th className="px-3 py-2 text-center font-medium w-14">PK</th>
                                                        <th className="px-3 py-2 text-center font-medium w-14">Null</th>
                                                        <th className="px-3 py-2 text-left font-medium">Comment</th>
                                                        <th className="px-3 py-2 w-20">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {columns.map((col) => (
                                                        <tr key={col.id} className={cn("group hover:bg-muted/30", col.isNew && "bg-emerald-50/50")}>
                                                            <td className="p-2">
                                                                <input
                                                                    type="text"
                                                                    value={col.name}
                                                                    onChange={(e) => updateColumn(col.id, "name", e.target.value)}
                                                                    className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none"
                                                                    placeholder="Column Name"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <select
                                                                    value={col.type}
                                                                    onChange={(e) => updateColumn(col.id, "type", e.target.value)}
                                                                    className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-xs"
                                                                >
                                                                    {COLUMN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={col.isPrimaryKey}
                                                                    onChange={(e) => updateColumn(col.id, "isPrimaryKey", e.target.checked)}
                                                                    className="rounded border-muted-foreground"
                                                                />
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={col.isNullable}
                                                                    onChange={(e) => updateColumn(col.id, "isNullable", e.target.checked)}
                                                                    className="rounded border-muted-foreground"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="text"
                                                                    value={col.comment}
                                                                    onChange={(e) => updateColumn(col.id, "comment", e.target.value)}
                                                                    className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-muted-foreground text-xs"
                                                                    placeholder="Comment..."
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleSaveColumn(col)}
                                                                        disabled={isExecuting}
                                                                        className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                                                        title="Save Column"
                                                                    >
                                                                        {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRemoveColumn(col)}
                                                                        disabled={isExecuting}
                                                                        className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                        title="Delete Column"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Indexes Tab */}
                                {activeTab === 'indexes' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-end">
                                            <button
                                                onClick={handleAddIndex}
                                                className="text-xs flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <Plus className="h-3 w-3" />
                                                Add Index
                                            </button>
                                        </div>
                                        <div className="rounded-md border">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-medium">Name</th>
                                                        <th className="px-3 py-2 text-left font-medium">Columns</th>
                                                        <th className="px-3 py-2 text-left font-medium w-24">Type</th>
                                                        <th className="px-3 py-2 text-center font-medium w-16">Unique</th>
                                                        <th className="px-3 py-2 text-left font-medium">Comment</th>
                                                        <th className="px-3 py-2 w-20">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {indexes.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                                                No indexes found
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        indexes.map((idx) => (
                                                            <tr key={idx.id} className={cn("group hover:bg-muted/30", idx.isNew && "bg-emerald-50/50")}>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={idx.name}
                                                                        onChange={(e) => updateIndex(idx.id, "name", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none"
                                                                        placeholder="Index Name"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <MultiSelect
                                                                        options={columnNames}
                                                                        selected={idx.columns}
                                                                        onChange={(newCols) => updateIndex(idx.id, "columns", newCols)}
                                                                        placeholder="Select columns..."
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <select
                                                                        value={idx.type}
                                                                        onChange={(e) => updateIndex(idx.id, "type", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-xs"
                                                                    >
                                                                        {INDEX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={idx.isUnique}
                                                                        onChange={(e) => updateIndex(idx.id, "isUnique", e.target.checked)}
                                                                        className="rounded border-muted-foreground"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={idx.comment}
                                                                        onChange={(e) => updateIndex(idx.id, "comment", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-muted-foreground text-xs"
                                                                        placeholder="Comment..."
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleSaveIndex(idx)}
                                                                            disabled={isExecuting}
                                                                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                                                            title="Save Index"
                                                                        >
                                                                            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRemoveIndex(idx)}
                                                                            disabled={isExecuting}
                                                                            className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                            title="Delete Index"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Foreign Keys Tab */}
                                {activeTab === 'foreignKeys' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-end">
                                            <button
                                                onClick={handleAddForeignKey}
                                                className="text-xs flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <Plus className="h-3 w-3" />
                                                Add Foreign Key
                                            </button>
                                        </div>
                                        <div className="rounded-md border">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-medium">Name</th>
                                                        <th className="px-3 py-2 text-left font-medium">Column</th>
                                                        <th className="px-3 py-2 text-left font-medium">Ref Table</th>
                                                        <th className="px-3 py-2 text-left font-medium">Ref Column</th>
                                                        <th className="px-3 py-2 text-left font-medium w-24">On Delete</th>
                                                        <th className="px-3 py-2 text-left font-medium w-24">On Update</th>
                                                        <th className="px-3 py-2 w-20">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {foreignKeys.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                                                No foreign keys found
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        foreignKeys.map((fk) => (
                                                            <tr key={fk.id} className={cn("group hover:bg-muted/30", fk.isNew && "bg-emerald-50/50")}>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={fk.name}
                                                                        onChange={(e) => updateForeignKey(fk.id, "name", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-xs"
                                                                        placeholder="FK Name"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <select
                                                                        value={fk.column}
                                                                        onChange={(e) => updateForeignKey(fk.id, "column", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-xs"
                                                                    >
                                                                        <option value="">Select Column</option>
                                                                        {columnNames.map(c => <option key={c} value={c}>{c}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={fk.referencedTable}
                                                                        onChange={(e) => updateForeignKey(fk.id, "referencedTable", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-xs"
                                                                        placeholder="Table name"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={fk.referencedColumn}
                                                                        onChange={(e) => updateForeignKey(fk.id, "referencedColumn", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-xs"
                                                                        placeholder="Column name"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <select
                                                                        value={fk.onDelete}
                                                                        onChange={(e) => updateForeignKey(fk.id, "onDelete", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-xs"
                                                                    >
                                                                        {FK_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-2">
                                                                    <select
                                                                        value={fk.onUpdate}
                                                                        onChange={(e) => updateForeignKey(fk.id, "onUpdate", e.target.value)}
                                                                        className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none text-xs"
                                                                    >
                                                                        {FK_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-2">
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleSaveForeignKey(fk)}
                                                                            disabled={isExecuting}
                                                                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                                                            title="Save Foreign Key"
                                                                        >
                                                                            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRemoveForeignKey(fk)}
                                                                            disabled={isExecuting}
                                                                            className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                            title="Delete Foreign Key"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 border-t bg-muted/5 px-6 py-4 shrink-0">
                        <button
                            onClick={handleClose}
                            className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {/* Result Modal */}
            {showResultModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200 p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            {operationResults.every(r => r.success) ? (
                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            Operation Result
                        </h3>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {operationResults.map((result, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "p-3 rounded-md border text-sm",
                                        result.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                                    )}
                                >
                                    <p className={result.success ? "text-emerald-800" : "text-red-800"}>
                                        {result.message}
                                    </p>
                                    {result.executedSql && (
                                        <pre className="mt-2 text-xs bg-black/5 p-2 rounded overflow-x-auto">
                                            {result.executedSql}
                                        </pre>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setShowResultModal(false)}
                                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

import { createPortal } from "react-dom";

function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Select..."
}: {
    options: string[],
    selected: string[],
    onChange: (newSelected: string[]) => void,
    placeholder?: string
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is outside both the trigger and the dropdown content
            const dropdown = document.getElementById('multiselect-dropdown');
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                dropdown &&
                !dropdown.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            // Calculate position
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Update position on scroll or resize
    useEffect(() => {
        if (!isOpen) return;

        const updatePosition = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
        };

        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <div
                className="w-full rounded border border-transparent hover:border-border bg-transparent px-2 py-1 text-xs cursor-pointer flex items-center justify-between min-h-[26px]"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">
                    {selected.length === 0 ? <span className="text-muted-foreground">{placeholder}</span> : selected.join(", ")}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-1" />
            </div>

            {isOpen && createPortal(
                <div
                    id="multiselect-dropdown"
                    className="fixed z-[9999] bg-popover text-popover-foreground shadow-md rounded-md border p-2 mt-1 max-h-48 overflow-y-auto"
                    style={{
                        top: position.top,
                        left: position.left,
                        width: Math.max(position.width, 200) // Min width 200px
                    }}
                >
                    {options.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2 text-center">No columns available</div>
                    ) : (
                        options.map(opt => (
                            <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(opt)}
                                    onChange={(e) => {
                                        if (e.target.checked) onChange([...selected, opt]);
                                        else onChange(selected.filter(s => s !== opt));
                                    }}
                                    className="rounded border-muted-foreground h-3.5 w-3.5"
                                />
                                {opt}
                            </label>
                        ))
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
