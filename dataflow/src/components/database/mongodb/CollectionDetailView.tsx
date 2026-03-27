import React, { useEffect, useState } from "react";
import { FileJson, Loader2, Database, Edit2, Trash2, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Download, Filter, RefreshCcw } from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ExportCollectionModal } from "./ExportCollectionModal";
import { FilterCollectionModal } from "./FilterCollectionModal";
import {
    useGetStorageUnitRowsLazyQuery,
    useAddRowMutation,
    useDeleteRowMutation,
    useUpdateStorageUnitMutation,
    WhereConditionType,
    type WhereCondition,
} from '@graphql';
import { resolveSchemaParam } from '@/utils/database-features';

interface CollectionDetailViewProps {
    connectionId: string;
    databaseName: string;
    collectionName: string;
    refreshTrigger?: number;
}

export function CollectionDetailView({ connectionId, databaseName, collectionName, refreshTrigger }: CollectionDetailViewProps) {
    const { connections } = useConnectionStore();
    const [getRows] = useGetStorageUnitRowsLazyQuery({ fetchPolicy: 'no-cache' });
    const [addRowMutation] = useAddRowMutation();
    const [deleteRowMutation] = useDeleteRowMutation();
    const [updateStorageUnitMutation] = useUpdateStorageUnitMutation();
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editingDoc, setEditingDoc] = useState<any>(null);
    const [editContent, setEditContent] = useState("");
    const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null);
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [addContent, setAddContent] = useState("{\n  \n}");

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalDocuments, setTotalDocuments] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [searchTerm, setSearchTerm] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    // Filter state
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [activeFilter, setActiveFilter] = useState<any>({});
    const [availableFields, setAvailableFields] = useState<string[]>([]);

    // Extract available fields from documents
    useEffect(() => {
        if (documents.length > 0) {
            const keys = new Set<string>();
            documents.slice(0, 50).forEach(doc => {
                if (typeof doc === 'object' && doc !== null) {
                    Object.keys(doc).forEach(k => keys.add(k));
                }
            });
            setAvailableFields(Array.from(keys).sort());
        }
    }, [documents]);

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

    // Reset to page 1 when search term changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setEditingDoc(null);
            setSelectedDocIndex(null);

            const conn = connections.find(c => c.id === connectionId);
            if (!conn) {
                setError("Connection not found");
                setLoading(false);
                return;
            }

            const graphqlSchema = resolveSchemaParam(conn.type, databaseName);

            // Build WhereCondition from activeFilter
            // FilterCollectionModal outputs MongoDB-native format:
            //   $eq:    { field: value }
            //   $regex: { field: { $regex: "...", $options: "i" } }
            //   others: { field: { $gt: value } }
            const filterConditions: WhereCondition[] = [];
            for (const [fieldName, cond] of Object.entries(activeFilter)) {
                if (cond === undefined || cond === null) continue;
                if (typeof cond !== 'object' || Array.isArray(cond)) {
                    // Primitive value → $eq
                    filterConditions.push({
                        Type: WhereConditionType.Atomic,
                        Atomic: { Key: fieldName, Operator: 'eq', Value: String(cond), ColumnType: 'string' },
                    });
                } else {
                    // Object with MongoDB operators: { $regex: "...", $options: "..." } or { $gt: value }
                    for (const [op, val] of Object.entries(cond as Record<string, any>)) {
                        if (op === '$options') continue; // Skip $options (handled with $regex)
                        const operator = op.replace('$', '');
                        const value = Array.isArray(val) ? val.join(', ') : String(val ?? '');
                        filterConditions.push({
                            Type: WhereConditionType.Atomic,
                            Atomic: { Key: fieldName, Operator: operator, Value: value, ColumnType: 'string' },
                        });
                    }
                }
            }

            // Add search term as regex on 'document' column if present
            if (searchTerm.trim()) {
                filterConditions.push({
                    Type: WhereConditionType.Atomic,
                    Atomic: {
                        Key: 'document',
                        Operator: 'regex',
                        Value: searchTerm.trim(),
                        ColumnType: 'string',
                    },
                });
            }

            let where: WhereCondition | undefined;
            if (filterConditions.length === 1) {
                where = filterConditions[0];
            } else if (filterConditions.length > 1) {
                where = { Type: WhereConditionType.And, And: { Children: filterConditions } };
            }

            try {
                const { data: result, error: queryError } = await getRows({
                    variables: {
                        schema: graphqlSchema,
                        storageUnit: collectionName,
                        where,
                        pageSize,
                        pageOffset: (currentPage - 1) * pageSize,
                    },
                    context: { database: databaseName },
                });

                if (queryError) {
                    setError(queryError.message);
                    return;
                }

                if (result?.Row) {
                    const parsedDocs = result.Row.Rows.map(row => {
                        try {
                            return JSON.parse(row[0]);
                        } catch {
                            return { _raw: row[0] };
                        }
                    });
                    setDocuments(parsedDocs);
                    setTotalDocuments(result.Row.TotalCount);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to fetch collection data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [connectionId, databaseName, collectionName, connections, refreshTrigger, currentPage, pageSize, searchTerm, activeFilter, refreshKey, getRows]);

    const handleAddClick = () => {
        if (documents.length > 0 && typeof documents[0] === 'object' && documents[0] !== null) {
            const template: Record<string, string> = {};
            Object.keys(documents[0]).filter(k => k !== '_id').forEach(k => { template[k] = ''; });
            setAddContent(JSON.stringify(template, null, 2));
        } else {
            setAddContent("{\n  \n}");
        }
        setShowAddModal(true);
    };

    const handleAddSave = async () => {
        try {
            const newDoc = JSON.parse(addContent);

            const conn = connections.find(c => c.id === connectionId);
            if (!conn) return;

            const graphqlSchema = resolveSchemaParam(conn.type, databaseName);
            const values = Object.entries(newDoc).map(([key, value]) => ({
                Key: key,
                Value: typeof value === 'object' && value !== null
                    ? JSON.stringify(value)
                    : String(value ?? ''),
            }));

            if (values.length === 0) {
                showAlert("Error", "Document must have at least one field", "error");
                return;
            }

            const { data: result, errors } = await addRowMutation({
                variables: {
                    schema: graphqlSchema,
                    storageUnit: collectionName,
                    values,
                },
                context: { database: databaseName },
            });

            if (errors?.length) {
                showAlert("Error", `Failed to add document: ${errors[0].message}`, "error");
                return;
            }

            if (result?.AddRow.Status) {
                showAlert("Success", "Document added successfully!", "success");
                setShowAddModal(false);
                setRefreshKey(prev => prev + 1);
            } else {
                showAlert("Error", "Failed to add document", "error");
            }
        } catch (e: any) {
            showAlert("Error", `Invalid JSON or add error: ${e.message}`, "error");
        }
    };

    const handleEditClick = (doc: any) => {
        setEditingDoc(doc);
        setEditContent(JSON.stringify(doc, null, 2));
    };

    const handleSave = async () => {
        if (!editingDoc) return;

        try {
            const updatedDoc = JSON.parse(editContent);
            const docId = editingDoc._id;

            const conn = connections.find(c => c.id === connectionId);
            if (!conn) return;

            const graphqlSchema = resolveSchemaParam(conn.type, databaseName);
            const values = [{ Key: 'document', Value: JSON.stringify({ ...updatedDoc, _id: docId }) }];
            const updatedColumns = Object.keys(updatedDoc).filter(k => k !== '_id');

            const { data: result, errors } = await updateStorageUnitMutation({
                variables: {
                    schema: graphqlSchema,
                    storageUnit: collectionName,
                    values,
                    updatedColumns,
                },
                context: { database: databaseName },
            });

            if (errors?.length) {
                showAlert("Error", `Failed to update document: ${errors[0].message}`, "error");
                return;
            }

            if (result?.UpdateStorageUnit.Status) {
                showAlert("Success", "Document updated successfully!", "success");
                setEditingDoc(null);
                setRefreshKey(prev => prev + 1);
            } else {
                showAlert("Error", "Failed to update document", "error");
            }
        } catch (e: any) {
            showAlert("Error", `Invalid JSON or update error: ${e.message}`, "error");
        }
    };

    const handleDeleteClick = (docId: string) => {
        setDeletingDocId(docId);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingDocId) return;

        const conn = connections.find(c => c.id === connectionId);
        if (!conn) return;

        const graphqlSchema = resolveSchemaParam(conn.type, databaseName);
        const values = [{ Key: 'document', Value: JSON.stringify({ _id: deletingDocId }) }];

        try {
            const { data: result, errors } = await deleteRowMutation({
                variables: {
                    schema: graphqlSchema,
                    storageUnit: collectionName,
                    values,
                },
                context: { database: databaseName },
            });

            if (errors?.length) {
                showAlert("Error", `Failed to delete document: ${errors[0].message}`, "error");
                return;
            }

            if (result?.DeleteRow.Status) {
                showAlert("Success", "Document deleted successfully!", "success");
                setRefreshKey(prev => prev + 1);
            } else {
                showAlert("Error", "Failed to delete document", "error");
            }
        } catch (e: any) {
            showAlert("Error", `Delete error: ${e.message}`, "error");
        } finally {
            setDeletingDocId(null);
            setShowDeleteModal(false);
        }
    };

    if (loading && !documents.length && !showAddModal) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center bg-muted/5">
                <div className="text-center p-8 bg-background rounded-xl shadow-sm border">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <FileJson className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                            {databaseName}.{collectionName}
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium">COLLECTION VIEW</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleAddClick}
                        size="sm"
                        className="gap-2 shadow-sm"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Data
                    </Button>
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button
                        onClick={() => setShowFilterModal(true)}
                        variant="outline"
                        size="sm"
                        className={cn(
                            "h-8 gap-2",
                            Object.keys(activeFilter).length > 0 && "bg-primary/10 text-primary border-primary/50"
                        )}
                    >
                        <div className="relative flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5" />
                            Filter
                            {Object.keys(activeFilter).length > 0 && (
                                <span className="absolute -top-2 -right-2 flex items-center justify-center w-3 h-3 text-[8px] font-bold rounded-full bg-primary text-primary-foreground">
                                    {Object.keys(activeFilter).length}
                                </span>
                            )}
                        </div>
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
                        onClick={() => {
                            setCurrentPage(1);
                            setSearchTerm("");
                            setActiveFilter({});
                        }}
                        variant="outline"
                        size="sm"
                        className={cn("h-8 gap-2", loading && "animate-spin")}
                        disabled={loading}
                    >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4 bg-muted/5">
                {documents.length === 0 ? (
                    <div className="text-center py-12">
                        <FileJson className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">No documents found in this collection</p>
                    </div>
                ) : (
                    documents.map((doc, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedDocIndex(idx)}
                            className={cn(
                                "rounded-xl border p-4 group relative transition-all duration-200 cursor-pointer",
                                selectedDocIndex === idx
                                    ? "bg-blue-50 border-blue-100 shadow-sm"
                                    : "bg-background border-border/50 hover:bg-muted/30 hover:shadow-sm"
                            )}
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(doc);
                                    }}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    title="Edit Document"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(doc._id);
                                    }}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    title="Delete Document"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <pre className="text-sm overflow-x-auto font-mono text-foreground/80">
                                {JSON.stringify(doc, null, 2).replace(/^\{\n/, '').replace(/\n\}$/, '')}
                            </pre>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {totalDocuments > 0 && (
                <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <span>
                            Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalDocuments)} of {totalDocuments} documents
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="whitespace-nowrap">Rows per page:</span>
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
                                <span>Page</span>
                                <Input
                                    className="h-7 w-12 px-1 text-center"
                                    value={currentPage}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        const totalPages = Math.ceil(totalDocuments / pageSize);
                                        if (!isNaN(val) && val >= 1) {
                                            setCurrentPage(Math.min(val, totalPages || 1));
                                        } else if (e.target.value === '') {
                                            // Allow empty string for typing
                                        }
                                    }}
                                    min={1}
                                    max={Math.ceil(totalDocuments / pageSize) || 1}
                                    type="number"
                                />
                                <span>of {Math.ceil(totalDocuments / pageSize) || 1}</span>
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={currentPage >= Math.ceil(totalDocuments / pageSize) || loading}
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalDocuments / pageSize), p + 1))}
                                title="Next Page"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={currentPage >= Math.ceil(totalDocuments / pageSize) || loading}
                                onClick={() => setCurrentPage(Math.ceil(totalDocuments / pageSize))}
                                title="Last Page"
                            >
                                <ChevronsRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold">Add New Document</h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowAddModal(false)}
                                className="h-8 w-8 rounded-full"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="p-6 flex-1 overflow-hidden flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">Enter the document content in JSON format:</p>
                            <textarea
                                className="w-full h-full min-h-[300px] p-4 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/30 resize-none"
                                value={addContent}
                                onChange={(e) => setAddContent(e.target.value)}
                                placeholder="{ ... }"
                            />
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30 rounded-b-xl">
                            <Button
                                variant="ghost"
                                onClick={() => setShowAddModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddSave}
                            >
                                Add Document
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold">Edit Document</h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingDoc(null)}
                                className="h-8 w-8 rounded-full"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="p-6 flex-1 overflow-hidden">
                            <textarea
                                className="w-full h-full min-h-[300px] p-4 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/30 resize-none"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30 rounded-b-xl">
                            <Button
                                variant="ghost"
                                onClick={() => setEditingDoc(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ExportCollectionModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                connectionId={connectionId}
                databaseName={databaseName}
                collectionName={collectionName}
            />

            <FilterCollectionModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={(filter) => {
                    setActiveFilter(filter);
                    setCurrentPage(1);
                }}
                fields={availableFields}
                initialFilter={activeFilter}
            />

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Document"
                message="Are you sure you want to delete this document? This action cannot be undone."
                confirmText="Delete"
                isDestructive={true}
            />

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}
