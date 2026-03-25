import React, { useState } from "react";
import { X, Eraser, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useConnections } from "@/contexts/ConnectionContext";
import { Button } from "@/components/ui/Button";

interface EmptyTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    tableName: string;
    onSuccess?: () => void;
}

export function EmptyTableModal({ isOpen, onClose, connectionId, databaseName, tableName, onSuccess }: EmptyTableModalProps) {
    const { connections } = useConnections();
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    if (!isOpen) return null;

    const handleEmpty = async () => {
        setIsProcessing(true);
        setResult(null);

        const conn = connections.find(c => c.id === connectionId);
        if (!conn) {
            setResult({ success: false, message: "Connection not found" });
            setIsProcessing(false);
            return;
        }

        try {
            const response = await fetch('/api/connections/empty-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: conn.type.toLowerCase(),
                    host: conn.host,
                    port: conn.port,
                    user: conn.user,
                    password: conn.password,
                    database: databaseName,
                    table: tableName
                }),
            });

            const data = await response.json();
            if (data.success) {
                setResult({ success: true, message: `Table "${tableName}" has been emptied successfully.` });
                if (onSuccess) onSuccess();
            } else {
                setResult({ success: false, message: data.error || "Failed to empty table" });
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
                        <Eraser className="h-5 w-5 text-orange-500" />
                        Empty Table
                    </h2>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {!result ? (
                        <>
                            <div className="rounded-lg bg-orange-50 p-4 text-sm text-orange-800 border border-orange-100">
                                <p className="font-medium">Warning: This will remove ALL data from the table.</p>
                                <p className="mt-1">
                                    Are you sure you want to empty table <strong>{tableName}</strong>? This action cannot be undone.
                                </p>
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
                                onClick={handleEmpty}
                                disabled={isProcessing}
                                className="bg-orange-600 hover:bg-orange-700 text-white"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Emptying...
                                    </>
                                ) : (
                                    "Confirm Empty"
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
