import React from "react";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { Plus, Layout } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

import { EditorCanvas } from "./EditorCanvas";
import { ChartCreateModal } from "./ChartCreateModal";
import { MaximizeChartModal } from "./MaximizeChartModal";
import { ComponentSettingsModal } from "./ComponentSettingsModal";

export function DashboardEditor() {
    const {
        dashboards,
        activeDashboardId,

        isEditorMode,
        toggleEditorMode,
        addComponent,
        selectComponent,
        isChartModalOpen,
        toggleChartModal,
        removeComponent
    } = useAnalysisStore();

    const [isSettingsModalOpen, setIsSettingsModalOpen] = React.useState(false);
    const [maximizedComponentId, setMaximizedComponentId] = React.useState<string | null>(null);
    const [deleteComponentId, setDeleteComponentId] = React.useState<string | null>(null);

    const dashboard = dashboards.find(d => d.id === activeDashboardId);

    if (!dashboard) return null;

    const handleEditComponent = (id: string) => {
        selectComponent(id);
        setIsSettingsModalOpen(true);
    };

    const handleDeleteComponent = (id: string) => {
        removeComponent(id);
        setDeleteComponentId(null);
    };

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-background z-20">
                <div className="flex items-center gap-4">
                    <div className="font-bold text-lg">
                        {dashboard.name}
                    </div>
                </div>

                {/* Toolbar buttons removed as requested */}

                <div className="flex items-center gap-3 ml-auto">
                    <button
                        onClick={() => toggleChartModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        添加图表
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden relative">


                {/* Center Canvas */}
                <ScrollArea className="flex-1 bg-muted/5 relative">
                    <div className="p-8">
                    <div className="min-h-full mx-auto max-w-[1600px] bg-background rounded-xl shadow-sm border border-border/40 min-h-[800px] transition-all duration-300">
                        {dashboard.components.length > 0 ? (
                            <EditorCanvas
                                dashboard={dashboard}
                                isReadOnly={false}
                                onEditComponent={handleEditComponent}
                                onMaximizeComponent={setMaximizedComponentId}
                                onDeleteComponent={setDeleteComponentId}
                            />
                        ) : (
                            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-8">
                                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                    <Layout className="w-8 h-8 text-muted-foreground/50" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    仪表板为空
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                                    此仪表板没有任何组件。添加图表开始构建您的数据可视化视图。
                                </p>
                                <button
                                    onClick={() => toggleChartModal(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    添加图表
                                </button>
                            </div>
                        )}
                    </div>
                    </div>
                </ScrollArea>
            </div>

            <ChartCreateModal
                isOpen={isChartModalOpen}
                onClose={() => toggleChartModal(false)}
            />

            <ComponentSettingsModal
                open={isSettingsModalOpen}
                onOpenChange={setIsSettingsModalOpen}
            />

            <MaximizeChartModal
                open={!!maximizedComponentId}
                onOpenChange={(open) => { if (!open) setMaximizedComponentId(null) }}
                componentId={maximizedComponentId}
            />

            {/* Delete Confirmation Modal */}
            {deleteComponentId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-card border rounded-lg shadow-lg p-4 animate-in fade-in zoom-in-95">
                        <h3 className="font-medium mb-2">删除组件</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            确定要删除此组件吗？此操作无法撤销。
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteComponentId(null)}
                                className="px-3 py-1.5 text-xs font-medium hover:bg-muted rounded-md"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => handleDeleteComponent(deleteComponentId)}
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
