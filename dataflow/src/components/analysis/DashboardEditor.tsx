import React from "react";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { Plus, Layout } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

import { EditorCanvas } from "./EditorCanvas";
import { ChartCreateModal } from "./ChartCreateModal";
import { MaximizeChartModal } from "./MaximizeChartModal";
import { ComponentSettingsModal } from "./ComponentSettingsModal";
import { DeleteComponentModal } from "./DeleteComponentModal";

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
                        Add Chart
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
                                    Dashboard is Empty
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                                    This dashboard has no components. Add a chart to start building your data visualization.
                                </p>
                                <button
                                    onClick={() => toggleChartModal(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Chart
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

            <DeleteComponentModal
                open={!!deleteComponentId}
                onOpenChange={(open) => { if (!open) setDeleteComponentId(null) }}
                componentId={deleteComponentId ?? ''}
                onSuccess={() => setDeleteComponentId(null)}
            />
        </div>
    );
}
