import React, { useState } from "react";
import { AlertModal } from "@/components/ui/AlertModal";
import { X, Database, Save, Loader2 } from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { resolveSchemaParam } from "@/utils/database-features";

interface CreateCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    onSuccess?: () => void;
}

export function CreateCollectionModal({ isOpen, onClose, connectionId, databaseName, onSuccess }: CreateCollectionModalProps) {
    const { createTable, connections } = useConnectionStore();
    const [collectionName, setCollectionName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

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

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!collectionName) return;

        setIsSaving(true);
        try {
            const conn = connections.find(c => c.id === connectionId);
            const schemaParam = resolveSchemaParam(conn?.type, databaseName);

            const result = await createTable(databaseName, schemaParam, collectionName, []);

            if (result.success) {
                setAlert({
                    isOpen: true,
                    type: 'success',
                    title: 'Collection Created',
                    message: result.message ?? `Collection "${collectionName}" has been successfully created.`,
                });
            } else {
                setAlert({
                    isOpen: true,
                    type: 'error',
                    title: 'Creation Failed',
                    message: result.message ?? 'Failed to create collection.',
                });
            }
        } catch (error) {
            setAlert({
                isOpen: true,
                type: 'error',
                title: 'Creation Failed',
                message: error instanceof Error ? error.message : "An unknown error occurred while creating the collection."
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
                <div className="w-full max-w-md rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200 flex flex-col">
                    <div className="flex items-center justify-between border-b px-6 py-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Database className="h-5 w-5 text-green-500" />
                            Create Collection
                        </h2>
                        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6">
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                            Collection Name
                        </label>
                        <input
                            type="text"
                            value={collectionName}
                            onChange={(e) => setCollectionName(e.target.value)}
                            placeholder="e.g., users"
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                            onKeyDown={(e) => { if (e.key === "Enter" && collectionName) handleSave(); }}
                            autoFocus
                        />
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
                            disabled={!collectionName || isSaving}
                            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Create Collection
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
