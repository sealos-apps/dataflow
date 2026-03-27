import React, { useState } from "react";
import { AlertModal } from "@/components/ui/AlertModal";

import { X, Table, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { resolveSchemaParam } from "@/utils/database-features";
import type { RecordInput } from "@graphql";

interface CreateTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    schema?: string;
    onSuccess?: () => void; // Callback to refresh tree data
}

interface ColumnDefinition {
    id: string;
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isNullable: boolean;
}

const COLUMN_TYPES = [
    "INT", "VARCHAR(255)", "TEXT", "BOOLEAN", "DATE", "DATETIME", "DECIMAL", "FLOAT", "JSON"
];

export function CreateTableModal({ isOpen, onClose, connectionId, databaseName, schema, onSuccess }: CreateTableModalProps) {
    const { createTable, connections } = useConnectionStore();
    const [tableName, setTableName] = useState("");
    const [columns, setColumns] = useState<ColumnDefinition[]>([
        { id: "1", name: "id", type: "INT", isPrimaryKey: true, isNullable: false }
    ]);
    const [isSaving, setIsSaving] = useState(false);

    // Alert State
    const [alert, setAlert] = useState<{
        isOpen: boolean;
        type: 'success' | 'error';
        title: string;
        message: string;
    }>({
        isOpen: false,
        type: 'success', // Default
        title: '',
        message: ''
    });

    if (!isOpen) return null;

    const handleAddColumn = () => {
        setColumns([
            ...columns,
            {
                id: Math.random().toString(36).substr(2, 9),
                name: "",
                type: "VARCHAR(255)",
                isPrimaryKey: false,
                isNullable: true
            }
        ]);
    };

    const handleRemoveColumn = (id: string) => {
        setColumns(columns.filter(c => c.id !== id));
    };

    const updateColumn = (id: string, field: keyof ColumnDefinition, value: any) => {
        setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleSave = async () => {
        if (!tableName || columns.length === 0) return;

        setIsSaving(true);
        try {
            const conn = connections.find(c => c.id === connectionId);
            const schemaParam = resolveSchemaParam(conn?.type, databaseName, schema);

            const fields: RecordInput[] = columns.map(col => ({
                Key: col.name,
                Value: col.type,
                Extra: [
                    { Key: 'Nullable', Value: col.isNullable ? 'true' : 'false' },
                    { Key: 'Primary', Value: col.isPrimaryKey ? 'true' : 'false' },
                ],
            }));

            const result = await createTable(schemaParam, tableName, fields);

            if (result.success) {
                setAlert({
                    isOpen: true,
                    type: 'success',
                    title: 'Table Created',
                    message: result.message ?? `Table "${tableName}" has been successfully created.`,
                });
            } else {
                setAlert({
                    isOpen: true,
                    type: 'error',
                    title: 'Creation Failed',
                    message: result.message ?? 'Failed to create table.',
                });
            }
        } catch (error) {
            setAlert({
                isOpen: true,
                type: 'error',
                title: 'Creation Failed',
                message: error instanceof Error ? error.message : "An unknown error occurred while creating the table."
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAlertClose = () => {
        setAlert(prev => ({ ...prev, isOpen: false }));
        if (alert.type === 'success') {
            if (onSuccess) onSuccess();
            onClose();
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                {/* ... existing modal content ... */}
                <div className="w-full max-w-4xl rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    {/* ... header ... */}
                    <div className="flex items-center justify-between border-b px-6 py-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Table className="h-5 w-5 text-emerald-500" />
                            Create Table
                        </h2>
                        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* ... body ... */}
                    <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-6">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                                        Table Name
                                    </label>
                                    <input
                                        type="text"
                                        value={tableName}
                                        onChange={(e) => setTableName(e.target.value)}
                                        placeholder="e.g., users"
                                        className="w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">
                                            Columns
                                        </label>
                                        <button
                                            onClick={handleAddColumn}
                                            className="text-xs flex items-center gap-1 text-primary hover:underline"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Add Column
                                        </button>
                                    </div>

                                    <div className="rounded-md border">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-medium">Name</th>
                                                    <th className="px-4 py-2 text-left font-medium">Type</th>
                                                    <th className="px-4 py-2 text-center font-medium w-20">PK</th>
                                                    <th className="px-4 py-2 text-center font-medium w-20">Null</th>
                                                    <th className="px-4 py-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {columns.map((col) => (
                                                    <tr key={col.id} className="group hover:bg-muted/30">
                                                        <td className="p-2">
                                                            <input
                                                                type="text"
                                                                value={col.name}
                                                                onChange={(e) => updateColumn(col.id, "name", e.target.value)}
                                                                placeholder="column_name"
                                                                className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <select
                                                                value={col.type}
                                                                onChange={(e) => updateColumn(col.id, "type", e.target.value)}
                                                                className="w-full rounded border-transparent bg-transparent px-2 py-1 focus:border-primary focus:bg-background outline-none"
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
                                                        <td className="p-2 text-center">
                                                            <button
                                                                onClick={() => handleRemoveColumn(col.id)}
                                                                className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t bg-muted/5 px-6 py-4">
                        <button
                            onClick={onClose}
                            className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                        >
                            Cancel
                        </button>
                            <button
                                onClick={handleSave}
                                disabled={!tableName || columns.length === 0 || isSaving}
                                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Create Table
                            </button>
                    </div>
                </div>
            </div>

            <AlertModal
                isOpen={alert.isOpen}
                onClose={handleAlertClose}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />
        </>
    );
}
