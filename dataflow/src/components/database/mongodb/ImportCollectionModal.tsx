import React, { useState, useEffect, useRef } from "react";
import { Upload, X, Loader2, FileJson, FileType, CheckCircle2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useAddRowMutation } from '@graphql';
import { resolveSchemaParam } from '@/utils/database-features';

interface ImportCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    collectionName: string;
    onSuccess?: () => void;
}

export function ImportCollectionModal({ isOpen, onClose, connectionId, databaseName, collectionName, onSuccess }: ImportCollectionModalProps) {
    const { connections } = useConnectionStore();
    const [addRowMutation] = useAddRowMutation();
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
        if (!file) { setError("Please select a file to import"); return; }
        setIsImporting(true);
        setProgress(0);
        setProgressMessage('Reading file...');
        setError(null);

        try {
            const connection = connections.find(c => c.id === connectionId);
            if (!connection) throw new Error('Connection not found');

            const graphqlSchema = resolveSchemaParam(connection.type, databaseName);
            const fileText = await file.text();

            let documents: Record<string, any>[];
            if (format === 'json') {
                const parsed = JSON.parse(fileText);
                documents = Array.isArray(parsed) ? parsed : [parsed];
            } else {
                const lines = fileText.split('\n').filter(l => l.trim());
                if (lines.length < 2) throw new Error('CSV file must have a header row and at least one data row');
                const headers = lines[0].split(',').map(h => h.trim());
                documents = lines.slice(1).map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const doc: Record<string, string> = {};
                    headers.forEach((h, i) => { doc[h] = values[i] ?? ''; });
                    return doc;
                });
            }

            if (documents.length === 0) throw new Error('No documents found in file');
            setProgressMessage(`Importing ${documents.length} documents...`);

            let successCount = 0;
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                const values = Object.entries(doc)
                    .filter(([key]) => key !== '_id')
                    .map(([key, value]) => ({
                        Key: key,
                        Value: typeof value === 'object' && value !== null
                            ? JSON.stringify(value) : String(value ?? ''),
                    }));

                const { data: result, errors } = await addRowMutation({
                    variables: { schema: graphqlSchema, storageUnit: collectionName, values },
                    context: { database: databaseName },
                });

                if (errors?.length) throw new Error(`Failed at document ${i + 1}: ${errors[0].message}`);
                if (result?.AddRow.Status) successCount++;

                setProgress(Math.round(((i + 1) / documents.length) * 100));
                setProgressMessage(`Imported ${successCount} of ${documents.length} documents...`);
                setInsertedCount(successCount);
            }

            setIsSuccess(true);
            onSuccess?.();
        } catch (e: any) {
            setError(e.message || 'An error occurred');
        } finally {
            setIsImporting(false);
        }
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
