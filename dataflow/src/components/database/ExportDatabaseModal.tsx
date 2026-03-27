import React, { useState, useEffect } from "react";
import { X, Download, FileJson, FileSpreadsheet, FileCode, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRawExecuteLazyQuery, useGetStorageUnitsLazyQuery } from "@/generated/graphql";
import { toCSV, toJSON, toSQL, toExcel, downloadBlob } from "@/utils/export-utils";
import JSZip from "jszip";

interface ExportDatabaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    databaseName: string;
    schema: string;
}

type ExportFormat = 'csv' | 'json' | 'sql' | 'excel';

const FORMAT_OPTIONS = [
    { id: 'sql' as const, label: 'SQL', icon: FileCode },
    { id: 'json' as const, label: 'JSON', icon: FileJson },
    { id: 'csv' as const, label: 'CSV', icon: FileText },
    { id: 'excel' as const, label: 'Excel', icon: FileSpreadsheet },
];

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
    csv: 'csv',
    json: 'json',
    sql: 'sql',
    excel: 'xlsx',
};

export function ExportDatabaseModal({
    isOpen,
    onClose,
    connectionId,
    databaseName,
    schema
}: ExportDatabaseModalProps) {
    const [format, setFormat] = useState<ExportFormat>('sql');
    const [isExporting, setIsExporting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [progressText, setProgressText] = useState("");
    const [progressPercent, setProgressPercent] = useState(0);

    const [fetchTables] = useGetStorageUnitsLazyQuery({ fetchPolicy: 'no-cache' });
    const [executeQuery] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' });

    useEffect(() => {
        if (isOpen) {
            setFormat('sql');
            setIsExporting(false);
            setIsSuccess(false);
            setErrorMessage(null);
            setProgressText("");
            setProgressPercent(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setIsSuccess(false);
        setErrorMessage(null);
        setProgressText("Fetching table list...");
        setProgressPercent(0);

        try {
            const { data: tablesData, error: tablesError } = await fetchTables({
                variables: { schema },
                context: { database: databaseName },
            });

            if (tablesError) throw new Error(tablesError.message);
            const tables = tablesData?.StorageUnit ?? [];
            if (tables.length === 0) throw new Error('No tables found in database');

            const zip = new JSZip();
            const failedTables: string[] = [];

            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                const tableName = table.Name;
                setProgressText(`Exporting table ${i + 1} of ${tables.length}... (${tableName})`);
                setProgressPercent(Math.round((i / tables.length) * 100));

                try {
                    const qualifiedName = schema ? `${schema}.${tableName}` : tableName;
                    const { data, error } = await executeQuery({
                        variables: { query: `SELECT * FROM ${qualifiedName}` },
                        context: { database: databaseName },
                    });

                    if (error || !data?.RawExecute) {
                        failedTables.push(tableName);
                        continue;
                    }

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

                    zip.file(`${tableName}.${FORMAT_EXTENSIONS[format]}`, blob);
                } catch {
                    failedTables.push(tableName);
                }
            }

            setProgressText("Generating zip file...");
            setProgressPercent(95);

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(zipBlob, `export_${databaseName}.zip`);

            setProgressPercent(100);
            setIsSuccess(true);

            if (failedTables.length > 0) {
                setErrorMessage(
                    `Exported ${tables.length - failedTables.length} of ${tables.length} tables. Failed: ${failedTables.join(', ')}`
                );
            }
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
                        <h2 className="text-lg font-semibold">Export Database</h2>
                        <p className="text-sm text-muted-foreground">{databaseName}</p>
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

                    {/* Progress */}
                    {(isExporting || isSuccess || errorMessage) && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-sm">
                                <span className={cn(
                                    "text-muted-foreground",
                                    errorMessage && !isSuccess && "text-red-600"
                                )}>
                                    {isSuccess ? "Export complete!" : isExporting ? progressText : "Export failed"}
                                </span>
                                {(isExporting || isSuccess) && <span className="font-medium">{progressPercent}%</span>}
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-300 ease-out",
                                        errorMessage && !isSuccess
                                            ? "bg-red-500"
                                            : isSuccess
                                                ? "bg-green-500"
                                                : "bg-primary"
                                    )}
                                    style={{ width: `${errorMessage && !isSuccess ? 100 : progressPercent}%` }}
                                />
                            </div>
                            {errorMessage && (
                                <p className={cn(
                                    "text-sm mt-1",
                                    isSuccess ? "text-amber-600" : "text-red-600"
                                )}>
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
