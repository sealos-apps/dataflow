import React, { useState, useEffect } from "react";
import { X, Database, Save, Loader2 } from "lucide-react";
import { useConnections } from "@/contexts/ConnectionContext";

interface EditDatabaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    onSuccess?: () => void;
}

export function EditDatabaseModal({ isOpen, onClose, connectionId, databaseName, onSuccess }: EditDatabaseModalProps) {
    const { updateDatabase } = useConnections();
    const [newName, setNewName] = useState(databaseName);
    const [charset, setCharset] = useState("utf8mb4");
    const [collation, setCollation] = useState("utf8mb4_general_ci");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setNewName(databaseName);
    }, [databaseName]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!newName || newName === databaseName) return;

        setIsSaving(true);
        const success = await updateDatabase(connectionId, databaseName, newName);
        setIsSaving(false);

        if (success && onSuccess) {
            onSuccess();
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Database className="h-5 w-5 text-purple-500" />
                        Edit Database
                    </h2>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Database Name
                        </label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Enter database name"
                            className="w-full rounded-md border border-purple-200 bg-background px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Character Set
                            </label>
                            <div className="relative">
                                <select
                                    value={charset}
                                    onChange={(e) => setCharset(e.target.value)}
                                    className="w-full appearance-none rounded-md border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-purple-500"
                                >
                                    <option value="utf8mb4">utf8mb4</option>
                                    <option value="utf8">utf8</option>
                                    <option value="latin1">latin1</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Collation
                            </label>
                            <div className="relative">
                                <select
                                    value={collation}
                                    onChange={(e) => setCollation(e.target.value)}
                                    className="w-full appearance-none rounded-md border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-purple-500"
                                >
                                    <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                                    <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</option>
                                    <option value="utf8mb4_bin">utf8mb4_bin</option>
                                </select>
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
                        disabled={!newName || isSaving}
                        className="rounded-md bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
