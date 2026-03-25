import React, { useEffect, useState } from "react";
import { FileJson, Loader2, Database, Edit2, Trash2, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Plus, Save, Copy, Download, Filter, RefreshCcw } from "lucide-react";
import { useConnections } from "@/contexts/ConnectionContext";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { ExportCollectionModal } from "@/components/database/ExportCollectionModal";
import { FilterCollectionModal } from "@/components/database/FilterCollectionModal";

interface CollectionDetailViewProps {
    connectionId: string;
    databaseName: string;
    collectionName: string;
    refreshTrigger?: number;
}

export function CollectionDetailView({ connectionId, databaseName, collectionName, refreshTrigger }: CollectionDetailViewProps) {
    const { connections } = useConnections();
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

            try {
                const response = await fetch('/api/connections/fetch-collection-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: conn.type.toLowerCase(),
                        host: conn.host,
                        port: conn.port,
                        user: conn.user,
                        password: conn.password,
                        databaseName,
                        collectionName,
                        page: currentPage,
                        limit: pageSize,
                        searchTerm: searchTerm.trim(),
                        filter: activeFilter
                    }),
                });

                const result = await response.json();
                if (result.success) {
                    setDocuments(result.documents || []);
                    setTotalDocuments(result.total || 0);
                } else {
                    setError(result.error || 'Failed to fetch collection data');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to fetch collection data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [connectionId, databaseName, collectionName, connections, refreshTrigger, currentPage, pageSize, searchTerm, activeFilter]);

    // Listen for refresh events
    useEffect(() => {
        const handleRefresh = () => {
            // Re-fetch data logic is inside the other useEffect which depends on refreshTrigger.
            // But for internal updates, we might want to trigger a re-fetch.
            // Since fetchData is inside the effect, we can't call it directly.
            // We can force a re-render or use a local refresh key if needed.
            // For now, the handleSave/handleDelete updates local state, so we are good.
        };
        window.addEventListener('refreshCollection', handleRefresh);
        return () => window.removeEventListener('refreshCollection', handleRefresh);
    }, []);

    const handleAddClick = async () => {
        const conn = connections.find(c => c.id === connectionId);
        if (!conn) return;

        // Fetch schema template from backend
        try {
            const response = await fetch('/api/connections/fetch-collection-schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: conn.type.toLowerCase(),
                    host: conn.host,
                    port: conn.port,
                    user: conn.user,
                    password: conn.password,
                    databaseName,
                    collectionName
                }),
            });

            const result = await response.json();
            if (result.success && result.template) {
                setAddContent(JSON.stringify(result.template, null, 2));
            } else {
                // Fallback to empty template
                setAddContent("{\n  \n}");
            }
        } catch (e) {
            console.error('Failed to fetch schema template:', e);
            // Fallback to empty template
            setAddContent("{\n  \n}");
        }

        setShowAddModal(true);
    };

    const handleAddSave = async () => {
        try {
            const newDoc = JSON.parse(addContent);

            const conn = connections.find(c => c.id === connectionId);
            if (!conn) return;

            const response = await fetch('/api/connections/create-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: conn.type.toLowerCase(),
                    host: conn.host,
                    port: conn.port,
                    user: conn.user,
                    password: conn.password,
                    databaseName,
                    collectionName,
                    document: newDoc
                }),
            });

            const result = await response.json();
            if (result.success) {
                showAlert("Success", "Document added successfully!", "success");
                setShowAddModal(false);

                // Refresh data by re-fetching
                setLoading(true);
                const fetchResponse = await fetch('/api/connections/fetch-collection-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: conn.type.toLowerCase(),
                        host: conn.host,
                        port: conn.port,
                        user: conn.user,
                        password: conn.password,
                        databaseName,
                        collectionName,
                        page: currentPage,
                        limit: pageSize,
                        searchTerm: searchTerm.trim()
                    }),
                });

                const fetchResult = await fetchResponse.json();
                if (fetchResult.success) {
                    setDocuments(fetchResult.documents || []);
                    setTotalDocuments(fetchResult.total || 0);
                }
                setLoading(false);
            } else {
                showAlert("Error", `Failed to add document: ${result.error}`, "error");
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

            const response = await fetch('/api/connections/update-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: conn.type.toLowerCase(),
                    host: conn.host,
                    port: conn.port,
                    user: conn.user,
                    password: conn.password,
                    databaseName,
                    collectionName,
                    documentId: docId,
                    updates: updatedDoc
                }),
            });

            const result = await response.json();
            if (result.success) {
                showAlert("Success", "Document updated successfully!", "success");
                setEditingDoc(null);
                setDocuments(prev => prev.map(d => d._id === docId ? { ...updatedDoc, _id: docId } : d));
            } else {
                showAlert("Error", `Failed to update document: ${result.error}`, "error");
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

        try {
            const response = await fetch('/api/connections/delete-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: conn.type.toLowerCase(),
                    host: conn.host,
                    port: conn.port,
                    user: conn.user,
                    password: conn.password,
                    databaseName,
                    collectionName,
                    documentId: deletingDocId
                }),
            });

            const result = await response.json();
            if (result.success) {
                showAlert("Success", "Document deleted successfully!", "success");
                setDocuments(prev => prev.filter(d => d._id !== deletingDocId));
                setTotalDocuments(prev => Math.max(0, prev - 1));
            } else {
                showAlert("Error", `Failed to delete document: ${result.error}`, "error");
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
                <div className="text-center p-8 bg-background rounded-xl shadow-nebula-card border">
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
                                    : "bg-background border-border/50 hover:bg-muted/30 hover:shadow-nebula-card"
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
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
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
                    <div className="bg-card w-full max-w-2xl rounded-xl shadow-nebula-modal border animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
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
                    <div className="bg-card w-full max-w-2xl rounded-xl shadow-nebula-modal border animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
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
