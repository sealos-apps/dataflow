import React, { useState, useEffect } from "react";
import { Download, X, Loader2, FileJson, FileType, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { useConnections } from "@/contexts/ConnectionContext";

interface ExportCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    collectionName: string;
}

export function ExportCollectionModal({ isOpen, onClose, connectionId, databaseName, collectionName }: ExportCollectionModalProps) {
    const { connections } = useConnections();
    const [format, setFormat] = useState<'json' | 'csv'>('json');
    const [filter, setFilter] = useState('');
    const [limit, setLimit] = useState<number | ''>('');
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormat('json');
            setFilter('');
            setLimit('');
            setIsExporting(false);
            setProgress(0);
            setProgressMessage('');
            setIsSuccess(false);
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setProgress(0);
        setProgressMessage('Starting export...');
        setError(null);

        try {
            // Get connection details
            const connection = connections.find(c => c.id === connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }

            // Parse filter JSON
            let filterObj = {};
            if (filter.trim()) {
                try {
                    filterObj = JSON.parse(filter);
                } catch (e) {
                    throw new Error('Invalid filter JSON format');
                }
            }

            const response = await fetch('/api/connections/export-collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connectionId,
                    databaseName,
                    collectionName,
                    format,
                    filter: filterObj,
                    limit: limit || undefined,
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
                                setIsExporting(false);
                                return;
                            }

                            if (data.progress !== undefined) {
                                setProgress(data.progress);
                            }
                            if (data.message) {
                                setProgressMessage(data.message);
                            }

                            // Handle download when export is complete
                            if (data.downloadUrl && data.progress === 100) {
                                const link = document.createElement('a');
                                link.href = data.downloadUrl;
                                link.download = data.fileName || `${collectionName}_export.${format}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);

                                setIsSuccess(true);
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
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-lg rounded-xl shadow-nebula-modal border animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        Export Collection
                    </h3>
                    {!isExporting && (
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
                            <h4 className="text-lg font-medium text-foreground">Export Successful!</h4>
                            <p className="text-sm text-muted-foreground text-center">
                                Your data has been exported to {format.toUpperCase()} format.
                            </p>
                            <Button onClick={onClose} className="mt-4">
                                Close
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Format Selection */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-muted-foreground">Export Format</label>
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

                            {/* Options */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Filter Query (Optional)</label>
                                    <Input
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        placeholder='{ "status": "active" }'
                                        className="font-mono text-sm"
                                        disabled={isExporting}
                                    />
                                    <p className="text-xs text-muted-foreground">Enter a MongoDB query document to filter results.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Limit Rows (Optional)</label>
                                    <Input
                                        type="number"
                                        value={limit}
                                        onChange={(e) => setLimit(e.target.value ? parseInt(e.target.value) : '')}
                                        placeholder="No limit"
                                        className="font-mono text-sm"
                                        min={1}
                                        disabled={isExporting}
                                    />
                                </div>
                            </div>

                            {/* Progress & Error */}
                            {isExporting && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{progressMessage || 'Exporting...'}</span>
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
                            disabled={isExporting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="gap-2"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" />
                                    Export Data
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
