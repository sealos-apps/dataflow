import React, { useState } from "react";
import { X, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { useConnections } from "@/contexts/ConnectionContext";

interface DeleteDatabaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    onSuccess?: () => void;
}

export function DeleteDatabaseModal({ isOpen, onClose, connectionId, databaseName, onSuccess }: DeleteDatabaseModalProps) {
    const { deleteDatabase } = useConnections();
    const [confirmName, setConfirmName] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen) return null;

    const handleDelete = async () => {
        if (confirmName !== databaseName) return;

        setIsDeleting(true);
        const success = await deleteDatabase(connectionId, databaseName);
        setIsDeleting(false);

        if (success && onSuccess) {
            onSuccess();
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Delete Database
                    </h2>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-100">
                        <p className="font-medium">Warning: This action cannot be undone.</p>
                        <p className="mt-1">
                            This will permanently delete the database <strong>{databaseName}</strong> and all its contents.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Type database name to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder={databaseName}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
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
                        onClick={handleDelete}
                        disabled={confirmName !== databaseName || isDeleting}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete Database
                    </button>
                </div>
            </div>
        </div>
    );
}
