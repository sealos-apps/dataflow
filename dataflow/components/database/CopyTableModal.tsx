import React, { useState } from "react";
import { X, Copy, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useConnections } from "@/contexts/ConnectionContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface CopyTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    tableName: string;
    onSuccess?: () => void;
}

export function CopyTableModal({ isOpen, onClose, connectionId, databaseName, tableName, onSuccess }: CopyTableModalProps) {
    const { connections } = useConnections();
    const [newTableName, setNewTableName] = useState(`${tableName}_copy`);
    const [copyOption, setCopyOption] = useState<"structure" | "structure_data">("structure_data");
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    if (!isOpen) return null;

    const handleCopy = async () => {
        if (!newTableName.trim()) return;

        setIsProcessing(true);
        setResult(null);

        const conn = connections.find(c => c.id === connectionId);
        if (!conn) {
            setResult({ success: false, message: "Connection not found" });
            setIsProcessing(false);
            return;
        }

        try {
            const response = await fetch('/api/connections/copy-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: conn.type.toLowerCase(),
                    host: conn.host,
                    port: conn.port,
                    user: conn.user,
                    password: conn.password,
                    database: databaseName,
                    sourceTable: tableName,
                    targetTable: newTableName,
                    copyData: copyOption === "structure_data"
                }),
            });

            const data = await response.json();
            if (data.success) {
                setResult({ success: true, message: `Table copied successfully to "${newTableName}".` });
                if (onSuccess) onSuccess();
            } else {
                setResult({ success: false, message: data.error || "Failed to copy table" });
            }
        } catch (error: any) {
            setResult({ success: false, message: error.message || "An error occurred" });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                        <Copy className="h-5 w-5 text-primary" />
                        Copy Table
                    </h2>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!result ? (
                        <>
                            <div className="space-y-2">
                                <label htmlFor="source-table" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Source Table</label>
                                <Input id="source-table" value={tableName} disabled className="bg-muted" />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="target-table" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">New Table Name</label>
                                <Input
                                    id="target-table"
                                    value={newTableName}
                                    onChange={(e) => setNewTableName(e.target.value)}
                                    placeholder="Enter new table name"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Copy Options</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="radio"
                                            id="structure"
                                            name="copyOption"
                                            value="structure"
                                            checked={copyOption === "structure"}
                                            onChange={(e) => setCopyOption(e.target.value as any)}
                                            className="h-4 w-4 border-primary text-primary ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        />
                                        <label htmlFor="structure" className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Structure Only</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="radio"
                                            id="structure_data"
                                            name="copyOption"
                                            value="structure_data"
                                            checked={copyOption === "structure_data"}
                                            onChange={(e) => setCopyOption(e.target.value as any)}
                                            className="h-4 w-4 border-primary text-primary ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        />
                                        <label htmlFor="structure_data" className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Structure and Data</label>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className={`rounded-lg p-4 text-sm border flex items-start gap-3 ${result.success
                            ? "bg-green-50 text-green-800 border-green-100"
                            : "bg-red-50 text-red-800 border-red-100"
                            }`}>
                            {result.success ? (
                                <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                            ) : (
                                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                            )}
                            <div>
                                <p className="font-medium">{result.success ? "Success" : "Error"}</p>
                                <p className="mt-1">{result.message}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t bg-muted/5 px-6 py-4">
                    {!result ? (
                        <>
                            <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCopy}
                                disabled={isProcessing || !newTableName.trim()}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Copying...
                                    </>
                                ) : (
                                    "Copy Table"
                                )}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={onClose}>
                            Close
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
