import React, { useState, useEffect } from "react";
import { X, Table, Loader2 } from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";

import { AlertModal } from "@/components/ui/AlertModal";

interface RenameTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    databaseName: string;
    schema?: string;
    tableName: string;
    onSuccess?: () => void;
}

export function RenameTableModal({ isOpen, onClose, databaseName, schema, tableName, onSuccess }: RenameTableModalProps) {
    const { renameTable } = useConnectionStore();
    const [newName, setNewName] = useState(tableName);
    const [isSaving, setIsSaving] = useState(false);

    // Alert State
    const [alert, setAlert] = useState<{
        isOpen: boolean;
        type: 'success' | 'error';
        title: string;
        message: string;
    }>({
        isOpen: false,
        type: 'success',
        title: '',
        message: ''
    });

    useEffect(() => {
        setNewName(tableName);
    }, [tableName]);

    if (!isOpen) return null;

    const handleRename = async () => {
        if (!newName.trim() || newName === tableName) return;

        setIsSaving(true);
        try {
            const result = await renameTable(databaseName, schema, tableName, newName);
            if (result.success) {
                setAlert({
                    isOpen: true,
                    type: 'success',
                    title: 'Table Renamed',
                    message: `Table renamed from "${tableName}" to "${newName}".`
                });
            } else {
                setAlert({
                    isOpen: true,
                    type: 'error',
                    title: 'Rename Failed',
                    message: result.message ?? "Failed to rename table."
                });
            }
        } catch (error) {
            setAlert({
                isOpen: true,
                type: 'error',
                title: 'Rename Failed',
                message: error instanceof Error ? error.message : "An unknown error occurred while renaming the table."
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
                <div className="w-full max-w-md rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between border-b px-6 py-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Table className="h-5 w-5 text-blue-500" />
                            Rename Table
                        </h2>
                        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Current Name
                            </label>
                            <input
                                value={tableName}
                                disabled
                                className="w-full rounded-md border bg-muted/50 px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                New Name
                            </label>
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Enter new table name"
                                autoFocus
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
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
                            onClick={handleRename}
                            disabled={isSaving || !newName.trim() || newName === tableName}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Rename
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
