import React, { useCallback, useEffect, useState, useRef } from "react";
import {
    Table as TableIcon,
    Search,
    Filter,
    RefreshCw,
    Download,
    Maximize2,
    Edit2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Sparkles,
    Loader2,
    Database,
    Plus,
    Save,
    X,
    MoreHorizontal,
    ArrowUpAZ,
    ArrowDownAZ,
    EyeOff
} from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { ExportDataModal } from "./ExportDataModal";
import { FilterTableModal } from "./FilterTableModal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
    useGetStorageUnitRowsLazyQuery,
    useAddRowMutation,
    useDeleteRowMutation,
    useUpdateStorageUnitMutation,
    WhereConditionType,
    SortDirection,
    type WhereCondition,
    type SortCondition,
} from '@graphql';
import { transformRowsResult, type TableData } from '@/utils/graphql-transforms';
import { resolveSchemaParam, isNoSQL } from '@/utils/database-features';
import { parseSearchToWhereCondition, mergeSearchWithWhere } from '@/utils/search-parser';

interface TableDetailViewProps {
    connectionId: string;
    databaseName: string;
    tableName: string;
    schema?: string;
}

export function TableDetailView({ connectionId, databaseName, tableName, schema }: TableDetailViewProps) {
    const { connections } = useConnectionStore();
    const [getRows] = useGetStorageUnitRowsLazyQuery({ fetchPolicy: 'no-cache' });
    const [addRow] = useAddRowMutation();
    const [deleteRow] = useDeleteRowMutation();
    const [updateStorageUnit] = useUpdateStorageUnitMutation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TableData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showExportModal, setShowExportModal] = useState(false);
    const [pageSize, setPageSize] = useState(50);

    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Record<string, any>>({});
    const [deletingRowIndex, setDeletingRowIndex] = useState<number | null>(null);
    const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [primaryKey, setPrimaryKey] = useState<string | null>(null);
    const [foreignKeyColumns, setForeignKeyColumns] = useState<string[]>([]);

    // Column Resizing State
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

    // Initialize column widths
    useEffect(() => {
        if (data?.columns && Object.keys(columnWidths).length === 0) {
            const initialWidths: Record<string, number> = {};
            data.columns.forEach((col: string) => {
                // Est. name length + padding + menu button space
                initialWidths[col] = Math.max(120, col.length * 10 + 60);
            });
            setColumnWidths(initialWidths);
        }
    }, [data?.columns]);

    // Resize Handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingRef.current) {
                const { column, startX, startWidth } = resizingRef.current;
                const diff = e.clientX - startX;
                const newWidth = Math.max(60, startWidth + diff);
                setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
            }
        };

        const handleMouseUp = () => {
            if (resizingRef.current) {
                resizingRef.current = null;
                document.body.style.cursor = 'default';
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleResizeStart = (e: React.MouseEvent, column: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizingRef.current = {
            column,
            startX: e.clientX,
            startWidth: columnWidths[column] || 120
        };
        document.body.style.cursor = 'col-resize';
    };

    // New state for adding data
    const [isAddingRow, setIsAddingRow] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, any>>({});

    // Sorting state
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [activeColumnMenu, setActiveColumnMenu] = useState<string | null>(null);
    const columnMenuRef = React.useRef<HTMLDivElement>(null);

    // Filter state
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
    const [filterConditions, setFilterConditions] = useState<any[]>([]);

    // ---- Race condition prevention ----
    const latestRequestIdRef = useRef(0);

    // ---- Stable reference to current filter/sort state (avoids stale closures) ----
    const filterConditionsRef = useRef(filterConditions);
    useEffect(() => { filterConditionsRef.current = filterConditions; }, [filterConditions]);

    // Retain latest column info for search parsing (survives data=null between fetches)
    const columnsRef = useRef<{ names: string[]; types: string[] }>({ names: [], types: [] });
    useEffect(() => {
        if (data?.columns && data.columns.length > 0) {
            columnsRef.current = {
                names: data.columns,
                types: data.columns.map(c => data.columnTypes[c] ?? 'string'),
            };
        }
    }, [data?.columns, data?.columnTypes]);

    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertState({
            isOpen: true,
            title,
            message,
            type
        });
    };

    // Helper to simplify PostgreSQL column type names
    const simplifyColumnType = (typeStr: string): string => {
        if (!typeStr) return '';
        return typeStr
            .replace(/ varying/gi, '')
            .replace(/ without time zone/gi, '')
            .replace(/ with time zone/gi, ' tz')
            .replace(/character/gi, 'char')
            .replace(/double precision/gi, 'double')
            .trim();
    };

    const lastTableRef = React.useRef<string>('');

    const handleSubmitRequest = useCallback(async (overridePageOffset?: number) => {
        const conn = connections.find((c) => c.id === connectionId);
        if (!conn) return;

        setLoading(true);
        setError(null);

        // Race condition: only the latest request's results are used
        latestRequestIdRef.current += 1;
        const thisRequestId = latestRequestIdRef.current;

        const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema);

        // Build sort condition
        const sort: SortCondition[] | undefined =
            sortColumn && sortDirection
                ? [{ Column: sortColumn, Direction: sortDirection === 'asc' ? SortDirection.Asc : SortDirection.Desc }]
                : undefined;

        // Build filter where condition
        const currentFilters = filterConditionsRef.current;
        let filterWhere: WhereCondition | undefined;
        if (currentFilters.length > 0) {
            const atomicConditions: WhereCondition[] = currentFilters
                .filter((fc: any) => fc.column && fc.operator)
                .map((fc: any) => ({
                    Type: WhereConditionType.Atomic,
                    Atomic: {
                        Key: fc.column,
                        Operator: fc.operator,
                        Value: fc.value ?? '',
                        ColumnType: data?.columnTypes[fc.column] ?? 'string',
                    },
                }));

            if (atomicConditions.length === 1) {
                filterWhere = atomicConditions[0];
            } else if (atomicConditions.length > 1) {
                filterWhere = { Type: WhereConditionType.And, And: { Children: atomicConditions } };
            }
        }

        // Build search where condition
        const searchWhere = searchTerm.trim()
            ? parseSearchToWhereCondition(
                searchTerm,
                columnsRef.current.names,
                columnsRef.current.types,
            )
            : undefined;

        const where = mergeSearchWithWhere(searchWhere, filterWhere);

        try {
            const { data: result, error: queryError } = await getRows({
                variables: {
                    schema: graphqlSchema,
                    storageUnit: tableName,
                    where,
                    sort,
                    pageSize,
                    pageOffset: overridePageOffset ?? (currentPage - 1) * pageSize,
                },
                context: { database: databaseName },
            });

            // Drop stale results
            if (thisRequestId !== latestRequestIdRef.current) return;

            if (queryError) {
                setError(queryError.message);
                return;
            }

            if (result?.Row) {
                const tableData = transformRowsResult(result.Row);
                setData(tableData);
                setPrimaryKey(tableData.primaryKey);
                setForeignKeyColumns(tableData.foreignKeyColumns);
                if (visibleColumns.length === 0 && tableData.columns.length > 0) {
                    setVisibleColumns(tableData.columns);
                }
            }
        } catch (err: any) {
            if (thisRequestId !== latestRequestIdRef.current) return;
            setError(err.message || 'Failed to fetch table data');
        } finally {
            if (thisRequestId === latestRequestIdRef.current) {
                setLoading(false);
            }
        }
    }, [connections, connectionId, databaseName, schema, tableName, sortColumn, sortDirection, searchTerm, pageSize, currentPage, getRows, visibleColumns.length]);

    // ---- Table switch: reset state + fetch ----
    useEffect(() => {
        const currentTableKey = `${connectionId}:${databaseName}:${schema || ''}:${tableName}`;
        if (lastTableRef.current !== currentTableKey) {
            lastTableRef.current = currentTableKey;
            setVisibleColumns([]);
            setFilterConditions([]);
            setSortColumn(null);
            setSortDirection(null);
            setSearchTerm('');
            setCurrentPage(1);
            setEditingRowIndex(null);
            setSelectedRowIndex(null);
            setIsAddingRow(false);
        }
    }, [connectionId, databaseName, schema, tableName]);

    // ---- Initial fetch + refetch on data-changing params ----
    useEffect(() => {
        handleSubmitRequest();
    }, [handleSubmitRequest, refreshKey]);

    // ---- Page change handler (explicit offset) ----
    const handlePageChange = useCallback((newPage: number) => {
        setCurrentPage(newPage);
        handleSubmitRequest((newPage - 1) * pageSize);
    }, [handleSubmitRequest, pageSize]);

    // ---- Search submit (reset to page 1) ----
    const handleSearchSubmit = useCallback(() => {
        setCurrentPage(1);
        handleSubmitRequest(0);
    }, [handleSubmitRequest]);

    // Expose refresh function via window for external triggers
    useEffect(() => {
        (window as any).__refreshTableDetailView = () => {
            setRefreshKey(prev => prev + 1);
        };
        return () => {
            delete (window as any).__refreshTableDetailView;
        };
    }, []);

    // Close column menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
                setActiveColumnMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSort = (column: string, direction: 'asc' | 'desc') => {
        setSortColumn(column);
        setSortDirection(direction);
        setActiveColumnMenu(null);
    };

    const handleEditClick = (row: any, index: number) => {
        setEditingRowIndex(index);
        setSelectedRowIndex(index); // Sync selection with edit
        setEditValues({ ...row });
        setIsAddingRow(false); // Close add row if open
    };

    const handleCancelEdit = () => {
        setEditingRowIndex(null);
        setEditValues({});
    };

    const handleInputChange = (col: string, value: string) => {
        setEditValues(prev => ({
            ...prev,
            [col]: value
        }));
    };

    const handleSave = async () => {
        if (!primaryKey) {
            showAlert('Error', 'Cannot update row: Primary Key not found for this table.', 'error');
            return;
        }

        const conn = connections.find((c) => c.id === connectionId);
        if (!conn || editingRowIndex === null || !data) return;

        const originalRow = data.rows[editingRowIndex];

        const updatedColumns = Object.keys(editValues).filter(
            (key) => editValues[key] !== originalRow[key],
        );

        if (updatedColumns.length === 0) {
            handleCancelEdit();
            return;
        }

        const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema);

        const values = Object.entries(editValues).map(([key, value]) => ({
            Key: key,
            Value: String(value ?? ''),
        }));

        try {
            const { data: result, errors } = await updateStorageUnit({
                variables: {
                    schema: graphqlSchema,
                    storageUnit: tableName,
                    values,
                    updatedColumns,
                },
                context: { database: databaseName },
            });

            if (errors?.length) {
                showAlert('Error', `Failed to update row: ${errors[0].message}`, 'error');
                return;
            }

            if (result?.UpdateStorageUnit.Status) {
                showAlert('Success', 'Row updated successfully!', 'success');
                handleCancelEdit();
                setRefreshKey(prev => prev + 1);
            } else {
                showAlert('Error', 'Failed to update row', 'error');
            }
        } catch (error: any) {
            showAlert('Error', `Error updating row: ${error.message}`, 'error');
        }
    };

    const handleDeleteClick = (index: number) => {
        setDeletingRowIndex(index);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (deletingRowIndex === null || !primaryKey || !data) return;

        const conn = connections.find((c) => c.id === connectionId);
        if (!conn) return;

        const row = data.rows[deletingRowIndex];
        const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema);

        const values = Object.entries(row).map(([key, value]) => ({
            Key: key,
            Value: String(value ?? ''),
        }));

        try {
            const { data: result, errors } = await deleteRow({
                variables: {
                    schema: graphqlSchema,
                    storageUnit: tableName,
                    values,
                },
                context: { database: databaseName },
            });

            if (errors?.length) {
                showAlert('Error', `Failed to delete row: ${errors[0].message}`, 'error');
                return;
            }

            if (result?.DeleteRow.Status) {
                showAlert('Success', 'Row deleted successfully!', 'success');
                setRefreshKey(prev => prev + 1);
            } else {
                showAlert('Error', 'Failed to delete row', 'error');
            }
        } catch (error: any) {
            showAlert('Error', `Error deleting row: ${error.message}`, 'error');
        } finally {
            setDeletingRowIndex(null);
        }
    };

    // Add Data Handlers
    const handleAddClick = () => {
        setIsAddingRow(true);
        setNewRowData({});
        setEditingRowIndex(null); // Close edit if open
        setSelectedRowIndex(null); // Clear selection so only the new row is highlighted
    };

    const handleCancelAdd = () => {
        setIsAddingRow(false);
        setNewRowData({});
    };

    const handleNewRowInputChange = (col: string, value: string) => {
        setNewRowData(prev => ({
            ...prev,
            [col]: value
        }));
    };

    const handleSaveNewRow = async () => {
        const conn = connections.find((c) => c.id === connectionId);
        if (!conn) return;

        const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema);
        let values: Array<{ Key: string; Value: string }>;

        // MongoDB document mode: single Document column → parse JSON
        if (isNoSQL(conn.type) && data?.columns.length === 1 && data.columnTypes[data.columns[0]] === 'Document') {
            const docValue = newRowData[data.columns[0]] || newRowData['document'] || '';
            try {
                const json = JSON.parse(docValue);
                values = Object.keys(json).map(key => {
                    const val = json[key];
                    return {
                        Key: key,
                        Value: typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val),
                    };
                });
            } catch {
                showAlert('Error', 'Invalid JSON document', 'error');
                return;
            }
        } else {
            // Standard relational mode
            if (Object.keys(newRowData).length === 0 || Object.values(newRowData).every((v) => !v)) {
                showAlert('Error', 'Please enter at least one value', 'error');
                return;
            }
            values = Object.entries(newRowData)
                .filter(([_, v]) => v !== undefined && v !== '')
                .map(([key, value]) => ({ Key: key, Value: String(value) }));
        }

        if (values.length === 0) {
            showAlert('Error', 'Please enter at least one value', 'error');
            return;
        }

        try {
            const { data: result, errors } = await addRow({
                variables: {
                    schema: graphqlSchema,
                    storageUnit: tableName,
                    values,
                },
                context: { database: databaseName },
            });

            if (errors?.length) {
                showAlert('Error', `Failed to add row: ${errors[0].message}`, 'error');
                return;
            }

            if (result?.AddRow.Status) {
                showAlert('Success', 'New row added successfully!', 'success');
                handleCancelAdd();
                setRefreshKey(prev => prev + 1);
            } else {
                showAlert('Error', 'Failed to add row', 'error');
            }
        } catch (error: any) {
            showAlert('Error', `Error adding row: ${error.message}`, 'error');
        }
    };

    if (error) {
        return (
            <div className="flex h-full items-center justify-center bg-muted/5">
                <div className="text-center p-8 bg-background rounded-xl shadow-sm border">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button variant="outline" className="mt-4" onClick={() => handleSubmitRequest()}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    const canEdit = data && !data.disableUpdate;
    const totalRows = data?.total || 0;
    const totalPages = Math.ceil(totalRows / pageSize);
    const startRow = (currentPage - 1) * pageSize + 1;
    const endRow = Math.min(currentPage * pageSize, totalRows);

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <TableIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                            {databaseName}{schema ? `.${schema}` : ''}.{tableName}
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium">TABLE VIEW</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <>
                            <Button
                                onClick={handleAddClick}
                                size="sm"
                                className="gap-2 shadow-sm"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Data
                            </Button>
                            <div className="h-4 w-px bg-border mx-1" />
                        </>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            "h-8 gap-2",
                            filterConditions.length > 0 && "bg-primary/10 text-primary border-primary/50"
                        )}
                        onClick={() => setIsFilterModalOpen(true)}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        Filter
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2"
                        onClick={() => setShowExportModal(true)}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2"
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        disabled={loading}
                    >
                        <div className={cn("flex items-center justify-center", loading && "animate-spin")}>
                            <RefreshCw className="h-3.5 w-3.5" />
                        </div>
                        Refresh
                    </Button>
                </div>
            </div>
            {/* Applied Filters Banner */}
            {filterConditions.length > 0 && (
                <div className="px-6 py-2 bg-muted/30 border-b border-border/50 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground mr-2">Filtered by:</span>

                    {filterConditions.map((condition, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-background border border-border rounded-full px-3 py-1 text-xs shadow-sm">
                            <span className="text-muted-foreground">{condition.column}</span>
                            <span className="font-mono text-primary font-medium">{condition.operator}</span>
                            {/* Don't show value for unary operators */}
                            {!['IS NULL', 'IS NOT NULL'].includes(condition.operator) && (
                                <span className="font-medium max-w-[150px] truncate" title={condition.value}>
                                    {condition.value}
                                </span>
                            )}
                            <button
                                onClick={() => {
                                    const newFilters = [...filterConditions];
                                    newFilters.splice(idx, 1);
                                    setFilterConditions(newFilters);
                                }}
                                className="ml-1 hover:text-destructive transition-colors p-0.5 rounded-full hover:bg-muted"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-destructive ml-auto"
                        onClick={() => setFilterConditions([])}
                    >
                        Clear All
                    </Button>
                </div>
            )}

            {/* Data Grid */}
            <div className="flex-1 overflow-hidden bg-muted/5 p-6 flex flex-col">
                <div className="bg-background rounded-xl shadow-sm border border-border/50 overflow-hidden flex-1 flex flex-col">
                    {loading && !data ? (
                        <div className="flex flex-1 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-background border-b border-border">
                                    <tr>
                                        {data?.columns?.filter((col: string) => visibleColumns.includes(col)).map((col: string, idx: number) => {
                                            const width = columnWidths[col] || 120;
                                            return (
                                                <th
                                                    key={idx}
                                                    style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                                                    className="px-6 py-2 text-left font-medium text-sm text-muted-foreground whitespace-nowrap group/header relative border-r border-border/50 select-none sticky top-0 bg-background z-40"
                                                >
                                                    <div className="flex items-center justify-between h-full">
                                                        <div className="flex flex-col overflow-hidden mr-6">
                                                            <div className="flex items-center gap-1">
                                                                <span className="truncate" title={col}>{col}</span>
                                                                {col === primaryKey && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">PK</Badge>}
                                                                {foreignKeyColumns.includes(col) && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-blue-500 text-blue-600">FK</Badge>}
                                                                {sortColumn === col && (
                                                                    <span className="text-primary shrink-0">
                                                                        {sortDirection === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {data?.columnTypes?.[col] && (
                                                                <span className="text-xs font-normal text-muted-foreground/80 normal-case truncate">
                                                                    {simplifyColumnType(data.columnTypes[col])}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveColumnMenu(activeColumnMenu === col ? null : col);
                                                            }}
                                                            className={cn(
                                                                "absolute top-2 right-2 p-0.5 rounded hover:bg-muted transition-all text-muted-foreground",
                                                                activeColumnMenu === col && "bg-muted text-foreground"
                                                            )}
                                                        >
                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>

                                                    {/* Resize Handle */}
                                                    <div
                                                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 z-20"
                                                        onMouseDown={(e) => handleResizeStart(e, col)}
                                                    />

                                                    {activeColumnMenu === col && (
                                                        <div
                                                            ref={columnMenuRef}
                                                            className={cn(
                                                                "absolute top-full mt-1 w-40 bg-popover text-popover-foreground border shadow-md rounded-md py-1 z-50 animate-in fade-in zoom-in-95 duration-100",
                                                                idx === 0 ? "left-0 origin-top-left" : "right-0 origin-top-right"
                                                            )}
                                                        >
                                                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/30 border-b mb-1">
                                                                排序操作
                                                            </div>
                                                            <button
                                                                onClick={() => handleSort(col, 'asc')}
                                                                className={cn(
                                                                    "w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors",
                                                                    sortColumn === col && sortDirection === 'asc' && "text-primary font-medium bg-primary/5"
                                                                )}
                                                            >
                                                                <ArrowUpAZ className="h-3.5 w-3.5" />
                                                                升序 (ASC)
                                                            </button>
                                                            <button
                                                                onClick={() => handleSort(col, 'desc')}
                                                                className={cn(
                                                                    "w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors",
                                                                    sortColumn === col && sortDirection === 'desc' && "text-primary font-medium bg-primary/5"
                                                                )}
                                                            >
                                                                <ArrowDownAZ className="h-3.5 w-3.5" />
                                                                降序 (DESC)
                                                            </button>
                                                            {sortColumn === col && (
                                                                <>
                                                                    <Separator className="my-1" />
                                                                    <button
                                                                        onClick={() => {
                                                                            setSortColumn(null);
                                                                            setSortDirection(null);
                                                                            setActiveColumnMenu(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                                                    >
                                                                        <X className="h-3.5 w-3.5" />
                                                                        取消排序
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </th>
                                            );
                                        })}
                                        {canEdit && (
                                            <th className="px-6 py-2 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wider border-b border-r border-border/50 w-[120px] sticky top-0 right-0 bg-background z-50 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)]">
                                                Actions
                                            </th>
                                        )}
                                        <th className="border-b border-border/50 w-full bg-background sticky top-0 z-40"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50 bg-background">
                                    {/* Add Row */}
                                    {canEdit && isAddingRow && (
                                        <tr className="bg-gray-200 border-b border-border/50">
                                            {data?.columns?.filter((col: string) => visibleColumns.includes(col)).map((col: string, idx: number) => {
                                                const width = columnWidths[col] || 120;
                                                return (
                                                    <td key={idx} className="p-0 border-r border-border/50" style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}>
                                                        <input
                                                            type="text"
                                                            autoFocus={idx === 0}
                                                            className="w-full h-full min-h-[36px] bg-transparent border-none rounded-none px-6 py-2 text-sm focus:outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary transition-colors"
                                                            placeholder={`Enter ${col}`}
                                                            value={newRowData[col] || ''}
                                                            onChange={(e) => handleNewRowInputChange(col, e.target.value)}
                                                        />
                                                    </td>
                                                );
                                            })}
                                            <td className="px-6 py-2 text-right whitespace-nowrap sticky right-0 bg-gray-200 border-r border-border/50 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] z-20">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        onClick={handleSaveNewRow}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                        title="Save New Row"
                                                    >
                                                        <Save className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        onClick={handleCancelAdd}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                        title="Cancel"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                            <td className="border-b border-border/50 bg-gray-200"></td>
                                        </tr>
                                    )}

                                    {data?.rows?.map((row: any, rowIdx: number) => {
                                        const isEditing = editingRowIndex === rowIdx;
                                        const isSelected = selectedRowIndex === rowIdx;
                                        return (
                                            <tr
                                                key={rowIdx}
                                                onClick={() => {
                                                    // If editing another row, close edit mode to keep only one row highlighted
                                                    if (editingRowIndex !== null && editingRowIndex !== rowIdx) {
                                                        setEditingRowIndex(null);
                                                    }
                                                    setSelectedRowIndex(rowIdx);
                                                }}
                                                className={cn(
                                                    "transition-colors group cursor-pointer",
                                                    isEditing ? "bg-gray-200" : isSelected ? "bg-gray-200" : "hover:bg-muted/30"
                                                )}
                                            >
                                                {data?.columns?.filter((col: string) => visibleColumns.includes(col)).map((col: string, colIdx: number) => {
                                                    const width = columnWidths[col] || 120;
                                                    return (
                                                        <td
                                                            key={colIdx}
                                                            className={cn("whitespace-nowrap text-sm text-foreground/80 border-b border-r border-border/50", isEditing ? "p-0" : "px-6 py-2")}
                                                            style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                                                        >
                                                            {isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    autoFocus={colIdx === 0}
                                                                    value={editValues[col] !== undefined ? editValues[col] : (row[col] ?? '')}
                                                                    onChange={(e) => handleInputChange(col, e.target.value)}
                                                                    className="w-full h-full min-h-[36px] bg-transparent border-none rounded-none px-6 py-2 text-sm focus:outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary transition-colors"
                                                                />
                                                            ) : (
                                                                <span className="block truncate" title={String(row[col])}>
                                                                    {row[col] === null ? <span className="text-muted-foreground italic">NULL</span> : String(row[col])}
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                {canEdit && (
                                                    <td className={cn(
                                                        "px-6 py-2 text-right whitespace-nowrap sticky right-0 transition-colors z-20 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] border-r border-b border-border/50",
                                                        isEditing ? "bg-gray-200" : isSelected ? "bg-gray-200" : "bg-background group-hover:bg-muted/30"
                                                    )}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {isEditing ? (
                                                                <>
                                                                    <Button
                                                                        onClick={handleSave}
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                                        title="Save"
                                                                    >
                                                                        <Save className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        onClick={handleCancelEdit}
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                        title="Cancel"
                                                                    >
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Button
                                                                        onClick={() => handleEditClick(row, rowIdx)}
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                                        title="Edit Row"
                                                                    >
                                                                        <Edit2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => handleDeleteClick(rowIdx)}
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                        title="Delete Row"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                <td className={cn(
                                                    "border-b border-border/50",
                                                    isEditing ? "bg-gray-200" : ""
                                                )}></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {/* Pagination Controls */}
                    {totalRows > 0 && (
                        <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    Showing {startRow} - {endRow} of {totalRows}
                                </span>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
                                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                                        <SelectTrigger size="sm" className="w-auto gap-1 bg-transparent border-border/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="100">100</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={currentPage === 1 || loading}
                                        onClick={() => setCurrentPage(1)}
                                        title="First Page"
                                    >
                                        <ChevronsLeft className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={currentPage === 1 || loading}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        title="Previous Page"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                    </Button>

                                    <div className="flex items-center gap-1 mx-2">
                                        <span className="text-sm text-muted-foreground">Page</span>
                                        <Input
                                            className="h-7 w-12 px-1 text-center"
                                            value={currentPage}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val) && val >= 1) {
                                                    setCurrentPage(Math.min(val, totalPages || 1));
                                                } else if (e.target.value === '') {
                                                    // Allow empty string for typing
                                                }
                                            }}
                                            min={1}
                                            max={totalPages || 1}
                                            type="number"
                                        />
                                        <span className="text-sm text-muted-foreground">of {totalPages || 1}</span>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={currentPage >= totalPages || loading}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        title="Next Page"
                                    >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={currentPage >= totalPages || loading}
                                        onClick={() => setCurrentPage(totalPages)}
                                        title="Last Page"
                                    >
                                        <ChevronsRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Export Modal */}
            {
                showExportModal && (
                    <ExportDataModal
                        isOpen={showExportModal}
                        onClose={() => setShowExportModal(false)}
                        connectionId={connectionId}
                        databaseName={databaseName}
                        schema={schema}
                        tableName={tableName}
                    />
                )
            }
            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Row"
                message="Warning: This action cannot be undone. This will permanently delete the selected row."
                confirmText="Delete Row"
                isDestructive={true}
                verificationText={deletingRowIndex !== null && data?.rows?.[deletingRowIndex] && primaryKey ? String(data.rows[deletingRowIndex][primaryKey]) : "DELETE"}
                verificationLabel={deletingRowIndex !== null && data?.rows?.[deletingRowIndex] && primaryKey ? `Type "${String(data.rows[deletingRowIndex][primaryKey])}" to confirm` : "Type confirmation"}
            />

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
            {isFilterModalOpen && (
                <FilterTableModal
                    isOpen={isFilterModalOpen}
                    onClose={() => setIsFilterModalOpen(false)}
                    columns={data?.columns || []}
                    initialSelectedColumns={visibleColumns}
                    initialConditions={filterConditions}
                    onApply={(cols, conditions) => {
                        setVisibleColumns(cols);
                        setFilterConditions(conditions);
                        setCurrentPage(1);
                        // Manually trigger since ref-based state won't trigger the effect
                        filterConditionsRef.current = conditions;
                        setRefreshKey(prev => prev + 1);
                    }}
                />
            )}
        </div >
    );
}
