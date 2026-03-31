import { useState } from "react";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { Plus, Search, LayoutDashboard, SlidersHorizontal, Edit2, Trash2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ContextMenu } from "../../ui/ContextMenu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateDashboardModal } from './CreateDashboardModal'
import { RenameDashboardModal } from './RenameDashboardModal'
import { DeleteDashboardModal } from './DeleteDashboardModal'
import { useI18n } from '@/i18n/useI18n'

export function DashboardSidebar() {
    const { t } = useI18n()
    const { dashboards, activeDashboardId, openDashboard } = useAnalysisStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOrder, setSortOrder] = useState<'name' | 'date'>('date');

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);

    // Modal State
    const [createOpen, setCreateOpen] = useState(false)
    const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

    const filteredDashboards = dashboards
        .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortOrder === 'name') return a.name.localeCompare(b.name);
            // Use createdAt for stable ordering - clicking/editing won't change position
            return b.createdAt - a.createdAt;
        });

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, id });
    };

    return (
        <div className="flex flex-col h-full w-64 border-r bg-background shrink-0 relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b h-14">
                <h2 className="font-semibold text-sm">{t('analysis.dashboard.listTitle')}</h2>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={t('analysis.dashboard.create')}
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
                        placeholder={t('common.search.placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-muted/20 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon-sm" className="text-muted-foreground" title={t('analysis.dashboard.sort')}>
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                            onSelect={() => setSortOrder('date')}
                            className={cn(sortOrder === 'date' && "bg-accent text-accent-foreground")}
                        >
                            {t('analysis.dashboard.sortByDate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => setSortOrder('name')}
                            className={cn(sortOrder === 'name' && "bg-accent text-accent-foreground")}
                        >
                            {t('analysis.dashboard.sortByName')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
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
            </ScrollArea>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        {
                            label: t('analysis.chart.add'),
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
                            label: t('analysis.dashboard.rename'),
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => {
                                const d = dashboards.find(d => d.id === contextMenu.id);
                                if (d) setRenameTarget({ id: d.id, name: d.name });
                                setContextMenu(null);
                            }
                        },
                        { separator: true },
                        {
                            label: t('analysis.dashboard.delete'),
                            icon: <Trash2 className="w-4 h-4" />,
                            danger: true,
                            onClick: () => {
                                const d = dashboards.find(d => d.id === contextMenu.id);
                                if (d) setDeleteTarget({ id: d.id, name: d.name });
                                setContextMenu(null);
                            }
                        }
                    ]}
                />
            )}

            <CreateDashboardModal open={createOpen} onOpenChange={setCreateOpen} />
            <RenameDashboardModal
                open={!!renameTarget}
                onOpenChange={(open) => { if (!open) setRenameTarget(null) }}
                dashboardId={renameTarget?.id ?? ''}
                currentName={renameTarget?.name ?? ''}
            />
            <DeleteDashboardModal
                open={!!deleteTarget}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                dashboardId={deleteTarget?.id ?? ''}
                dashboardName={deleteTarget?.name ?? ''}
            />
        </div>
    );
}
