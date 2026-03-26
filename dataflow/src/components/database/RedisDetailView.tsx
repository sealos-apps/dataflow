import React, { useState, useEffect, useCallback } from 'react';
import {
    Search,
    RefreshCw,
    Plus,
    Trash2,
    Download,
    Filter,
    Edit2,
    List,
    Loader2,
    Database,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Check,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectionStore } from "@/stores/useConnectionStore";
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RedisKeyModal } from './RedisKeyModal';
import { AlertModal } from '@/components/ui/AlertModal';
import { RedisFilterModal } from './RedisFilterModal';
import { ExportRedisModal } from './ExportRedisModal';

interface RedisKey {
    key: string;
    type: string;
    value: string;
    ttl: number;
}

interface RedisDetailViewProps {
    connectionId: string;
    databaseName: string; // e.g., "db0"
}

export function RedisDetailView({ connectionId, databaseName }: RedisDetailViewProps) {
    const { connections } = useConnectionStore();
    const [keys, setKeys] = useState<RedisKey[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filter State
    const [pattern, setPattern] = useState('*');
    const [filterTypes, setFilterTypes] = useState<string[]>([]);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [total, setTotal] = useState(0);

    // Modals State
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState<RedisKey | undefined>(undefined);
    const [deletingKey, setDeletingKey] = useState<RedisKey | undefined>(undefined);
    const [showExportModal, setShowExportModal] = useState(false);

    // Alert Modal State
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

    const fetchKeys = useCallback(async () => {
        const conn = connections.find(c => c.id === connectionId);
        if (!conn) {
            console.error('Connection not found:', connectionId);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/connections/fetch-redis-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: conn.host,
                    port: conn.port,
                    password: conn.password,
                    database: databaseName,
                    page,
                    pageSize,
                    pattern,
                    types: filterTypes // Pass types to backend
                })
            });
            const data = await response.json();
            if (data.success) {
                setKeys(data.data);
                setTotal(data.total);
            }
        } catch (error) {
            console.error('Failed to fetch Redis keys:', error);
        } finally {
            setIsLoading(false);
        }
    }, [connections, connectionId, databaseName, page, pageSize, pattern, filterTypes]);

    useEffect(() => {
        fetchKeys();
    }, [fetchKeys]);

    const handleApplyFilter = (newPattern: string, newTypes: string[]) => {
        setPattern(newPattern);
        setFilterTypes(newTypes);
        setPage(1); // Reset to first page
        // fetchKeys will be triggered by useEffect
    };

    // Action Handlers
    const handleSaveKey = async (keyData: any) => {
        const conn = connections.find(c => c.id === connectionId);
        if (!conn) return;

        const endpoint = editingKey
            ? '/api/connections/redis/key/update'
            : '/api/connections/redis/key/create';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: conn.host,
                    port: conn.port,
                    password: conn.password,
                    database: databaseName,
                    originalKey: editingKey?.key, // Pass original key for rename support
                    ...keyData
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }

            // Show success alert
            setAlertState({
                isOpen: true,
                title: 'Success',
                message: `Key "${keyData.key}" ${editingKey ? 'updated' : 'created'} successfully!`,
                type: 'success'
            });

            // Close modal immediately on success
            setEditingKey(undefined);
            setIsAddModalOpen(false);

            // Refresh keys
            fetchKeys();
        } catch (error: any) {
            console.error('Failed to save key:', error);
            // Show error alert
            setAlertState({
                isOpen: true,
                title: 'Error',
                message: error.message || 'Failed to save key',
                type: 'error'
            });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingKey) return;
        const conn = connections.find(c => c.id === connectionId);
        if (!conn) return;

        try {
            const response = await fetch('/api/connections/redis/key/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: conn.host,
                    port: conn.port,
                    password: conn.password,
                    database: databaseName,
                    key: deletingKey.key
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }

            // Show success alert
            setAlertState({
                isOpen: true,
                title: 'Success',
                message: 'Row updated successfully!', // Using generic message as per screenshot, or we can be specific
                type: 'success'
            });
            // Correction: The screenshot says "Row updated successfully!", but this is a delete action. 
            // I should stick to contextually appropriate messages but keep the modal style.
            // Screenshot context was "updated", here it is "deleted".
            setAlertState({
                isOpen: true,
                title: 'Success',
                message: `Key "${deletingKey.key}" deleted successfully!`,
                type: 'success'
            });

            setDeletingKey(undefined);
            fetchKeys();
        } catch (error: any) {
            console.error('Failed to delete key:', error);
            setAlertState({
                isOpen: true,
                title: 'Error',
                message: error.message || 'Failed to delete key',
                type: 'error'
            });
        }
    };

    // Pagination calculations
    const totalPages = Math.ceil(total / pageSize);
    const startRow = (page - 1) * pageSize + 1;
    const endRow = Math.min(page * pageSize, total);

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <List className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                            {databaseName}
                            <span className="text-muted-foreground font-normal text-sm ml-2">({total} Keys)</span>
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium">REDIS KEY VIEW</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => {
                            setEditingKey(undefined);
                            setIsAddModalOpen(true);
                        }}
                        size="sm"
                        className="gap-2 shadow-sm"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Key
                    </Button>
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2"
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
                        onClick={() => fetchKeys()}
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Applied Filters Bar */}
            {(pattern !== '*' || filterTypes.length > 0) && (
                <div className="px-6 py-2 bg-muted/30 border-b border-border/50 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground mr-2">Filtered by:</span>

                    {pattern !== '*' && (
                        <div className="flex items-center gap-1 bg-background border border-border rounded-full px-3 py-1 text-xs">
                            <span className="text-muted-foreground">Pattern:</span>
                            <span className="font-medium">{pattern}</span>
                            <button
                                onClick={() => handleApplyFilter('*', filterTypes)}
                                className="ml-1 hover:text-destructive"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )}

                    {filterTypes.length > 0 && (
                        <div className="flex items-center gap-1 bg-background border border-border rounded-full px-3 py-1 text-xs">
                            <span className="text-muted-foreground">Types:</span>
                            <span className="font-medium">{filterTypes.map(t => t.toUpperCase()).join(', ')}</span>
                            <button
                                onClick={() => handleApplyFilter(pattern, [])}
                                className="ml-1 hover:text-destructive"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-destructive ml-auto"
                        onClick={() => handleApplyFilter('*', [])}
                    >
                        Clear All
                    </Button>
                </div>
            )}

            {/* Data Grid */}
            <div className="flex-1 overflow-hidden bg-muted/5 p-6 flex flex-col">
                <div className="bg-background rounded-xl shadow-nebula-card border border-border/50 overflow-hidden flex-1 flex flex-col">
                    {isLoading && keys.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="overflow-auto flex-1">
                            <table className="min-w-full divide-y divide-border/50 border-collapse">
                                <thead className="bg-background border-b border-border/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wider border-r border-border/50 w-[300px] sticky top-0 bg-background z-40">Key</th>
                                        <th className="px-6 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wider border-r border-border/50 w-[100px] sticky top-0 bg-background z-40">Type</th>
                                        <th className="px-6 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wider border-r border-border/50 sticky top-0 bg-background z-40">Value</th>
                                        <th className="px-6 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wider border-r border-border/50 w-[150px] sticky top-0 bg-background z-40">TTL</th>
                                        <th className="px-6 py-3 text-right font-medium text-xs text-muted-foreground uppercase tracking-wider sticky top-0 right-0 bg-background z-50 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] w-[100px]">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50 bg-background">
                                    {keys.map((key) => (
                                        <tr
                                            key={key.key}
                                            className="group transition-colors hover:bg-muted/30"
                                        >
                                            <td className="px-6 py-2 border-r border-b border-border/50 font-medium text-foreground min-w-[200px] max-w-[400px] truncate" title={key.key}>
                                                {key.key}
                                            </td>
                                            <td className="px-6 py-2 border-r border-b border-border/50">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider inline-block min-w-[50px] text-center",
                                                    key.type === 'string' && "bg-blue-100 text-blue-700",
                                                    key.type === 'hash' && "bg-purple-100 text-purple-700",
                                                    key.type === 'list' && "bg-emerald-100 text-emerald-700",
                                                    key.type === 'set' && "bg-orange-100 text-orange-700",
                                                    key.type === 'zset' && "bg-pink-100 text-pink-700",
                                                    key.type === 'stream' && "bg-cyan-100 text-cyan-700",
                                                )}>
                                                    {key.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-2 border-r border-b border-border/50">
                                                <div className="truncate max-w-[400px] text-muted-foreground font-mono text-xs" title={key.value}>
                                                    {key.value}
                                                </div>
                                            </td>
                                            <td className="px-6 py-2 border-r border-b border-border/50 text-muted-foreground text-xs tabular-nums">
                                                {key.ttl}
                                            </td>
                                            <td className="px-6 py-2 text-right whitespace-nowrap sticky right-0 bg-background group-hover:bg-muted/30 transition-colors z-20 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] border-b border-border/50">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                        onClick={async () => {
                                                            try {
                                                                setIsLoading(true);
                                                                const conn = connections.find(c => c.id === connectionId);
                                                                if (!conn) return;

                                                                const response = await fetch('/api/connections/fetch-redis-key-detail', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        host: conn.host,
                                                                        port: conn.port,
                                                                        password: conn.password,
                                                                        database: databaseName,
                                                                        key: key.key
                                                                    })
                                                                });

                                                                const result = await response.json();
                                                                if (result.success) {
                                                                    setEditingKey(result.data);
                                                                    setIsAddModalOpen(true);
                                                                } else {
                                                                    alert('Failed to fetch key details: ' + result.error);
                                                                }
                                                            } catch (error) {
                                                                console.error('Fetch key details error:', error);
                                                                alert('Failed to fetch key details');
                                                            } finally {
                                                                setIsLoading(false);
                                                            }
                                                        }}
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                        onClick={() => setDeletingKey(key)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {keys.length === 0 && !isLoading && (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-muted-foreground">
                                                No keys found matching your criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="border-t border-border/50 px-4 py-3 bg-muted/20 flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span>Showing {startRow} - {endRow} of {total} keys</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap">Rows per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="bg-transparent border border-border/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
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
                                    disabled={page === 1}
                                    onClick={() => setPage(1)}
                                    title="First Page"
                                >
                                    <ChevronsLeft className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    title="Previous Page"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>

                                <div className="flex items-center gap-1 mx-2">
                                    <span>Page</span>
                                    <Input
                                        className="h-7 w-12 px-1 text-center"
                                        value={page}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 1) {
                                                setPage(Math.min(val, totalPages || 1));
                                            } else if (e.target.value === '') {
                                                // Allow empty string
                                            }
                                        }}
                                        min={1}
                                        max={totalPages || 1}
                                        type="number"
                                    />
                                    <span>of {totalPages || 1}</span>
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={page * pageSize >= total}
                                    onClick={() => setPage(p => p + 1)}
                                    title="Next Page"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={page * pageSize >= total}
                                    onClick={() => setPage(totalPages || 1)}
                                    title="Last Page"
                                >
                                    <ChevronsRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <RedisKeyModal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setEditingKey(undefined);
                }}
                onSave={handleSaveKey}
                initialData={editingKey}
            />

            <ConfirmationModal
                isOpen={!!deletingKey}
                onClose={() => setDeletingKey(undefined)}
                onConfirm={handleConfirmDelete}
                title="Delete Key"
                message={`Are you sure you want to delete key "${deletingKey}" ? This action cannot be undone.`}
                confirmText="Delete"
                isDestructive
            />

            <ExportRedisModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                connectionId={connectionId}
                databaseName={databaseName}
                initialPattern={pattern}
                initialTypes={filterTypes}
            />

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />

            <RedisFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onApply={handleApplyFilter}
                initialPattern={pattern}
                initialTypes={filterTypes}
            />
        </div>
    );
}
