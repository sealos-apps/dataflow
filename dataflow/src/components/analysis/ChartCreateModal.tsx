import React, { useState, useCallback } from 'react';
import { X, ChevronLeft, BarChart3 } from 'lucide-react';
import { useAnalysisStore } from '@/stores/useAnalysisStore';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { SafeECharts } from '@/components/ui/SafeECharts';
import { SQLEditorView } from '@/components/editor/SQLEditorView';
import { ChartConfigPanel } from './ChartConfigPanel';
import {
    DEFAULT_CHART_CONFIG,
    buildEChartsOption,
    toWidgetConfig,
    type ChartConfig,
    type QueryData,
} from './chart-utils';

interface ChartCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ModalView = 'chart-config' | 'data-config';

/** Modal for creating chart widgets with two views: chart configuration and data (SQL) configuration. */
export function ChartCreateModal({ isOpen, onClose }: ChartCreateModalProps) {
    const { addComponent } = useAnalysisStore();
    const { connections } = useConnectionStore();

    const [activeView, setActiveView] = useState<ModalView>('chart-config');
    const [title, setTitle] = useState('');
    const [chartConfig, setChartConfig] = useState<ChartConfig>(DEFAULT_CHART_CONFIG);
    const [queryData, setQueryData] = useState<QueryData | null>(null);
    const [sqlQuery, setSqlQuery] = useState('');

    // Single-connection architecture: credentials derive one connection
    const connection = connections[0];
    const editorContext = connection
        ? { connectionId: connection.id, databaseName: connection.database }
        : null;

    const handleConfigChange = useCallback((updates: Partial<ChartConfig>) => {
        setChartConfig(prev => ({
            ...prev,
            ...updates,
            options: updates.options ? { ...prev.options, ...updates.options } : prev.options,
        }));
    }, []);

    const handleQueryResults = useCallback((
        columns: string[],
        rows: Record<string, any>[],
        ctx: { database?: string; schema?: string },
    ) => {
        setQueryData({
            columns,
            rows,
            query: sqlQuery,
            database: ctx.database,
            schema: ctx.schema,
        });
        // Invalidate axis selections that reference columns no longer present
        setChartConfig(prev => {
            const colSet = new Set(columns);
            return {
                ...prev,
                xAxisColumn: colSet.has(prev.xAxisColumn) ? prev.xAxisColumn : '',
                yAxisColumns: prev.yAxisColumns.filter(c => colSet.has(c)),
            };
        });
    }, [sqlQuery]);

    const handleSave = () => {
        if (!queryData || !title.trim()) return;

        const { config, data } = toWidgetConfig(chartConfig, queryData);
        addComponent('chart', {
            title: title.trim(),
            config,
            data,
            query: queryData.query,
            queryContext: {
                database: queryData.database,
                schema: queryData.schema,
            },
        });
        handleClose();
    };

    const handleClose = () => {
        setActiveView('chart-config');
        setTitle('');
        setChartConfig(DEFAULT_CHART_CONFIG);
        setQueryData(null);
        setSqlQuery('');
        onClose();
    };

    const canSave = title.trim() !== ''
        && queryData !== null
        && chartConfig.xAxisColumn !== ''
        && chartConfig.yAxisColumns.length > 0;

    const previewOption = buildEChartsOption(chartConfig, queryData);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-[90vw] max-w-[1200px] h-[85vh] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                {activeView === 'chart-config'
                    ? renderChartConfigView()
                    : renderDataConfigView()}
            </div>
        </div>
    );

    function renderChartConfigView() {
        return (
            <>
                {/* Header */}
                <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-muted-foreground" />
                        <h2 className="font-medium text-xl">生成报表</h2>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Two-column content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left column: Title + Chart Preview */}
                    <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden border-r">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="请输入标题"
                            className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <div className="flex-1 border rounded-md bg-background overflow-hidden flex items-center justify-center">
                            {previewOption ? (
                                <SafeECharts
                                    option={previewOption}
                                    className="w-full h-full"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <BarChart3 className="w-12 h-12 opacity-20" />
                                    <p className="text-sm">配置数据源和图表参数以预览图表</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right column: Config Panel */}
                    <div className="w-[414px] shrink-0">
                        <ChartConfigPanel
                            config={chartConfig}
                            columns={queryData?.columns ?? []}
                            onConfigChange={handleConfigChange}
                            onOpenDataConfig={() => setActiveView('data-config')}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="h-16 border-t px-6 flex items-center justify-end gap-3 shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        保存
                    </button>
                </div>
            </>
        );
    }

    function renderDataConfigView() {
        return (
            <>
                {/* Header with back button */}
                <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                    <button
                        onClick={() => setActiveView('chart-config')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-muted transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        返回图表
                    </button>
                    <button onClick={handleClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Embedded SQL Editor.
                    tabId uses a sentinel value -- SQLEditorView calls updateTab() internally
                    for database/schema changes, but this is a no-op since no tab with this ID
                    exists in the tab store. Database/schema state is tracked by the editor's
                    own local state (selectedDatabase, selectedSchema). */}
                <div className="flex-1 overflow-hidden">
                    <SQLEditorView
                        tabId="__chart-create-sql__"
                        context={editorContext}
                        initialSql={sqlQuery}
                        onSqlChange={setSqlQuery}
                        onQueryResults={handleQueryResults}
                    />
                </div>
            </>
        );
    }
}
