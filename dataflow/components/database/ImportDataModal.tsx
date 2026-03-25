import React, { useState, useEffect, useRef } from "react";
import { X, Upload, FileJson, FileSpreadsheet, FileCode, FileText, Loader2, CheckCircle, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnections } from "@/contexts/ConnectionContext";

interface ImportDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    schema?: string | null;
    tableName?: string; // Made optional
    onSuccess?: () => void; // Callback when import succeeds
}

type ImportFormat = 'csv' | 'json' | 'sql' | 'excel';

export function ImportDataModal({
    isOpen,
    onClose,
    connectionId,
    databaseName,
    schema,
    tableName,
    onSuccess
}: ImportDataModalProps) {
    const { connections } = useConnections();
    const [format, setFormat] = useState<ImportFormat>('csv');
    const [file, setFile] = useState<File | null>(null);
    const [targetTableName, setTargetTableName] = useState(tableName || "");
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormat('csv');
            setFile(null);
            setTargetTableName(tableName || "");
            setIsImporting(false);
            setProgress(0);
            setIsSuccess(false);
            setErrorMessage(null);
            setStatusMessage('');
        }
    }, [isOpen, tableName]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            // Auto-fill table name from filename if empty and not provided via props
            if (!tableName && !targetTableName) {
                const nameWithoutExt = e.target.files[0].name.split('.')[0];
                setTargetTableName(nameWithoutExt);
            }
        }
    };

    const handleImport = async () => {
        if (!file || !targetTableName.trim()) return;

        const conn = connections.find(c => c.id === connectionId);
        if (!conn) {
            console.error('Connection not found');
            return;
        }

        setIsImporting(true);
        setProgress(0);
        setIsSuccess(false);

        try {
            // Create FormData to send file
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', conn.type.toLowerCase());
            formData.append('host', conn.host);
            formData.append('port', conn.port);
            formData.append('user', conn.user);
            formData.append('password', conn.password);
            formData.append('database', databaseName);
            if (schema) formData.append('schema', schema);
            formData.append('table', targetTableName);
            formData.append('format', format);

            const response = await fetch('/api/connections/import-data', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to start import');
            }

            // Read streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No response body');

            let buffer = '';
            let lastProgress = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');

                // Keep the last incomplete line in buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.progress !== undefined) {
                                lastProgress = data.progress;
                                setProgress(data.progress);
                            }
                            if (data.message) {
                                setStatusMessage(data.message);
                            }
                            if (data.error) {
                                // Backend returned an error - throw to outer catch
                                throw new Error(data.error);
                            }
                        } catch (e: any) {
                            // Check if this is a business error (has message property) vs JSON parse error
                            if (e instanceof SyntaxError) {
                                // JSON parse error - skip invalid data
                                if (line.slice(6).trim()) {
                                    console.warn('Skipping invalid SSE data:', line);
                                }
                            } else {
                                // Business error from backend - rethrow to outer catch
                                throw e;
                            }
                        }
                    }
                }
            }

            // Process any remaining buffer content
            if (buffer.startsWith('data: ')) {
                try {
                    const data = JSON.parse(buffer.slice(6));
                    if (data.progress !== undefined) {
                        lastProgress = data.progress;
                        setProgress(data.progress);
                    }
                    if (data.message) {
                        setStatusMessage(data.message);
                    }
                    if (data.error) {
                        throw new Error(data.error);
                    }
                } catch (e: any) {
                    if (!(e instanceof SyntaxError)) {
                        throw e;
                    }
                }
            }

            // Only set success if we reached 100% progress
            if (lastProgress >= 100) {
                setIsSuccess(true);
                onSuccess?.();
            } else {
                // If stream ended but progress wasn't 100%, set to 100% and success
                setProgress(100);
                setIsSuccess(true);
                onSuccess?.();
            }
        } catch (error: any) {
            console.error('Import failed:', error);
            setErrorMessage(error.message || 'Import failed');
            setProgress(0);
        } finally {
            setIsImporting(false);
        }
    };

    const formatOptions = [
        { id: 'csv', label: 'CSV', icon: FileText },
        { id: 'json', label: 'JSON', icon: FileJson },
        { id: 'sql', label: 'SQL', icon: FileCode },
        { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[500px] bg-background border rounded-lg shadow-lg flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">Import Data</h2>
                        <p className="text-sm text-muted-foreground">
                            Into {schema ? `${databaseName}.${schema}` : `${databaseName}`}
                            {targetTableName ? `.${targetTableName}` : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 hover:bg-muted transition-colors"
                        disabled={isImporting}
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Table Name Input (only if not provided) */}
                    {!tableName && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Target Table Name</label>
                            <input
                                type="text"
                                value={targetTableName}
                                onChange={(e) => setTargetTableName(e.target.value)}
                                placeholder="Enter table name"
                                disabled={isImporting}
                                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                        </div>
                    )}

                    {/* Format Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Import Format</label>
                        <div className="grid grid-cols-4 gap-3">
                            {formatOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setFormat(option.id as ImportFormat)}
                                    disabled={isImporting}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-md border transition-all",
                                        format === option.id
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : "hover:border-primary/50 hover:bg-muted/50"
                                    )}
                                >
                                    <option.icon className={cn(
                                        "h-6 w-6 mb-2",
                                        format === option.id ? "text-primary" : "text-muted-foreground"
                                    )} />
                                    <span className="text-xs font-medium">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Upload File</label>
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                                file ? "border-primary/50 bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                                isImporting && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => !isImporting && fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept={format === 'csv' ? '.csv' : format === 'json' ? '.json' : format === 'sql' ? '.sql' : '.xlsx,.xls'}
                                onChange={handleFileChange}
                                disabled={isImporting}
                            />

                            {file ? (
                                <div className="flex flex-col items-center gap-2">
                                    <FileUp className="h-8 w-8 text-primary" />
                                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFile(null);
                                        }}
                                        className="text-xs text-red-500 hover:underline mt-2"
                                        disabled={isImporting}
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm font-medium text-foreground">Click to upload file</p>
                                    <p className="text-xs text-muted-foreground">
                                        Supports {format.toUpperCase()} files
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar / Error Message */}
                    {(isImporting || isSuccess || errorMessage) && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-sm">
                                <span className={cn(
                                    "text-muted-foreground",
                                    errorMessage && "text-red-600"
                                )}>
                                    {errorMessage
                                        ? "Import failed"
                                        : isSuccess
                                            ? "Import complete!"
                                            : statusMessage || "Importing..."}
                                </span>
                                {!errorMessage && <span className="font-medium">{progress}%</span>}
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-300 ease-out",
                                        errorMessage
                                            ? "bg-red-500"
                                            : isSuccess
                                                ? "bg-green-500"
                                                : "bg-primary"
                                    )}
                                    style={{ width: errorMessage ? '100%' : `${progress}%` }}
                                />
                            </div>
                            {errorMessage && (
                                <p className="text-sm text-red-600 mt-1">
                                    {errorMessage}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-muted/20 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                    >
                        Cancel
                    </button>

                    {isSuccess ? (
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Done
                        </button>
                    ) : (
                        <button
                            onClick={handleImport}
                            disabled={isImporting || !file}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Start Import
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
