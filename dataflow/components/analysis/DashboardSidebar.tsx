import React, { useState } from "react";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { Plus, Search, LayoutDashboard, SlidersHorizontal, Edit2, Trash2, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextMenu } from "../ui/ContextMenu";

export function DashboardSidebar() {
    const { dashboards, activeDashboardId, openDashboard, createDashboard, updateDashboard, deleteDashboard, isDashboardNameExists } = useAnalysisStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newDashboardName, setNewDashboardName] = useState("");
    const [sortOrder, setSortOrder] = useState<'name' | 'date'>('date');
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);

    // Modals State
    const [renameModal, setRenameModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });

    // Close context menu on click outside
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const filteredDashboards = dashboards
        .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortOrder === 'name') return a.name.localeCompare(b.name);
            // Use createdAt for stable ordering - clicking/editing won't change position
            return b.createdAt - a.createdAt;
        });

    const handleCreate = () => {
        if (!newDashboardName.trim()) return;
        if (isDashboardNameExists(newDashboardName)) {
            setNameError('仪表板名称已存在，请使用其他名称');
            return;
        }
        createDashboard(newDashboardName);
        setIsCreateModalOpen(false);
        setNewDashboardName("");
        setNameError(null);
    };

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, id });
    };

    const handleRename = () => {
        if (!renameModal.name.trim()) return;
        if (isDashboardNameExists(renameModal.name, renameModal.id)) {
            setNameError('仪表板名称已存在，请使用其他名称');
            return;
        }
        updateDashboard(renameModal.id, { name: renameModal.name });
        setRenameModal({ isOpen: false, id: '', name: '' });
        setNameError(null);
    };

    const handleDelete = () => {
        deleteDashboard(deleteModal.id);
        setDeleteModal({ isOpen: false, id: '', name: '' });
    };

    return (
        <div className="flex flex-col h-full w-64 border-r bg-background shrink-0 relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b h-14">
                <h2 className="font-semibold text-sm">仪表板</h2>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="新建仪表板"
                >
                    <PlusCircle className="w-5 h-5" />
                </button>
            </div>

            {/* Search & Sort */}
            <div className="p-3 border-b flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="搜索"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-muted/20 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                </div>
                <div className="relative">
                    <button
                        onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                        className={cn(
                            "p-1.5 border rounded-md hover:bg-muted text-muted-foreground transition-colors",
                            isSortMenuOpen && "bg-muted text-foreground"
                        )}
                        title="排序"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {isSortMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-popover border rounded-md shadow-md z-20 py-1">
                            <button
                                onClick={() => { setSortOrder('date'); setIsSortMenuOpen(false); }}
                                className={cn(
                                    "w-full text-left px-3 py-1.5 text-xs hover:bg-muted",
                                    sortOrder === 'date' && "text-primary font-medium"
                                )}
                            >
                                按时间排序
                            </button>
                            <button
                                onClick={() => { setSortOrder('name'); setIsSortMenuOpen(false); }}
                                className={cn(
                                    "w-full text-left px-3 py-1.5 text-xs hover:bg-muted",
                                    sortOrder === 'name' && "text-primary font-medium"
                                )}
                            >
                                按名称排序
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredDashboards.map(dashboard => (
                    <div
                        key={dashboard.id}
                        onClick={() => openDashboard(dashboard.id)}
                        onContextMenu={(e) => handleContextMenu(e, dashboard.id)}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm group select-none",
                            activeDashboardId === dashboard.id
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted text-foreground/80"
                        )}
                    >
                        <LayoutDashboard className={cn(
                            "w-4 h-4",
                            activeDashboardId === dashboard.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        <span className="truncate">{dashboard.name}</span>
                    </div>
                ))}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        {
                            label: "添加图表",
                            icon: <Plus className="w-4 h-4" />,
                            onClick: () => {
                                const dashboard = dashboards.find(d => d.id === contextMenu.id);
                                if (dashboard) {
                                    openDashboard(dashboard.id);
                                    useAnalysisStore.getState().toggleChartModal(true);
                                }
                            }
                        },
                        { separator: true },
                        {
                            label: "重命名",
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => {
                                const dashboard = dashboards.find(d => d.id === contextMenu.id);
                                if (dashboard) setRenameModal({ isOpen: true, id: dashboard.id, name: dashboard.name });
                            }
                        },
                        { separator: true },
                        {
                            label: "删除",
                            icon: <Trash2 className="w-4 h-4" />,
                            danger: true,
                            onClick: () => {
                                const dashboard = dashboards.find(d => d.id === contextMenu.id);
                                if (dashboard) setDeleteModal({ isOpen: true, id: dashboard.id, name: dashboard.name });
                            }
                        }
                    ]}
                />
            )}

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border rounded-lg shadow-lg p-4 animate-in fade-in zoom-in-95">
                        <h3 className="font-medium mb-3">新建仪表板</h3>
                        <input
                            type="text"
                            value={newDashboardName}
                            onChange={e => { setNewDashboardName(e.target.value); setNameError(null); }}
                            maxLength={15}
                            className={cn(
                                "w-full px-3 py-2 rounded-md border bg-background text-sm",
                                nameError ? "border-destructive mb-1" : "mb-4"
                            )}
                            placeholder="输入仪表板名称"
                            autoFocus
                        />
                        {nameError && (
                            <p className="text-xs text-destructive mb-3">{nameError}</p>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setIsCreateModalOpen(false); setNameError(null); setNewDashboardName(''); }}
                                className="px-3 py-1.5 text-xs font-medium hover:bg-muted rounded-md"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newDashboardName.trim()}
                                className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                            >
                                创建
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {renameModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border rounded-lg shadow-lg p-4 animate-in fade-in zoom-in-95">
                        <h3 className="font-medium mb-3">重命名仪表板</h3>
                        <input
                            type="text"
                            value={renameModal.name}
                            onChange={e => { setRenameModal({ ...renameModal, name: e.target.value }); setNameError(null); }}
                            maxLength={15}
                            className={cn(
                                "w-full px-3 py-2 rounded-md border bg-background text-sm",
                                nameError ? "border-destructive mb-1" : "mb-4"
                            )}
                            autoFocus
                        />
                        {nameError && (
                            <p className="text-xs text-destructive mb-3">{nameError}</p>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setRenameModal({ ...renameModal, isOpen: false }); setNameError(null); }}
                                className="px-3 py-1.5 text-xs font-medium hover:bg-muted rounded-md"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleRename}
                                disabled={!renameModal.name.trim()}
                                className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border rounded-lg shadow-lg p-4 animate-in fade-in zoom-in-95">
                        <h3 className="font-medium mb-2">删除仪表板</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            确定要删除 "{deleteModal.name}" 吗？此操作无法撤销。
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                                className="px-3 py-1.5 text-xs font-medium hover:bg-muted rounded-md"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
