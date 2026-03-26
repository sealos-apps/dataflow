import React, { useState, useEffect } from "react";
import { X, Download, FileJson, FileSpreadsheet, FileCode, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/useConnectionStore";

interface ExportDatabaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
}

type ExportFormat = 'sql' | 'json' | 'csv' | 'excel';

export function ExportDatabaseModal({
    isOpen,
    onClose,
    connectionId,
    databaseName
}: ExportDatabaseModalProps) {
    const { connections } = useConnectionStore();
    const [format, setFormat] = useState<ExportFormat>('sql');
    const [filter, setFilter] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormat('sql');
            setFilter("");
            setIsExporting(false);
            setProgress(0);
            setIsSuccess(false);
            setDownloadUrl(null);
            setErrorMessage(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setProgress(0);
        setIsSuccess(false);
        setDownloadUrl(null);
        setErrorMessage(null);

        const conn = connections.find(c => c.id === connectionId);
        if (!conn) {
            console.error('Connection not found');
            setIsExporting(false);
            return;
        }

        try {
            const response = await fetch('/api/connections/export-database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: conn.type.toLowerCase(),
                    host: conn.host,
                    port: conn.port,
                    user: conn.user,
                    password: conn.password,
                    database: databaseName,
                    format
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to start export');
            }

            // Read streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No response body');

            // Buffer to accumulate incomplete data across chunks
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Append new data to buffer
                buffer += decoder.decode(value, { stream: true });

                // Process complete lines only
                const lines = buffer.split('\n');

                // Keep the last incomplete line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.progress !== undefined) setProgress(data.progress);
                            if (data.downloadUrl) {
                                setDownloadUrl(data.downloadUrl);
                                setProgress(100); // Ensure progress is 100% when download is ready
                                setIsSuccess(true);
                            }
                            if (data.error) throw new Error(data.error);
                        } catch (parseError) {
                            // Ignore parse errors for incomplete chunks
                            console.warn('Failed to parse SSE data:', line.slice(0, 100));
                        }
                    }
                }
            }

            // Process any remaining data in the buffer
            if (buffer.startsWith('data: ')) {
                try {
                    const data = JSON.parse(buffer.slice(6));
                    if (data.progress !== undefined) setProgress(data.progress);
                    if (data.downloadUrl) {
                        setDownloadUrl(data.downloadUrl);
                        setProgress(100);
                        setIsSuccess(true);
                    }
                } catch {
                    // Ignore final incomplete data
                    console.warn('Failed to parse final SSE buffer');
                }
            }
        } catch (error: any) {
            console.error('Export failed:', error);
            setErrorMessage(error.message || 'Export failed');
            setProgress(0);
        } finally {
            setIsExporting(false);
        }
    };

    const formatOptions = [
        { id: 'sql', label: 'SQL', icon: FileCode },
        { id: 'json', label: 'JSON', icon: FileJson },
        { id: 'csv', label: 'CSV', icon: FileText },
        { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[500px] bg-background border rounded-lg shadow-lg flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">Export Database</h2>
                        <p className="text-sm text-muted-foreground">
                            {databaseName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 hover:bg-muted transition-colors"
                        disabled={isExporting}
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Format Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Export Format</label>
                        <div className="grid grid-cols-4 gap-3">
                            {formatOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setFormat(option.id as ExportFormat)}
                                    disabled={isExporting}
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



                    {/* Filter */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Filter Data (Optional)</label>
                        <textarea
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Enter SQL WHERE clause to apply to all tables"
                            disabled={isExporting}
                            className="w-full h-24 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none font-mono"
                        />
                    </div>

                    {/* Progress Bar / Error Message */}
                    {(isExporting || isSuccess || errorMessage) && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-sm">
                                <span className={cn(
                                    "text-muted-foreground",
                                    errorMessage && "text-red-600"
                                )}>
                                    {errorMessage
                                        ? "Export failed"
                                        : isSuccess
                                            ? "Export complete!"
                                            : "Exporting..."}
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
                        disabled={isExporting}
                        className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                    >
                        Cancel
                    </button>

                    {isSuccess ? (
                        <a
                            href={downloadUrl || "#"}
                            download={`export_${databaseName}.${format}`}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
                            onClick={(e) => {
                                if (!downloadUrl) e.preventDefault();
                                // Don't close modal immediately - let user download first
                                // User can close manually via Cancel button or X button
                            }}
                        >
                            <Download className="h-4 w-4" />
                            Download File
                        </a>
                    ) : (
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" />
                                    Start Export
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
