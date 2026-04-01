import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, AlignLeft, CheckCircle, AlertCircle, FileText, Loader2, XCircle, CheckCircle2, GalleryVerticalEnd, PenTool, Database, Network } from "lucide-react";
import { format } from 'sql-formatter';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MonacoEditor from "./MonacoEditorWrapper";
import type { editor } from 'monaco-editor';
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useRawExecuteLazyQuery } from '@graphql';
import { getEditorLanguage, isReadOperation, supportsSchema } from "@/utils/database-features";
import { splitSQLStatements } from '@/utils/sql-split';
import { useTabStore } from "@/stores/useTabStore";
import { useI18n } from "@/i18n/useI18n";

interface SQLEditorViewProps {
    tabId: string;
    context?: {
        connectionId: string;
        databaseName?: string;
        schemaName?: string;
    } | null;
    initialSql?: string;
    onSqlChange?: (sql: string) => void;
    /** Called after a successful read query with the result columns, rows, and execution context. */
    onQueryResults?: (
        columns: string[],
        rows: Record<string, any>[],
        context: { database?: string; schema?: string },
    ) => void;
}

/** SQL editor with integrated database/schema selectors and query execution. */
export function SQLEditorView({ tabId, context, initialSql, onSqlChange, onQueryResults }: SQLEditorViewProps) {
    const { t } = useI18n();
    const { connections } = useConnectionStore();
    const connectionType = connections.find((c) => c.id === context?.connectionId)?.type ?? 'POSTGRES';
    const [rawExecute] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' });
    const [activeResultTab, setActiveResultTab] = useState<'result' | 'message'>('result');
    const [query, setQuery] = useState(initialSql || "");
    const [isExecuting, setIsExecuting] = useState(false);
    const [queryResults, setQueryResults] = useState<any>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const { updateTab } = useTabStore();
    const { fetchDatabases, fetchSchemas } = useConnectionStore();
    const [databases, setDatabases] = useState<string[]>([]);
    const [schemas, setSchemas] = useState<string[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState(context?.databaseName ?? '');
    const [selectedSchema, setSelectedSchema] = useState(context?.schemaName ?? '');

    // Fetch databases on mount
    useEffect(() => {
        if (!context?.connectionId) return;
        fetchDatabases(context.connectionId).then(setDatabases).catch(console.error);
    }, [context?.connectionId, fetchDatabases]);

    // Fetch schemas when database changes (Postgres only), default to "public" or first available
    useEffect(() => {
        if (!context?.connectionId || !selectedDatabase || !supportsSchema(connectionType)) return;
        fetchSchemas(context.connectionId, selectedDatabase).then((result) => {
            setSchemas(result);
            if (!selectedSchema && result.length > 0) {
                const defaultSchema = result.includes('public') ? 'public' : result[0];
                setSelectedSchema(defaultSchema);
            }
        }).catch(console.error);
    }, [context?.connectionId, selectedDatabase, connectionType, fetchSchemas]);

    const handleDatabaseChange = (db: string) => {
        setSelectedDatabase(db);
        if (supportsSchema(connectionType)) {
            setSelectedSchema('');
            updateTab(tabId, { databaseName: db, schemaName: undefined });
        } else {
            updateTab(tabId, { databaseName: db });
        }
    };

    const handleSchemaChange = (schema: string) => {
        setSelectedSchema(schema);
        updateTab(tabId, { schemaName: schema });
    };

    const handleRun = async () => {
        const statements = splitSQLStatements(query);
        if (statements.length === 0) return;

        setIsExecuting(true);
        setErrorMessage(null);
        setQueryResults(null);
        const startTime = Date.now();
        const results: any[] = [];

        for (let idx = 0; idx < statements.length; idx++) {
            const sql = statements[idx];

            try {
                const { data, error } = await rawExecute({
                    variables: { query: sql },
                    context: { database: selectedDatabase || context?.databaseName },
                });

                if (error) {
                    results.push({
                        columns: [],
                        rows: [],
                        info: error.message,
                        isError: true,
                        sql,
                    });
                    break;
                }

                if (data?.RawExecute) {
                    const raw = data.RawExecute;
                    const columns = raw.Columns.map((c) => c.Name);

                    if (isReadOperation(connectionType, sql) || raw.Rows.length > 0) {
                        const rows = raw.Rows.map((row) =>
                            Object.fromEntries(columns.map((col, i) => [col, row[i]]))
                        );
                        results.push({ columns, rows, info: t('sql.editor.rows', { count: raw.TotalCount }), sql });
                    } else {
                        results.push({ columns: [], rows: [], info: t('sql.editor.actionExecuted'), sql });
                    }
                }
            } catch (err: any) {
                results.push({
                    columns: [],
                    rows: [],
                    info: err.message,
                    isError: true,
                    sql,
                });
                break;
            }
        }

        const endTime = Date.now();
        setExecutionTime((endTime - startTime) / 1000);

        const hasError = results.some((r) => r.isError);
        if (hasError) {
            setErrorMessage(results.find((r) => r.isError)?.info ?? null);
        }

        setQueryResults(results);
        setActiveResultTab(hasError ? 'message' : 'result');

        // Notify parent of the last successful read result
        const lastRead = [...results].reverse().find((r) => !r.isError && r.rows.length > 0);
        if (lastRead) {
            onQueryResults?.(lastRead.columns, lastRead.rows, {
                database: selectedDatabase || context?.databaseName,
                schema: selectedSchema || context?.schemaName,
            });
        }

        setIsExecuting(false);
    };

    const handleFormat = () => {
        if (!query.trim()) return;
        try {
            const formatted = format(query);
            setQuery(formatted);
            onSqlChange?.(formatted);
            if (editorRef.current) {
                editorRef.current.setValue(formatted);
            }
        } catch {
            // sql-formatter can't parse the query — leave it as-is
        }
    };

    // Resizing state
    const [resultsHeight, setResultsHeight] = useState(400); // Default height in pixels
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = 'row-resize';
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        document.body.style.cursor = 'default';
    }, []);

    const resize = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isResizing && containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                // Calculate new height: Container Bottom - Mouse Y
                // This gives us the height from the bottom up
                const newHeight = containerRect.bottom - mouseMoveEvent.clientY;

                // Constraints
                const minHeight = 40; // Reduced min height to allow collapsing to tabs only
                const maxHeight = containerRect.height - 100; // Keep at least 100px for editor

                if (newHeight >= minHeight && newHeight <= maxHeight) {
                    setResultsHeight(newHeight);
                }
            }
        },
        [isResizing]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    return (
        <div className="flex h-full flex-col bg-background" ref={containerRef}>
            {/* Toolbar */}
            <div className="flex h-12 items-center justify-between border-b px-4 bg-muted/10 shrink-0">
                {/* Left: Action Buttons */}
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleRun}
                        disabled={isExecuting}
                        className="min-w-[70px]"
                    >
                        {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                        {t('sql.actions.run')}
                    </Button>
                    {getEditorLanguage(connectionType) === 'sql' && (
                        <Button
                            variant="ghost"
                            onClick={handleFormat}
                            disabled={!query.trim()}
                        >
                            <AlignLeft className="h-4 w-4" />
                            {t('sql.actions.format')}
                        </Button>
                    )}
                </div>

                {/* Right: Database/Schema Selectors */}
                <div className="flex items-center gap-2">
                    {/* Database Selector */}
                    <Select
                        value={selectedDatabase || undefined}
                        onValueChange={handleDatabaseChange}
                        disabled={databases.length === 0}
                    >
                        <SelectTrigger className="w-[180px] gap-1.5 bg-transparent">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder={t('sql.editor.selectDatabase')} />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {databases.map((db) => (
                                <SelectItem key={db} value={db}>
                                    {db}
                                </SelectItem>
                            ))}
                            {databases.length === 0 && (
                                <div className="px-3 py-2 text-sm text-muted-foreground">{t('sql.editor.noDatabases')}</div>
                            )}
                        </SelectContent>
                    </Select>

                    {/* Schema Selector (Postgres only) */}
                    {supportsSchema(connectionType) && (
                        <Select
                            value={selectedSchema || undefined}
                            onValueChange={handleSchemaChange}
                            disabled={!selectedDatabase || schemas.length === 0}
                        >
                            <SelectTrigger className="w-[180px] gap-1.5 bg-transparent">
                                <Network className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder={t('sql.editor.selectSchema')} />
                            </SelectTrigger>
                            <SelectContent align="end">
                                {schemas.map((schema) => (
                                    <SelectItem key={schema} value={schema}>
                                        {schema}
                                    </SelectItem>
                                ))}
                                {schemas.length === 0 && (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">{t('sql.editor.noSchemas')}</div>
                                )}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* Main Content Area (Split View) */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Editor Area */}
                <div className="flex-1 overflow-hidden" style={{ marginBottom: isResizing ? 0 : 0 }}>
                    <MonacoEditor
                        height="100%"
                        language={getEditorLanguage(connectionType)}
                        value={query}
                        onChange={(value: string | undefined) => {
                            const v = value || '';
                            setQuery(v);
                            onSqlChange?.(v);
                        }}
                        theme="vs-light"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            roundedSelection: false,
                            scrollBeyondLastLine: false,
                            readOnly: false,
                            automaticLayout: true,
                            suggestOnTriggerCharacters: true,
                            quickSuggestions: true,
                            wordBasedSuggestions: 'off',
                        }}
                        onMount={(editorInstance: editor.IStandaloneCodeEditor) => {
                            editorRef.current = editorInstance;
                        }}
                    />
                </div>

                {/* Resize Handle */}
                <div
                    className="h-1 bg-border hover:bg-primary/50 cursor-row-resize transition-colors w-full z-10 flex items-center justify-center group"
                    onMouseDown={startResizing}
                >
                    <div className="h-1 w-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
                </div>

                {/* Results Pane */}
                <div
                    className="border-t flex flex-col bg-background transition-[height] ease-out duration-75"
                    style={{ height: resultsHeight, maxHeight: '80%' }}
                >
                    {/* Result Tabs */}
                    <div className="flex items-center border-b px-2 bg-muted/10">
                        <Button
                            onClick={() => setActiveResultTab('result')}
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-auto rounded-none border-b-2 px-4 py-2 text-xs font-medium",
                                activeResultTab === 'result' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            {t('sql.editor.results')}
                        </Button>
                        <Button
                            onClick={() => setActiveResultTab('message')}
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-auto rounded-none border-b-2 px-4 py-2 text-xs font-medium",
                                activeResultTab === 'message' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {t('sql.editor.message')}
                        </Button>
                    </div>

                    {/* Result Content */}
                    <div className="flex-1 overflow-auto bg-background/50 p-0">
                        {activeResultTab === 'result' && (
                            <div className="w-full text-sm">
                                {queryResults && queryResults.length > 0 ? (
                                    <div className="divide-y divide-border">
                                        {queryResults.map((result: any, resultIndex: number) => (
                                            <div key={resultIndex} className="flex flex-col">
                                                {/* Result Header */}
                                                <div className="flex flex-col border-b border-border/50">
                                                    <div className={cn(
                                                        "px-4 py-2.5 flex items-center justify-between",
                                                        result.isError ? 'bg-destructive/5' : 'bg-muted/30'
                                                    )}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "flex items-center justify-center w-5 h-5 rounded-full",
                                                                result.isError ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                                                            )}>
                                                                {result.isError ? (
                                                                    <XCircle className="h-3.5 w-3.5" />
                                                                ) : (
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                )}
                                                            </div>
                                                            <span className="font-medium text-sm text-foreground">
                                                                {t('sql.editor.resultNumber', { index: resultIndex + 1 })}
                                                            </span>
                                                            <span className={cn(
                                                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                                                result.isError
                                                                    ? 'bg-destructive/10 text-destructive'
                                                                    : 'bg-success/10 text-success border border-success/20'
                                                            )}>
                                                                {result.isError ? t('common.alert.error') : (result.info || t('sql.editor.success'))}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            {result.rows && !result.isError && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <GalleryVerticalEnd className="h-3.5 w-3.5" />
                                                                    {t('sql.editor.rows', { count: result.rows.length })}
                                                                </span>
                                                            )}
                                                            {result.affectedRows !== undefined && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <PenTool className="h-3.5 w-3.5" />
                                                                    {t('sql.editor.rowsAffected', { count: result.affectedRows })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* SQL Statement Display */}
                                                    {result.sql && queryResults.length > 1 && (
                                                        <div className="px-4 py-2 bg-muted/30 border-t border-b border-border/50">
                                                            <code className={cn(
                                                                "text-sm font-mono block whitespace-pre-wrap break-all pl-2 border-l-2",
                                                                result.isError
                                                                    ? 'border-destructive text-destructive bg-destructive/5'
                                                                    : 'border-primary/30 text-muted-foreground'
                                                            )}>
                                                                {result.sql}
                                                            </code>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Result Body */}
                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse text-left">
                                                        <thead className="bg-muted sticky top-0 z-10">
                                                            <tr>
                                                                <th className="border-b border-r px-4 py-2 font-medium text-muted-foreground w-16 text-center bg-muted">#</th>
                                                                {result.columns?.map((col: string, i: number) => (
                                                                    <th key={i} className="border-b border-r px-4 py-2 font-medium text-muted-foreground bg-muted whitespace-nowrap">
                                                                        {col}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {result.rows?.length > 0 ? (
                                                                result.rows.map((row: any, i: number) => (
                                                                    <tr key={i} className="hover:bg-muted/10">
                                                                        <td className="border-b border-r px-4 py-1.5 text-muted-foreground text-center bg-muted/5 font-mono text-xs">
                                                                            {i + 1}
                                                                        </td>
                                                                        {result.columns?.map((col: string, j: number) => (
                                                                            <td key={j} className="border-b border-r px-4 py-1.5 whitespace-nowrap max-w-[300px] truncate">
                                                                                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan={(result.columns?.length || 0) + 1} className="px-4 py-8 text-center text-muted-foreground">
                                                                        {t('sql.editor.noRowsReturned')}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground flex-col gap-2">
                                        <Play className="h-8 w-8 opacity-20" />
                                        <span>{t('sql.editor.runToSeeResults')}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeResultTab === 'message' && (
                            <div className="p-4 text-sm font-mono space-y-2">
                                {errorMessage ? (
                                    <div className="flex items-center gap-2 text-destructive">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        <span>{errorMessage}</span>
                                    </div>
                                ) : queryResults ? (
                                    <>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <span className="text-xs">[{new Date().toLocaleString()}]</span>
                                            <span>{t('sql.editor.queryExecutedSuccessfully')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-success">
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            <span>
                                                {t('sql.editor.affectedRowsWithTime', {
                                                    count: Array.isArray(queryResults) ? queryResults.reduce((acc: number, res: any) => acc + (res.rows?.length || 0), 0) : 0,
                                                    time: executionTime?.toFixed(3) ?? 0,
                                                })}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted-foreground">{t('sql.editor.noQueryExecuted')}</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}
