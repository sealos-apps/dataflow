import React, { useState, useEffect } from "react";
import { X, Download, FileJson, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/useConnectionStore";

interface ExportRedisModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    initialPattern?: string;
    initialTypes?: string[];
}

type ExportFormat = 'csv' | 'json';

export function ExportRedisModal({
    isOpen,
    onClose,
    connectionId,
    databaseName,
    initialPattern = "*",
    initialTypes = []
}: ExportRedisModalProps) {
    const { connections } = useConnectionStore();
    const [format, setFormat] = useState<ExportFormat>('json');
    const [pattern, setPattern] = useState(initialPattern);
    const [types, setTypes] = useState<string[]>(initialTypes);
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormat('json');
            setPattern(initialPattern);
            setTypes(initialTypes);
            setIsExporting(false);
            setProgress(0);
            setIsSuccess(false);
            setDownloadUrl(null);
        }
    }, [isOpen, initialPattern, initialTypes]);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setProgress(0);
        setIsSuccess(false);

        const conn = connections.find(c => c.id === connectionId);
        if (!conn) {
            console.error('Connection not found');
            setIsExporting(false);
            return;
        }

        try {
            const response = await fetch('/api/connections/redis/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: conn.host,
                    port: conn.port,
                    password: conn.password,
                    database: databaseName,
                    pattern,
                    types,
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
                            if (data.progress) setProgress(data.progress);
                            if (data.downloadUrl) setDownloadUrl(data.downloadUrl);
                        } catch {
                            // Skip malformed JSON lines
                            console.warn('Failed to parse SSE data:', line);
                        }
                    }
                }
            }

            // Process any remaining data in the buffer
            if (buffer.startsWith('data: ')) {
                try {
                    const data = JSON.parse(buffer.slice(6));
                    if (data.progress) setProgress(data.progress);
                    if (data.downloadUrl) setDownloadUrl(data.downloadUrl);
                } catch {
                    // Ignore final incomplete data
                }
            }

            setIsSuccess(true);
        } catch (error) {
            console.error('Export failed:', error);
            // Handle error state here if needed
        } finally {
            setIsExporting(false);
        }
    };

    const formatOptions = [
        { id: 'json', label: 'JSON', icon: FileJson },
        { id: 'csv', label: 'CSV', icon: FileText },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[500px] bg-background border rounded-lg shadow-lg flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">Export Redis Data</h2>
                        <p className="text-sm text-muted-foreground">
                            Database: {databaseName}
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
                        <div className="grid grid-cols-2 gap-3">
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

                    {/* Key Pattern */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Key Pattern</label>
                        <div className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md bg-muted/30 text-muted-foreground cursor-not-allowed">
                            {pattern}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Exporting keys matching the current filter pattern.
                        </p>
                    </div>

                    {/* Types Filter */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Data Types</label>
                        <div className="flex flex-wrap gap-2">
                            {['string', 'hash', 'list', 'set', 'zset', 'stream'].map(t => {
                                const isSelected = types.includes(t);
                                return (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            if (isSelected) {
                                                setTypes(types.filter(type => type !== t));
                                            } else {
                                                setTypes([...types, t]);
                                            }
                                        }}
                                        disabled={isExporting}
                                        className={cn(
                                            "px-2 py-1 text-xs font-medium rounded-md border transition-all uppercase",
                                            isSelected
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                                        )}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {types.length === 0
                                ? "Exporting all data types."
                                : `Exporting only: ${types.join(', ')}`}
                        </p>
                    </div>


                    {/* Progress Bar */}
                    {(isExporting || isSuccess) && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {isSuccess ? "Export complete!" : "Exporting..."}
                                </span>
                                <span className="font-medium">{progress}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-300 ease-out",
                                        isSuccess ? "bg-green-500" : "bg-primary"
                                    )}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
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
                            download={`redis_export_${databaseName}_${new Date().getTime()}.${format}`}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
                            onClick={(e) => {
                                if (!downloadUrl) e.preventDefault();
                                onClose();
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
