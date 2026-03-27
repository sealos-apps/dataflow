import React, { useState, useRef } from "react";
import { DashboardComponent, useAnalysisStore } from "@/stores/useAnalysisStore";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Trash2, Maximize2, Settings, ImageDown } from "lucide-react";
import { SafeECharts, NativeEChartsHandle } from "@/components/ui/SafeECharts";
import { buildWidgetChartOption } from "./chart-utils";
import { downloadBlob } from "@/lib/export-utils";
import { ContextMenu } from "../ui/ContextMenu";

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
        downloadBlob(blob, `${component.title || 'chart'}.png`);
    };

    const menuItems = [
        {
            label: "放大",
            icon: <Maximize2 className="w-4 h-4" />,
            onClick: () => onMaximize?.(component.id)
        },
        ...(component.type === 'chart' ? [{
            label: "导出 PNG",
            icon: <ImageDown className="w-4 h-4" />,
            onClick: handleExportPNG
        }] : []),
        {
            label: "编辑",
            icon: <Settings className="w-4 h-4" />,
            onClick: () => onEdit?.(component.id)
        },
        {
            label: "删除",
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            onClick: () => onDelete?.(component.id)
        }
    ];

    return (
        <div
            className={cn(
                "bg-white border border-slate-100 rounded-lg shadow-sm overflow-hidden flex flex-col transition-all group relative h-full",
                isSelected ? "ring-2 ring-primary border-primary shadow-md" : "hover:border-slate-200 hover:shadow-md",
                isReadOnly && "pointer-events-auto"
            )}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(component.id);
            }}
            onContextMenu={!isReadOnly ? handleContextMenu : undefined}
        >
            {/* Widget Header */}
            <div className={cn(
                "h-9 px-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 relative z-10",
                !isReadOnly && "cursor-move drag-handle"
            )}>
                <span className="font-semibold text-xs text-slate-700 truncate">{component.title}</span>

                {/* Actions Menu Button */}
                {!isReadOnly && (
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={handleContextMenu}
                        className={cn(
                            "p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors",
                            contextMenu && "bg-slate-100 text-slate-600"
                        )}
                    >
                        <MoreHorizontal className="w-4 h-4 rotate-90" />
                    </button>
                )}
            </div>

            {/* Widget Content */}
            <div className="flex-1 p-0 overflow-hidden relative">
                <div className="absolute inset-0 p-3 z-10">
                    <WidgetContent component={component} chartRef={chartRef} />
                </div>
                {!isReadOnly && <div className="absolute inset-0 z-0" />}
            </div>

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
    switch (component.type) {
        case 'chart': {
            const option = buildWidgetChartOption(component.config);
            if (!option) return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">No chart data</div>;
            return (
                <SafeECharts
                    ref={chartRef}
                    option={option}
                    className="h-full w-full overflow-hidden"
                />
            );
        }

        case 'table':
            if (!component.data?.rows) return <div>No data</div>;
            return (
                <div className="overflow-auto absolute inset-0 bg-white scrollbar-thin"> {/* Full fill with absolute inset */}
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs text-slate-500 font-semibold bg-slate-50 sticky top-0 z-10">
                            <tr>
                                {component.data.columns.map((col: string, i: number) => (
                                    <th key={i} className="px-3 py-2 border-b border-slate-200">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {component.data.rows.map((row: any, i: number) => (
                                <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/50 transition-colors">
                                    {component.data.columns.map((col: string, j: number) => (
                                        <td key={j} className="px-3 py-1.5 whitespace-nowrap text-slate-700">
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
                        {component.data?.trend || '0%'} vs last month
                    </div>
                </div>
            );

        default:
            return (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    {component.type} widget
                </div>
            );
    }
}
