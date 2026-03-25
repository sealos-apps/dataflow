import React, { useState, useEffect, useRef } from "react";
import { Upload, X, Loader2, FileJson, FileType, CheckCircle2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useConnections } from "@/contexts/ConnectionContext";

interface ImportCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    collectionName: string;
    onSuccess?: () => void;
}

export function ImportCollectionModal({ isOpen, onClose, connectionId, databaseName, collectionName, onSuccess }: ImportCollectionModalProps) {
    const { connections } = useConnections();
    const [format, setFormat] = useState<'json' | 'csv'>('json');
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [insertedCount, setInsertedCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormat('json');
            setFile(null);
            setIsImporting(false);
            setProgress(0);
            setProgressMessage('');
            setIsSuccess(false);
            setInsertedCount(0);
            setError(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleImport = async () => {
        if (!file) {
            setError("Please select a file to import");
            return;
        }

        setIsImporting(true);
        setProgress(0);
        setProgressMessage('Reading file...');
        setError(null);

        try {
            // Get connection details
            const connection = connections.find(c => c.id === connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }

            // Read file content and encode as base64
            const fileContent = await readFileAsBase64(file);

            const response = await fetch('/api/connections/import-collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connectionId,
                    databaseName,
                    collectionName,
                    format,
                    fileContent,
                    // Pass connection details
                    type: connection.type,
                    host: connection.host,
                    port: connection.port,
                    user: connection.user,
                    password: connection.password
                }),
            });

            // Handle SSE streaming
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Failed to read response stream');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.error) {
                                setError(data.error);
                                setIsImporting(false);
                                return;
                            }

                            if (data.progress !== undefined) {
                                setProgress(data.progress);
                            }
                            if (data.message) {
                                setProgressMessage(data.message);
                            }
                            if (data.insertedCount !== undefined) {
                                setInsertedCount(data.insertedCount);
                            }

                            // Handle completion
                            if (data.progress === 100) {
                                setIsSuccess(true);
                                onSuccess?.();
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete data
                        }
                    }
                }
            }

        } catch (e: any) {
            setError(e.message || 'An error occurred');
        } finally {
            setIsImporting(false);
        }
    };

    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data URL prefix (e.g., "data:application/json;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-lg rounded-xl shadow-nebula-modal border animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        Import Collection
                    </h3>
                    {!isImporting && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8 rounded-full"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                            </div>
                            <h4 className="text-lg font-medium text-foreground">Import Successful!</h4>
                            <p className="text-sm text-muted-foreground text-center">
                                {insertedCount > 0
                                    ? `${insertedCount} documents imported into `
                                    : 'Data has been imported into '
                                }
                                <strong>{collectionName}</strong>.
                            </p>
                            <Button onClick={onClose} className="mt-4">
                                Close
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Format Selection */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-muted-foreground">Import Format</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        className={cn(
                                            "border rounded-lg p-4 cursor-pointer transition-all hover:bg-muted/50 flex items-center gap-3",
                                            format === 'json' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                                        )}
                                        onClick={() => setFormat('json')}
                                    >
                                        <div className="p-2 bg-yellow-500/10 rounded-md">
                                            <FileJson className="h-5 w-5 text-yellow-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">JSON</p>
                                            <p className="text-xs text-muted-foreground">JavaScript Object Notation</p>
                                        </div>
                                    </div>
                                    <div
                                        className={cn(
                                            "border rounded-lg p-4 cursor-pointer transition-all hover:bg-muted/50 flex items-center gap-3",
                                            format === 'csv' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                                        )}
                                        onClick={() => setFormat('csv')}
                                    >
                                        <div className="p-2 bg-green-500/10 rounded-md">
                                            <FileType className="h-5 w-5 text-green-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">CSV</p>
                                            <p className="text-xs text-muted-foreground">Comma Separated Values</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* File Upload */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-muted-foreground">Select File</label>
                                <div
                                    className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-muted/5 hover:bg-muted/20"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept={format === 'json' ? '.json' : '.csv'}
                                        onChange={handleFileChange}
                                        disabled={isImporting}
                                    />
                                    {file ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <FileUp className="h-8 w-8 text-primary" />
                                            <p className="text-sm font-medium">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {(file.size / 1024).toFixed(2)} KB
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground">
                                                Click to upload or drag and drop
                                            </p>
                                            <p className="text-xs text-muted-foreground/70">
                                                {format === 'json' ? '*.json files' : '*.csv files'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Progress & Error */}
                            {isImporting && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{progressMessage || 'Importing...'}</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-200"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                                    <X className="h-4 w-4 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {!isSuccess && (
                    <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30 rounded-b-xl">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isImporting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={isImporting || !file}
                            className="gap-2"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Import Data
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
