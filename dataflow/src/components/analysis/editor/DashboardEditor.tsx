import { useState, useCallback } from "react";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { Plus, Layout, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

import { EditorCanvas } from "./EditorCanvas";
import { ChartCreateModal } from "../chart-create/ChartCreateModal";
import { MaximizeChartModal } from "./MaximizeChartModal";
import { ComponentSettingsModal } from "./ComponentSettingsModal";
import { DeleteComponentModal } from "./DeleteComponentModal";
import { useI18n } from '@/i18n/useI18n'
import { useRawExecuteLazyQuery } from '@graphql'
import { toWidgetConfig } from '../chart-utils'
import type { ChartConfig } from '../chart-utils'

export function DashboardEditor() {
    const { t } = useI18n()
    const {
        dashboards,
        activeDashboardId,
        selectComponent,
        updateComponent,
        isChartModalOpen,
        toggleChartModal,
    } = useAnalysisStore();

    const [rawExecute] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' });
    const [isRefreshing, setIsRefreshing] = useState(false);

    const dashboard = dashboards.find(d => d.id === activeDashboardId);

    const handleRefresh = useCallback(async () => {
        if (!dashboard) return;

        const chartComponents = dashboard.components.filter(
            c => c.type === 'chart' && c.query && c.config?.chartConfig
        );
        if (chartComponents.length === 0) return;

        setIsRefreshing(true);
        try {
            await Promise.all(chartComponents.map(async (component) => {
                const { data, error } = await rawExecute({
                    variables: { query: component.query! },
                    context: { database: component.queryContext?.database },
                });
                if (error || !data?.RawExecute) return;

                const raw = data.RawExecute;
                const columns = raw.Columns.map(c => c.Name);
                const rows = raw.Rows.map(row =>
                    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
                );

                const chartConfig = component.config.chartConfig as ChartConfig;
                const { config, data: widgetData } = toWidgetConfig(chartConfig, {
                    columns,
                    rows,
                    query: component.query!,
                    database: component.queryContext?.database,
                    schema: component.queryContext?.schema,
                });

                updateComponent(component.id, { config, data: widgetData });
            }));
        } finally {
            setIsRefreshing(false);
        }
    }, [dashboard, rawExecute, updateComponent]);

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [maximizedComponentId, setMaximizedComponentId] = useState<string | null>(null);
    const [deleteComponentId, setDeleteComponentId] = useState<string | null>(null);

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

                <div className="flex items-center gap-3 ml-auto">
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {t('analysis.dashboard.refresh')}
                    </Button>
                    <Button
                        onClick={() => toggleChartModal(true)}
                    >
                        <Plus className="w-4 h-4" />
                        {t('analysis.chart.add')}
                    </Button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 overflow-auto">
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
                            {t('analysis.editor.emptyTitle')}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-6">
                            {t('analysis.editor.emptyDescription')}
                        </p>
                        <Button
                            onClick={() => toggleChartModal(true)}
                        >
                            <Plus className="w-4 h-4" />
                            {t('analysis.chart.add')}
                        </Button>
                    </div>
                )}
            </div>

            <ChartCreateModal
                open={isChartModalOpen}
                onOpenChange={(open) => { if (!open) toggleChartModal(false) }}
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
