import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, Save, AlignLeft, Clock, CheckCircle, AlertCircle, FileText, Activity, Loader2, XCircle, CheckCircle2, GalleryVerticalEnd, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import MonacoEditor from "./MonacoEditorWrapper";
import type { Monaco } from "@monaco-editor/react";
import type { editor } from 'monaco-editor';
import { useConnectionStore } from "@/stores/useConnectionStore";

interface SQLEditorViewProps {
    context?: {
        connectionId: string;
        databaseName?: string;
        schemaName?: string;
    } | null;
    initialSql?: string;
    onSqlChange?: (sql: string) => void;
}

export function SQLEditorView({ context, initialSql, onSqlChange }: SQLEditorViewProps) {
    const { connections } = useConnectionStore();
    const [activeResultTab, setActiveResultTab] = useState<'result' | 'message' | 'profile' | 'status'>('result');
    const [query, setQuery] = useState(initialSql || "");
    const [isExecuting, setIsExecuting] = useState(false);
    const [queryResults, setQueryResults] = useState<any>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [schemaMetadata, setSchemaMetadata] = useState<any>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const initializedRef = useRef(false);

    // New state for additional features
    const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isFormatting, setIsFormatting] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch schema metadata when context changes
    useEffect(() => {
        if (context?.connectionId) {
            fetchSchemaMetadata();
        }
    }, [context?.connectionId, context?.databaseName, context?.schemaName]);

    // Update default query when schema metadata is loaded (only if no initial SQL provided)
    useEffect(() => {
        // Skip if we have initial SQL or already initialized
        if (initialSql || initializedRef.current) return;

        if (schemaMetadata?.tables && schemaMetadata.tables.length > 0) {
            const firstTable = schemaMetadata.tables[0];
            const tableName = firstTable.name;
            // For PostgreSQL with schema, include schema prefix
            const fullTableName = context?.schemaName
                ? `${context.schemaName}.${tableName}`
                : tableName;
            const newQuery = `-- Query for database: ${context?.databaseName || 'default'}\nSELECT * FROM ${fullTableName} LIMIT 100;`;
            setQuery(newQuery);
            initializedRef.current = true;
        } else if (context?.databaseName) {
            // No tables found, provide a SELECT-based fallback query
            const conn = connections.find(c => c.id === context.connectionId);
            let defaultQuery = `-- Database: ${context.databaseName}\n`;
            if (conn?.type === 'MYSQL') {
                defaultQuery += `SELECT * FROM information_schema.tables WHERE table_schema = DATABASE() LIMIT 100;`;
            } else if (conn?.type === 'POSTGRES') {
                const schema = context.schemaName || 'public';
                defaultQuery += `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' LIMIT 100;`;
            } else {
                defaultQuery += `SELECT 1;`;
            }
            setQuery(defaultQuery);
            initializedRef.current = true;
        }
    }, [schemaMetadata, context?.databaseName, context?.schemaName, initialSql]);

    const fetchSchemaMetadata = async () => {
        if (!context) return;

        // Find the connection object
        const connection = connections.find(c => c.id === context.connectionId);
        if (!connection) return;

        try {
            const params = new URLSearchParams({
                connectionId: context.connectionId,
                ...(context.databaseName && { database: context.databaseName }),
                ...(context.schemaName && { schema: context.schemaName }),
                connection: JSON.stringify(connection),
            });

            const response = await fetch(`/api/schema/metadata?${params}`);
            const data = await response.json();
            setSchemaMetadata(data);
        } catch (error) {
            console.error('Failed to fetch schema metadata:', error);
        }
    };

    const handleRun = async () => {
        if (!context?.connectionId) {
            setErrorMessage("No database connection selected");
            setActiveResultTab('message');
            return;
        }

        // Find the connection object
        const connection = connections.find(c => c.id === context.connectionId);
        if (!connection) {
            setErrorMessage("Connection not found");
            setActiveResultTab('message');
            return;
        }

        setIsExecuting(true);
        setErrorMessage(null);
        const startTime = Date.now();
        const queryId = `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        setCurrentQueryId(queryId);

        try {
            const response = await fetch('/api/query/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connectionId: context.connectionId,
                    database: context.databaseName,
                    schema: context.schemaName,
                    query,
                    connection, // Pass the full connection object
                }),
            });

            const data = await response.json();
            const endTime = Date.now();
            setExecutionTime((endTime - startTime) / 1000);

            if (data.success) {
                if (Array.isArray(data.data)) {
                    setQueryResults(data.data);
                } else {
                    setQueryResults([data.data]);
                }
                setActiveResultTab('result');
            } else {
                // Even on error, display partial results if available
                if (data.data && (Array.isArray(data.data) ? data.data.length > 0 : true)) {
                    if (Array.isArray(data.data)) {
                        setQueryResults(data.data);
                    } else {
                        setQueryResults([data.data]);
                    }
                    setActiveResultTab('result');
                } else {
                    setActiveResultTab('message');
                }
                setErrorMessage(data.error || 'Query execution failed');
            }
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to execute query');
            setActiveResultTab('message');
        } finally {
            setIsExecuting(false);
            setCurrentQueryId(null);
        }
    };

    // Handle SQL Format
    const handleFormat = async () => {
        if (!query.trim()) return;

        setIsFormatting(true);
        try {
            const response = await fetch('/api/query/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: query }),
            });

            const data = await response.json();

            if (data.success && data.formattedSql) {
                setQuery(data.formattedSql);
                // Update the editor content
                if (editorRef.current) {
                    editorRef.current.setValue(data.formattedSql);
                }
            } else {
                setErrorMessage(data.error || 'Failed to format SQL');
                setActiveResultTab('message');
            }
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to format SQL');
            setActiveResultTab('message');
        } finally {
            setIsFormatting(false);
        }
    };

    // Handle Save Query
    const handleSave = async () => {
        if (!saveName.trim() || !query.trim()) {
            setSaveMessage({ type: 'error', text: 'Please enter a name for the query' });
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const response = await fetch('/api/query/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: saveName,
                    sql: query,
                    connectionId: context?.connectionId || '',
                    databaseName: context?.databaseName,
                    schemaName: context?.schemaName,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSaveMessage({ type: 'success', text: 'Query saved successfully!' });
                setTimeout(() => {
                    setShowSaveModal(false);
                    setSaveName('');
                    setSaveMessage(null);
                }, 1500);
            } else {
                setSaveMessage({ type: 'error', text: data.error || 'Failed to save query' });
            }
        } catch (error: any) {
            setSaveMessage({ type: 'error', text: error.message || 'Failed to save query' });
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Stop Query
    const handleStop = async () => {
        if (!currentQueryId) return;

        try {
            await fetch('/api/query/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queryId: currentQueryId }),
            });

            setIsExecuting(false);
            setCurrentQueryId(null);
            setErrorMessage('Query cancelled by user');
            setActiveResultTab('message');
        } catch (error: any) {
            console.error('Failed to stop query:', error);
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

    const setupAutocompletion = (monaco: Monaco) => {
        // Register SQL completions provider
        monaco.languages.registerCompletionItemProvider('sql', {
            provideCompletionItems: (model: any, position: any) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                const suggestions: any[] = [];

                // Add table suggestions
                if (schemaMetadata?.tables) {
                    schemaMetadata.tables.forEach((table: any) => {
                        suggestions.push({
                            label: table.name,
                            kind: monaco.languages.CompletionItemKind.Class,
                            insertText: table.name,
                            detail: 'Table',
                            documentation: `Table: ${table.name}`,
                            range,
                        });

                        // Add column suggestions for each table
                        table.columns?.forEach((column: any) => {
                            suggestions.push({
                                label: `${table.name}.${column.name}`,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: `${table.name}.${column.name}`,
                                detail: `${column.type} - ${table.name}.${column.name}`,
                                documentation: column.description || `Column ${column.name} in table ${table.name}`,
                                range,
                            });

                            // Also add just the column name
                            suggestions.push({
                                label: column.name,
                                kind: monaco.languages.CompletionItemKind.Property,
                                insertText: column.name,
                                detail: `${column.type}`,
                                documentation: column.description || `Column: ${column.name}`,
                                range,
                            });
                        });
                    });
                }

                // Add SQL keywords
                const sqlKeywords = [
                    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
                    'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'LIKE', 'BETWEEN',
                    'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
                    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
                    'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN',
                    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'INDEX',
                    'DISTINCT', 'AS', 'NULL', 'IS', 'ASC', 'DESC',
                ];

                sqlKeywords.forEach((keyword) => {
                    suggestions.push({
                        label: keyword,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: keyword,
                        detail: 'SQL Keyword',
                        range,
                    });
                });

                // Add SQL functions
                const sqlFunctions = [
                    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
                    'UPPER', 'LOWER', 'CONCAT', 'SUBSTRING', 'LENGTH',
                    'TRIM', 'LTRIM', 'RTRIM', 'REPLACE',
                    'NOW', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
                    'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY',
                    'COALESCE', 'NULLIF', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
                ];

                sqlFunctions.forEach((func) => {
                    suggestions.push({
                        label: func,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: `${func}()`,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: 'SQL Function',
                        range,
                    });
                });

                return { suggestions };
            },
        });
    };

    return (
        <div className="flex h-full flex-col bg-background" ref={containerRef}>
            {/* Context Info Bar */}
            {context && (
                <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-muted/5 text-xs shrink-0">
                    <span className="text-muted-foreground">Connected to:</span>
                    <span className="font-medium">
                        {connections.find(c => c.id === context.connectionId)?.name || context.connectionId}
                    </span>
                    {context.databaseName && (
                        <>
                            <span className="text-muted-foreground">/</span>
                            <span className="font-medium text-purple-600">{context.databaseName}</span>
                        </>
                    )}
                    {context.schemaName && (
                        <>
                            <span className="text-muted-foreground">/</span>
                            <span className="font-medium text-orange-600">{context.schemaName}</span>
                        </>
                    )}
                </div>
            )}

            {/* Toolbar */}
            <div className="flex h-12 items-center justify-between border-b px-4 bg-muted/10 shrink-0">
                <div className="flex items-center gap-4">
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRun}
                            disabled={isExecuting}
                            className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[70px]"
                        >
                            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                            Run
                        </button>
                        <button
                            onClick={handleStop}
                            disabled={!isExecuting}
                            className={cn(
                                "p-2 rounded-md transition-colors",
                                "text-muted-foreground transition-colors",
                                isExecuting
                                    ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                    : "opacity-50 cursor-not-allowed"
                            )}
                            title="Stop"
                        >
                            <Square className="h-4 w-4 fill-current" />
                        </button>
                        {/* Save button hidden
                        <button
                            onClick={() => setShowSaveModal(true)}
                            disabled={!query.trim()}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="h-4 w-4" />
                            Save
                        </button>
                        */}
                        <button
                            onClick={handleFormat}
                            disabled={!query.trim() || isFormatting}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isFormatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlignLeft className="h-4 w-4" />}
                            {isFormatting ? 'Formatting...' : 'Format'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area (Split View) */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Editor Area */}
                <div className="flex-1 overflow-hidden" style={{ marginBottom: isResizing ? 0 : 0 }}>
                    <MonacoEditor
                        height="100%"
                        defaultLanguage="sql"
                        value={query}
                        onChange={(value: string | undefined) => setQuery(value || '')}
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
                        onMount={(editorInstance: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
                            editorRef.current = editorInstance;
                            monacoRef.current = monacoInstance;
                            try {
                                setupAutocompletion(monacoInstance);
                            } catch (err) {
                                console.error('Failed to setup autocompletion:', err);
                            }
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
                        <button
                            onClick={() => setActiveResultTab('result')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                                activeResultTab === 'result' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Results
                        </button>
                        <button
                            onClick={() => setActiveResultTab('message')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                                activeResultTab === 'message' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Message
                        </button>
                        <button
                            onClick={() => setActiveResultTab('profile')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                                activeResultTab === 'profile' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Clock className="h-3.5 w-3.5" />
                            Profile
                        </button>
                        <button
                            onClick={() => setActiveResultTab('status')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                                activeResultTab === 'status' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Activity className="h-3.5 w-3.5" />
                            Status
                        </button>
                    </div>

                    {/* Result Content */}
                    <div className="flex-1 overflow-auto bg-white/50 p-0">
                        {activeResultTab === 'result' && (
                            <div className="w-full text-sm">
                                {queryResults && queryResults.length > 0 ? (
                                    <div className="divide-y divide-border">
                                        {queryResults.map((result: any, resultIndex: number) => (
                                            <div key={resultIndex} className="flex flex-col">
                                                {/* Result Header */}
                                                {/* Result Header */}
                                                <div className="flex flex-col border-b border-border/50">
                                                    <div className={`px-4 py-2.5 flex items-center justify-between ${result.isError ? 'bg-red-50/50' : 'bg-muted/30'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`flex items-center justify-center w-5 h-5 rounded-full ${result.isError ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                                {result.isError ? (
                                                                    <XCircle className="h-3.5 w-3.5" />
                                                                ) : (
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                )}
                                                            </div>
                                                            <span className="font-medium text-sm text-foreground">
                                                                Result #{resultIndex + 1}
                                                            </span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${result.isError
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                                }`}>
                                                                {result.isError ? 'Error' : (result.info || 'Success')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            {result.rows && !result.isError && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <GalleryVerticalEnd className="h-3.5 w-3.5" />
                                                                    {result.rows.length} rows
                                                                </span>
                                                            )}
                                                            {result.affectedRows !== undefined && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <PenTool className="h-3.5 w-3.5" />
                                                                    {result.affectedRows} affected
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* SQL Statement Display */}
                                                    {result.sql && (
                                                        <div className="px-4 py-2 bg-slate-50/50 border-t border-b border-border/50">
                                                            <code className={`text-sm font-mono block whitespace-pre-wrap break-all pl-2 border-l-2 ${result.isError ? 'border-red-400 text-red-800 bg-red-50/30' : 'border-primary/30 text-muted-foreground'}`}>
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
                                                                        No rows returned
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
                                        <span>Run a query to see results</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeResultTab === 'message' && (
                            <div className="p-4 text-sm font-mono space-y-2">
                                {errorMessage ? (
                                    <div className="flex items-center gap-2 text-red-600">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        <span>{errorMessage}</span>
                                    </div>
                                ) : queryResults ? (
                                    <>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <span className="text-xs">[{new Date().toLocaleString()}]</span>
                                            <span>Query executed successfully</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-green-600">
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            <span>Affected rows: {Array.isArray(queryResults) ? queryResults.reduce((acc: number, res: any) => acc + (res.rows?.length || 0), 0) : 0}. Time: {executionTime?.toFixed(3)}s</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted-foreground">No query executed yet.</div>
                                )}
                            </div>
                        )}
                        {activeResultTab === 'profile' && (
                            <div className="p-4 text-sm text-muted-foreground flex items-center justify-center h-full">
                                Query profiling is not enabled.
                            </div>
                        )}
                        {activeResultTab === 'status' && (
                            <div className="p-4 text-sm text-muted-foreground flex items-center justify-center h-full">
                                Server status: Connected
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Query Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="px-6 py-4 border-b">
                            <h2 className="text-lg font-semibold">Save Query</h2>
                        </div>
                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Query Name
                                </label>
                                <input
                                    type="text"
                                    value={saveName}
                                    onChange={(e) => setSaveName(e.target.value)}
                                    placeholder="Enter query name..."
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    SQL Preview
                                </label>
                                <pre className="w-full px-3 py-2 bg-gray-50 border rounded-md text-xs font-mono overflow-auto max-h-32">
                                    {query.slice(0, 500)}{query.length > 500 ? '...' : ''}
                                </pre>
                            </div>
                            {saveMessage && (
                                <div className={cn(
                                    "px-3 py-2 rounded-md text-sm",
                                    saveMessage.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                )}>
                                    {saveMessage.text}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowSaveModal(false);
                                    setSaveName('');
                                    setSaveMessage(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !saveName.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isSaving ? 'Saving...' : 'Save Query'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
