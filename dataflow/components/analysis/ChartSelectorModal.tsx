import React, { useState, useMemo, useEffect } from "react";
import { Search, X, Check, BarChart, Calendar, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactECharts from 'echarts-for-react';
import { NativeECharts } from "@/components/ui/NativeECharts";
import { useAnalysisStore } from "@/stores/useAnalysisStore";

interface ChartSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChartSelectorModal({ isOpen, onClose }: ChartSelectorModalProps) {
    const conversations: any[] = [];
    const loadConversationMessages = async (_id: string) => {};
    const { addComponent } = useAnalysisStore();

    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // Load messages when a conversation is selected
    useEffect(() => {
        if (selectedConversationId) {
            const conversation = conversations.find(c => c.id === selectedConversationId);
            // If conversation has no messages or empty messages, load them
            if (conversation && (!conversation.messages || conversation.messages.length === 0)) {
                setIsLoadingMessages(true);
                loadConversationMessages(selectedConversationId).finally(() => {
                    setIsLoadingMessages(false);
                });
            }
        }
    }, [selectedConversationId, conversations, loadConversationMessages]);

    // Filter conversations
    const filteredConversations = useMemo(() => {
        return conversations.filter(c =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [conversations, searchQuery]);

    // Get charts for selected conversation
    const currentCharts = useMemo(() => {
        if (!selectedConversationId) return [];
        const conversation = conversations.find(c => c.id === selectedConversationId);
        if (!conversation || !conversation.messages) return [];

        return conversation.messages
            .filter((m: any) => m.chart)
            .map((m: any) => ({
                id: m.id,
                chart: m.chart
            }));
    }, [conversations, selectedConversationId]);

    const handleToggleChart = (id: string) => {
        const newSelected = new Set(selectedCharts);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedCharts(newSelected);
    };

    const handleSave = () => {
        // Find all selected charts across all conversations
        const chartsToAdd: any[] = [];

        conversations.forEach(c => {
            c.messages.forEach((m: any) => {
                if (m.chart && selectedCharts.has(m.id)) {
                    chartsToAdd.push(m.chart);
                }
            });
        });

        chartsToAdd.forEach(chart => {
            if (!chart) return;

            // Determine component type based on chart.type
            const isTable = chart.type === 'table';
            const componentType = isTable ? 'table' : 'chart';

            if (isTable) {
                // For tables, pass data with columns and rows
                addComponent('table', {
                    title: chart.title,
                    description: chart.description,
                    data: {
                        columns: chart.columns || chart.data?.columns || [],
                        rows: chart.rows || chart.data?.rows || []
                    }
                });
            } else {
                // For charts (bar, line, pie, area, etc.)
                addComponent('chart', {
                    title: chart.title,
                    description: chart.description,
                    config: {
                        type: chart.type,
                        xAxis: chart.xAxis,
                        series: chart.series,
                        direction: chart.direction
                    }
                });
            }
        });

        onClose();
        setSelectedCharts(new Set());
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-[90vw] h-[85vh] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                    <h2 className="font-semibold text-lg">添加图表</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar: Conversations */}
                    <div className="w-64 border-r bg-muted/10 flex flex-col">
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="搜索"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {filteredConversations.map(conv => (
                                <div
                                    key={conv.id}
                                    onClick={() => setSelectedConversationId(conv.id)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors text-sm",
                                        selectedConversationId === conv.id
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-muted text-foreground/80"
                                    )}
                                >
                                    <MessageSquare className="w-4 h-4 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{conv.title}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(conv.timestamp).toLocaleDateString()}
                                        </div>
                                    </div>
                                    {conv.chartCount > 0 && (
                                        <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                                            {conv.chartCount}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Content: Charts */}
                    <div className="flex-1 bg-muted/5 p-6 overflow-y-auto">
                        {selectedConversationId ? (
                            <div className="grid grid-cols-2 gap-6">
                                {currentCharts.map(({ id, chart }: { id: string; chart: any }) => {
                                    if (!chart) return null;
                                    return (
                                        <div
                                            key={id}
                                            onClick={() => handleToggleChart(id)}
                                            className={cn(
                                                "relative bg-card border-2 rounded-xl overflow-hidden cursor-pointer transition-all group hover:shadow-md",
                                                selectedCharts.has(id) ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-primary/50"
                                            )}
                                        >
                                            {/* Selection Checkbox */}
                                            <div className={cn(
                                                "absolute top-3 right-3 z-10 w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                                selectedCharts.has(id) ? "bg-primary border-primary text-primary-foreground" : "bg-background border-muted-foreground/30"
                                            )}>
                                                {selectedCharts.has(id) && <Check className="w-3.5 h-3.5" />}
                                            </div>

                                            {/* Chart Header */}
                                            <div className="h-10 px-4 border-b flex items-center justify-between bg-muted/10">
                                                <span className="font-medium text-sm truncate pr-8">{chart.title}</span>
                                                <div className="flex gap-1">
                                                    <div className="p-1 rounded bg-muted">
                                                        <BarChart className="w-3 h-3 text-muted-foreground" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Chart/Table Preview */}
                                            <div className="h-48 p-4 pointer-events-none overflow-hidden">
                                                {chart.type === 'table' ? (
                                                    // Table preview
                                                    <div className="h-full overflow-auto text-xs">
                                                        <table className="w-full border-collapse">
                                                            <thead className="bg-muted/50 sticky top-0">
                                                                <tr>
                                                                    {(chart.columns || []).slice(0, 5).map((col: string, i: number) => (
                                                                        <th key={i} className="px-2 py-1 text-left font-medium text-muted-foreground border-b truncate max-w-[100px]">
                                                                            {col}
                                                                        </th>
                                                                    ))}
                                                                    {(chart.columns || []).length > 5 && (
                                                                        <th className="px-2 py-1 text-muted-foreground border-b">...</th>
                                                                    )}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(chart.rows || []).slice(0, 4).map((row: any, i: number) => (
                                                                    <tr key={i} className="border-b last:border-0">
                                                                        {(chart.columns || []).slice(0, 5).map((col: string, j: number) => (
                                                                            <td key={j} className="px-2 py-1 truncate max-w-[100px]">
                                                                                {row[col] !== undefined ? String(row[col]) : '-'}
                                                                            </td>
                                                                        ))}
                                                                        {(chart.columns || []).length > 5 && (
                                                                            <td className="px-2 py-1 text-muted-foreground">...</td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                                {(chart.rows || []).length > 4 && (
                                                                    <tr>
                                                                        <td colSpan={Math.min((chart.columns || []).length, 6)} className="px-2 py-1 text-center text-muted-foreground">
                                                                            ... 共 {chart.rows?.length || 0} 行
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : chart.type === 'pie' ? (
                                                    <NativeECharts
                                                        option={{
                                                            tooltip: { trigger: 'item' },
                                                            series: chart.series.map((s: any) => ({
                                                                name: s.name,
                                                                type: 'pie',
                                                                radius: '60%',
                                                                data: Array.isArray(s.data)
                                                                    ? s.data.map((d: any, i: number) => ({
                                                                        value: typeof d === 'object' ? d.value : d,
                                                                        name: typeof d === 'object' && d.name ? d.name : (chart.xAxis?.[i] || `Item ${i + 1}`)
                                                                    }))
                                                                    : [],
                                                                label: {
                                                                    show: true,
                                                                    formatter: '{b}',
                                                                    fontSize: 10
                                                                }
                                                            }))
                                                        }}
                                                        style={{ height: '100%', width: '100%' }}
                                                    />
                                                ) : (
                                                    <NativeECharts
                                                        option={{
                                                            grid: { top: 10, bottom: 20, left: 30, right: 10 },
                                                            xAxis: { type: 'category', data: chart.xAxis || [] },
                                                            yAxis: { type: 'value' },
                                                            series: chart.series.map((s: any) => ({
                                                                ...s,
                                                                type: chart.type || 'bar',
                                                                itemStyle: { color: '#3b82f6' }
                                                            }))
                                                        }}
                                                        style={{ height: '100%', width: '100%' }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {currentCharts.length === 0 && !isLoadingMessages && (
                                    <div className="col-span-2 flex flex-col items-center justify-center h-64 text-muted-foreground">
                                        <BarChart className="w-12 h-12 mb-4 opacity-20" />
                                        <p>该对话中没有可用的图表</p>
                                    </div>
                                )}
                                {isLoadingMessages && (
                                    <div className="col-span-2 flex flex-col items-center justify-center h-64 text-muted-foreground">
                                        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-4"></div>
                                        <p>正在加载图表...</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                                <p>请从左侧选择一个对话以查看图表</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="h-16 border-t px-6 flex items-center justify-between bg-background">
                    <div className="text-sm text-muted-foreground">
                        已选 <span className="text-primary font-medium">{selectedCharts.size}</span> 个图表
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-md border hover:bg-muted transition-colors text-sm"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={selectedCharts.size === 0}
                            className="px-6 py-2 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
