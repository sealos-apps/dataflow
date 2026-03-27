import React, { useState, useEffect } from "react";
import { X, Download, FileJson, FileSpreadsheet, FileCode, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRawExecuteLazyQuery } from "@/generated/graphql";
import { toCSV, toJSON, toSQL, toExcel, downloadBlob } from "@/utils/export-utils";

interface ExportDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    schema?: string | null;
    tableName: string;
}

type ExportFormat = 'csv' | 'json' | 'sql' | 'excel';

const FORMAT_OPTIONS = [
    { id: 'csv' as const, label: 'CSV', icon: FileText },
    { id: 'json' as const, label: 'JSON', icon: FileJson },
    { id: 'sql' as const, label: 'SQL', icon: FileCode },
    { id: 'excel' as const, label: 'Excel', icon: FileSpreadsheet },
];

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
    csv: 'csv',
    json: 'json',
    sql: 'sql',
    excel: 'xlsx',
};

export function ExportDataModal({
    isOpen,
    onClose,
    connectionId,
    databaseName,
    schema,
    tableName
}: ExportDataModalProps) {
    const [format, setFormat] = useState<ExportFormat>('csv');
    const [rowCount, setRowCount] = useState<number | ''>(1000);
    const [filter, setFilter] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [executeQuery] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' });

    useEffect(() => {
        if (isOpen) {
            setFormat('csv');
            setRowCount(1000);
            setFilter("");
            setIsExporting(false);
            setIsSuccess(false);
            setErrorMessage(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setIsSuccess(false);
        setErrorMessage(null);

        try {
            const qualifiedName = schema ? `${schema}.${tableName}` : tableName;
            let query = `SELECT * FROM ${qualifiedName}`;
            if (filter.trim()) query += ` WHERE ${filter.trim()}`;
            if (rowCount !== '') query += ` LIMIT ${rowCount}`;

            const { data, error } = await executeQuery({
                variables: { query },
                context: { database: databaseName },
            });

            if (error) throw new Error(error.message);
            if (!data?.RawExecute) throw new Error('No data returned from query');

            const { Columns, Rows } = data.RawExecute;
            let blob: Blob;

            switch (format) {
                case 'csv':
                    blob = toCSV(Columns, Rows);
                    break;
                case 'json':
                    blob = toJSON(Columns, Rows);
                    break;
                case 'sql':
                    blob = toSQL(qualifiedName, Columns, Rows);
                    break;
                case 'excel':
                    blob = toExcel(tableName, Columns, Rows);
                    break;
            }

            downloadBlob(blob, `${tableName}.${FORMAT_EXTENSIONS[format]}`);
            setIsSuccess(true);
        } catch (err: any) {
            setErrorMessage(err.message || 'Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[500px] bg-background border rounded-lg shadow-lg flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">Export Data</h2>
                        <p className="text-sm text-muted-foreground">
                            {schema ? `${databaseName}.${schema}.${tableName}` : `${databaseName}.${tableName}`}
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
                            {FORMAT_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setFormat(option.id)}
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

                    {/* Row Count */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Row Limit</label>
                        <input
                            type="number"
                            value={rowCount}
                            onChange={(e) => setRowCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                            placeholder="Leave empty for all rows"
                            disabled={isExporting}
                            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty to export all rows (warning: large tables may take time)
                        </p>
                    </div>

                    {/* Filter */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Filter Data (Optional)</label>
                        <textarea
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Enter SQL WHERE clause (e.g., id > 100 AND status = 'active')"
                            disabled={isExporting}
                            className="w-full h-24 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none font-mono"
                        />
                    </div>

                    {/* Status */}
                    {(isExporting || isSuccess || errorMessage) && (
                        <div className="space-y-2 pt-2">
                            <div className="flex items-center gap-2 text-sm">
                                {isExporting && (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        <span className="text-muted-foreground">Exporting...</span>
                                    </>
                                )}
                                {isSuccess && (
                                    <span className="text-green-600 font-medium">Export complete! File downloaded.</span>
                                )}
                                {errorMessage && (
                                    <span className="text-red-600">{errorMessage}</span>
                                )}
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
                        {isSuccess ? 'Close' : 'Cancel'}
                    </button>
                    {!isSuccess && (
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
