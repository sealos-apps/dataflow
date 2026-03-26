import React, { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";

interface DeleteConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    connectionName: string;
}

export function DeleteConnectionModal({ isOpen, onClose, connectionId, connectionName }: DeleteConnectionModalProps) {
    const { removeConnection } = useConnectionStore();
    const [confirmName, setConfirmName] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen) return null;

    const handleDelete = async () => {
        if (confirmName !== connectionName) return;

        setIsDeleting(true);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        removeConnection(connectionId);
        setIsDeleting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Delete Connection
                    </h2>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        This action cannot be undone. This will permanently delete the connection <span className="font-medium text-foreground">"{connectionName}"</span> and remove all associated metadata from your workspace.
                    </p>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">
                            Type connection name to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder={connectionName}
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
                        disabled={confirmName !== connectionName || isDeleting}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Connection"}
                    </button>
                </div>
            </div>
        </div>
    );
}
