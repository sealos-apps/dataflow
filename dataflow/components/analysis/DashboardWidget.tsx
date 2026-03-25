import React, { useState, useRef, useEffect } from "react";
import { DashboardComponent, useAnalysisStore } from "@/stores/useAnalysisStore";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Trash2, Maximize2, Settings } from "lucide-react";
import { SafeECharts } from "@/components/ui/SafeECharts";

interface DashboardWidgetProps {
    component: DashboardComponent;
    isReadOnly: boolean;
    isSelected: boolean;
    onEdit?: (id: string) => void;
    onMaximize?: (id: string) => void;
    onDelete?: (id: string) => void;
    onSelect: (id: string) => void;
}

import { ContextMenu } from "../ui/ContextMenu";

// ... imports

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

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const menuItems = [
        {
            label: "放大",
            icon: <Maximize2 className="w-4 h-4" />,
            onClick: () => onMaximize?.(component.id)
        },
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
                    <WidgetContent component={component} />
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

function WidgetContent({ component }: { component: DashboardComponent }) {
    switch (component.type) {
        case 'chart':
            if (!component.config || !component.config.series) return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">No chart data</div>;

            const isPie = component.config.type === 'pie';

            let option: any;

            if (isPie) {
                // Pie chart needs special handling - data should be {value, name} pairs
                option = {
                    tooltip: {
                        trigger: 'item',
                        formatter: '{b}: {c} ({d}%)'
                    },
                    // No legend - labels on pie slices are sufficient
                    series: component.config.series.map((s: any) => ({
                        name: s.name,
                        type: 'pie',
                        radius: ['40%', '70%'], // Donut style looks more modern
                        itemStyle: {
                            borderRadius: 5,
                            borderColor: '#fff',
                            borderWidth: 2
                        },
                        // Transform data to include names from xAxis
                        data: Array.isArray(s.data)
                            ? s.data.map((d: any, i: number) => {
                                // If data is already {value, name} format, use as-is
                                if (typeof d === 'object' && d.value !== undefined) {
                                    return d;
                                }
                                // Otherwise, create {value, name} from data and xAxis
                                return {
                                    value: d,
                                    name: component.config.xAxis?.[i] || `Item ${i + 1}`
                                };
                            })
                            : [],
                        label: {
                            show: true,
                            formatter: '{b}'
                        },
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    }))
                };
            } else {
                // Non-pie charts (bar, line, area, etc.)
                option = {
                    tooltip: { trigger: 'axis', className: 'text-xs' },
                    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
                    series: component.config.series.map((s: any) => {
                        let seriesType = s.type || component.config.type || 'bar';
                        let extra = {};
                        if (seriesType === 'area') {
                            seriesType = 'line';
                            extra = { areaStyle: { opacity: 0.2 } };
                        }
                        return {
                            ...s,
                            type: seriesType,
                            ...extra,
                            itemStyle: seriesType === 'bar' ? { borderRadius: [4, 4, 0, 0], color: '#3b82f6', ...s.itemStyle } : s.itemStyle,
                            symbol: seriesType === 'line' ? 'circle' : undefined,
                            symbolSize: 6,
                        };
                    })
                };

                const useDualAxis = component.config.series.some((s: any) => s.yAxisIndex === 1);

                option.xAxis = component.config.direction === 'horizontal'
                    ? { type: 'value', splitLine: { show: true, lineStyle: { type: 'dashed' } } }
                    : { type: 'category', data: component.config.xAxis || [], axisLine: { show: false }, axisTick: { show: false } };

                option.yAxis = component.config.direction === 'horizontal'
                    ? { type: 'category', data: component.config.xAxis || [], axisLine: { show: false }, axisTick: { show: false } }
                    : (useDualAxis ? [{ type: 'value', splitLine: { lineStyle: { type: 'dashed' } } }, { type: 'value' }] : { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } });

                if (component.config.direction === 'horizontal') {
                    option.series = option.series.map((s: any) => ({
                        ...s,
                        itemStyle: { borderRadius: [0, 4, 4, 0], color: '#3b82f6', ...s.itemStyle },
                        label: { show: true, position: 'right' }
                    }));
                }
            }

            return (
                <SafeECharts
                    option={option}
                    className="h-full w-full overflow-hidden"
                />
            );

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
