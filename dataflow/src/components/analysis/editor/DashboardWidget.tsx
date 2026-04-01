import React, { useState, useRef } from "react";
import { DashboardComponent } from "@/stores/useAnalysisStore";
import { cn } from "@/lib/utils";
import { GripHorizontal, MoreVertical, Trash2, Maximize2, Settings, ImageDown } from "lucide-react";
import { SafeECharts, NativeEChartsHandle } from "@/components/ui/SafeECharts";
import { buildWidgetChartOption } from "../chart-utils";
import { downloadBlob } from "@/utils/export-utils";
import { ContextMenu } from "../../ui/ContextMenu";
import { useI18n } from '@/i18n/useI18n'

interface DashboardWidgetProps {
    component: DashboardComponent;
    isReadOnly: boolean;
    isSelected: boolean;
    onEdit?: (id: string) => void;
    onMaximize?: (id: string) => void;
    onDelete?: (id: string) => void;
    onSelect: (id: string) => void;
}

export function DashboardWidget({
    component,
    isReadOnly,
    isSelected,
    onEdit,
    onMaximize,
    onDelete,
    onSelect
}: DashboardWidgetProps) {
    const { t } = useI18n()
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const chartRef = useRef<NativeEChartsHandle>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleExportPNG = async () => {
        setContextMenu(null);
        const blob = await chartRef.current?.exportPNG(2);
        if (!blob) return;
        downloadBlob(blob, `${component.title || t('analysis.defaultTitle.chart')}.png`);
    };

    const menuItems = [
        {
            label: t('analysis.widget.maximize'),
            icon: <Maximize2 className="w-4 h-4" />,
            onClick: () => onMaximize?.(component.id)
        },
        ...(component.type === 'chart' ? [{
            label: t('analysis.chart.exportPng'),
            icon: <ImageDown className="w-4 h-4" />,
            onClick: handleExportPNG
        }] : []),
        {
            label: t('analysis.widget.settings'),
            icon: <Settings className="w-4 h-4" />,
            onClick: () => onEdit?.(component.id)
        },
        {
            label: t('analysis.widget.delete'),
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            onClick: () => onDelete?.(component.id)
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
                onSelect(component.id);
            }}
            onContextMenu={!isReadOnly ? handleContextMenu : undefined}
        >
            {/* Widget Header */}
            <div className="h-9 flex items-center justify-between px-0.5 shrink-0 relative z-10">
                <div className="flex items-center h-8 px-2.5 rounded-lg truncate">
                    <span className="text-xs text-foreground truncate">{component.title}</span>
                </div>

                {!isReadOnly && (
                    <GripHorizontal className="w-4 h-4 text-foreground/40 cursor-grab drag-handle absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2" />
                )}

                {!isReadOnly && (
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={handleContextMenu}
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
                    <WidgetContent component={component} chartRef={chartRef} />
                </div>
            </div>

            {/* Maximize Button - Bottom Right */}
            {!isReadOnly && (
                <div className="flex items-center justify-end p-2 shrink-0">
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => onMaximize?.(component.id)}
                        className="text-foreground/40 hover:text-foreground transition-colors"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Portal Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={menuItems}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}

function WidgetContent({ component, chartRef }: { component: DashboardComponent; chartRef: React.RefObject<NativeEChartsHandle | null> }) {
    const { t } = useI18n()
    switch (component.type) {
        case 'chart': {
            const option = buildWidgetChartOption(component.config);
            if (!option) return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">{t('analysis.chart.noData')}</div>;
            return (
                <SafeECharts
                    ref={chartRef}
                    option={option}
                    className="h-full w-full overflow-hidden"
                />
            );
        }

        case 'table':
            if (!component.data?.rows) return <div>{t('analysis.widget.noData')}</div>;
            return (
                <div className="overflow-auto absolute inset-0 bg-background scrollbar-thin">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs text-muted-foreground font-semibold bg-muted/50 sticky top-0 z-10">
                            <tr>
                                {component.data.columns.map((col: string, i: number) => (
                                    <th key={i} className="px-3 py-2 border-b border-border">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {component.data.rows.map((row: any, i: number) => (
                                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                    {component.data.columns.map((col: string, j: number) => (
                                        <td key={j} className="px-3 py-1.5 whitespace-nowrap text-foreground">
                                            {row[col]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );

        case 'text':
            return (
                <div
                    className="prose prose-sm max-w-none h-full w-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: component.data?.content || '' }}
                />
            );

        case 'stats':
            return (
                <div className="flex flex-col justify-center h-full px-4">
                    <div className="text-2xl font-bold">{component.data?.value || '0'}</div>
                    <div className={cn(
                        "text-xs font-medium mt-1",
                        component.data?.trend?.startsWith('+') ? "text-green-600" : "text-red-600"
                    )}>
                        {t('analysis.widget.statsComparison', { trend: component.data?.trend || '0%' })}
                    </div>
                </div>
            );

        default:
            return (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    {t('analysis.widget.unknownType', { type: component.type })}
                </div>
            );
    }
}
