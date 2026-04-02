import { useState } from "react";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import type { Dashboard } from "@/stores/useAnalysisStore";
import { Plus, LayoutDashboard, Edit2, Trash2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { DashboardFormModal } from './DashboardFormModal'
import { DeleteDashboardModal } from './DeleteDashboardModal'
import { useI18n } from '@/i18n/useI18n'
import { Separator } from "../ui/separator";

export function DashboardSidebar() {
    const { t } = useI18n()
    const { dashboards, activeDashboardId, openDashboard } = useAnalysisStore();

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);

    // Modal State
    const [createOpen, setCreateOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Dashboard | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

    const sortedDashboards = [...dashboards].sort((a, b) => b.createdAt - a.createdAt);

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, id });
    };

    return (
        <div className="flex flex-col h-full w-full border-r border-sidebar-border bg-sidebar">
            {/* Header */}
            <div className="flex items-center px-4 pt-5 pb-2 shrink-0">
                <span className="text-xl font-medium text-sidebar-foreground">{t('analysis.dashboard.listTitle')}</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-2.5 py-2">
                <div className="flex flex-col gap-2">
                    {/* Create Button */}
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="w-full rounded-lg"
                    >
                        <Plus className="w-4 h-4" />
                        {t('analysis.dashboard.create')}
                    </Button>

                    {/* Separator */}
                    <Separator className="my-2" />

                    {/* List */}
                    {sortedDashboards.map(dashboard => (
                        <div
                            key={dashboard.id}
                            onClick={() => openDashboard(dashboard.id)}
                            onContextMenu={(e) => handleContextMenu(e, dashboard.id)}
                            className={cn(
                                "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm select-none",
                                activeDashboardId === dashboard.id
                                    ? "bg-input text-accent-foreground"
                                    : "text-foreground hover:bg-input"
                            )}
                        >
                            <LayoutDashboard className="w-4 h-4 shrink-0" />
                            <span className="truncate flex-1">{dashboard.name}</span>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleContextMenu(e, dashboard.id);
                                }}
                                className="shrink-0 hover:bg-muted-foreground/20 text-muted-foreground cursor-pointer"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

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
                            label: t('analysis.dashboard.edit'),
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => {
                                const d = dashboards.find(d => d.id === contextMenu.id);
                                if (d) setEditTarget(d);
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

            <DashboardFormModal open={createOpen} onOpenChange={setCreateOpen} />
            <DashboardFormModal
                open={!!editTarget}
                onOpenChange={(open) => { if (!open) setEditTarget(null) }}
                dashboard={editTarget ?? undefined}
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
