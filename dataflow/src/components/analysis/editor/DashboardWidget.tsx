import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import type { ChartWidgetDefinition } from "@/stores/analysisDefinitionStore";
import { useAnalysisRuntimeStore } from "@/stores/analysisRuntimeStore";
import { cn } from "@/lib/utils";
import { GripHorizontal, MoreVertical, Trash2, Maximize2, Settings, ImageDown } from "lucide-react";
import { SafeECharts, NativeEChartsHandle } from "@/components/ui/SafeECharts";
import { buildWidgetChartOption } from "../chart-utils";
import { downloadBlob } from "@/utils/export-utils";
import { ContextMenu } from "../../ui/ContextMenu";
import { useI18n } from '@/i18n/useI18n'

interface DashboardWidgetProps {
    widget: ChartWidgetDefinition;
    isReadOnly: boolean;
    isSelected: boolean;
    onEdit?: (id: string) => void;
    onMaximize?: (id: string) => void;
    onDelete?: (id: string) => void;
    onSelect: (id: string) => void;
}

export function DashboardWidget({
    widget,
    isReadOnly,
    isSelected,
    onEdit,
    onMaximize,
    onDelete,
    onSelect
}: DashboardWidgetProps) {
    const { t } = useI18n()
    const runtimeState = useAnalysisRuntimeStore(state => state.widgetStatesById[widget.id]);
    const [contextMenu, setContextMenu] = useState<{
        x: number; y: number;
        side: "top" | "right" | "bottom" | "left";
        align: "start" | "end";
    } | null>(null);
    const chartRef = useRef<NativeEChartsHandle>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, side: "bottom", align: "start" });
    };

    const handleExportPNG = async () => {
        setContextMenu(null);
        const blob = await chartRef.current?.exportPNG(2);
        if (!blob) return;
        downloadBlob(blob, `${widget.title || t('analysis.defaultTitle.chart')}.png`);
    };

    const menuItems = [
        {
            label: t('analysis.widget.maximize'),
            icon: <Maximize2 className="w-4 h-4" />,
            onClick: () => onMaximize?.(widget.id)
        },
        ...(widget.type === 'chart' ? [{
            label: t('analysis.chart.exportPng'),
            icon: <ImageDown className="w-4 h-4" />,
            onClick: handleExportPNG
        }] : []),
        {
            label: t('analysis.widget.settings'),
            icon: <Settings className="w-4 h-4" />,
            onClick: () => onEdit?.(widget.id)
        },
        {
            label: t('analysis.widget.delete'),
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            onClick: () => onDelete?.(widget.id)
        }
    ];

    return (
        <div
            className={cn(
                "bg-accent rounded-lg overflow-clip flex flex-col p-0.5 relative h-full transition-all group",
                isSelected ? "ring-2 ring-primary" : "",
                isReadOnly && "pointer-events-auto"
            )}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(widget.id);
            }}
            onContextMenu={!isReadOnly ? handleContextMenu : undefined}
        >
            {/* Widget Header */}
            <div className="h-9 flex items-center justify-between px-0.5 shrink-0 relative z-10">
                <div className="flex items-center h-8 px-2.5 rounded-lg truncate">
                    <span className="text-xs text-foreground truncate">{widget.title}</span>
                </div>

                {!isReadOnly && (
                    <GripHorizontal className="w-4 h-4 text-foreground/40 cursor-grab drag-handle absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2" />
                )}

                {!isReadOnly && (
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setContextMenu({ x: rect.right, y: rect.top, side: "right", align: "start" });
                        }}
                        className={cn(
                            "flex items-center justify-center size-8 rounded-lg text-foreground/60 hover:bg-input transition-colors",
                            contextMenu && "bg-input"
                        )}
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Widget Content */}
            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 p-3 z-10">
                    <WidgetContent widget={widget} chartRef={chartRef} runtimeState={runtimeState} />
                </div>
            </div>

            {runtimeState?.status === 'error' && (
                <div className="px-3 pb-2 text-[10px] text-destructive truncate">
                    {runtimeState.error}
                </div>
            )}

            {/* Maximize Button - Bottom Right */}
            {!isReadOnly && (
                <div className="flex items-center justify-end p-2 shrink-0 relative z-10">
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => onMaximize?.(widget.id)}
                        className="text-foreground/40 hover:text-foreground transition-colors"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Portal Context Menu — must escape react-grid-layout's CSS transform */}
            {contextMenu && createPortal(
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    side={contextMenu.side}
                    align={contextMenu.align}
                    items={menuItems}
                    onClose={() => setContextMenu(null)}
                />,
                document.body
            )}
        </div>
    );
}

function WidgetContent({
    widget,
    chartRef,
    runtimeState,
}: {
    widget: ChartWidgetDefinition;
    chartRef: React.RefObject<NativeEChartsHandle | null>;
    runtimeState?: { status: 'idle' | 'loading' | 'success' | 'error'; config?: any; isStale: boolean };
}) {
    const { t } = useI18n()
    switch (widget.type) {
        case 'chart': {
            const config = runtimeState?.status === 'success' && !runtimeState.isStale
                ? runtimeState.config
                : widget.snapshot?.config;
            const option = buildWidgetChartOption(config);
            if (!option) return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">{t('analysis.chart.noData')}</div>;
            return (
                <SafeECharts
                    ref={chartRef}
                    option={option}
                    className="h-full w-full overflow-hidden"
                />
            );
        }

        default:
            return (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    {t('analysis.widget.unknownType', { type: widget.type })}
                </div>
            );
    }
}
