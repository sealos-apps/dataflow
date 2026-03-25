import React from "react";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { X } from "lucide-react";

interface ComponentSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ComponentSettingsModal({ isOpen, onClose }: ComponentSettingsModalProps) {
    const {
        activeDashboardId,
        selectedComponentId,
        dashboards,
        updateComponent
    } = useAnalysisStore();

    const dashboard = dashboards.find(d => d.id === activeDashboardId);
    const selectedComponent = dashboard?.components.find(c => c.id === selectedComponentId);

    if (!isOpen || !selectedComponent) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-[400px] bg-card border rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
                <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                    <h2 className="font-semibold text-lg">组件编辑</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">标题</label>
                        <input
                            type="text"
                            value={selectedComponent.title}
                            onChange={(e) => updateComponent(selectedComponent.id, { title: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">描述</label>
                        <textarea
                            value={selectedComponent.description || ''}
                            onChange={(e) => updateComponent(selectedComponent.id, { description: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none h-20"
                            placeholder="添加描述..."
                        />
                    </div>

                    {/* Dynamic properties based on type */}
                    {selectedComponent.type === 'stats' && (
                        <>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">数值</label>
                                <input
                                    type="text"
                                    value={selectedComponent.data?.value || ''}
                                    onChange={(e) => updateComponent(selectedComponent.id, {
                                        data: { ...selectedComponent.data, value: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">趋势</label>
                                <input
                                    type="text"
                                    value={selectedComponent.data?.trend || ''}
                                    onChange={(e) => updateComponent(selectedComponent.id, {
                                        data: { ...selectedComponent.data, trend: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                                    placeholder="+10%"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="h-16 border-t px-6 flex items-center justify-end bg-muted/5 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                        完成
                    </button>
                </div>
            </div>
        </div>
    );
}
