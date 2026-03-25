import React from "react";
import { Database, Terminal, BarChart2, Bot, Settings, Layers, LayoutDashboard, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityTab = 'connections' | 'sql-editor' | 'analysis' | 'settings';

interface ActivityBarProps {
    activeTab: ActivityTab;
    onTabChange: (tab: ActivityTab) => void;
}

export function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
    const tabs: { id: ActivityTab; icon: React.ElementType; label: string }[] = [
        { id: 'connections', icon: Database, label: 'Database Connections' },
        { id: 'analysis', icon: LayoutDashboard, label: 'Data Analysis' },
    ];

    const bottomTabs: { id: ActivityTab; icon: React.ElementType; label: string }[] = [];

    const renderTab = (tab: { id: ActivityTab; icon: React.ElementType; label: string }) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
            <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                    "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                    isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-muted-foreground hover:bg-muted"
                )}
                title={tab.label}
            >
                <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-105", isActive && "text-blue-600")} />
            </button>
        );
    };

    return (
        <div className="flex h-full w-16 flex-col items-center justify-between border-r bg-background py-4">
            <div className="flex flex-col gap-4">
                {tabs.map(renderTab)}
            </div>
            <div className="flex flex-col gap-4">
                {bottomTabs.map(renderTab)}
            </div>
        </div>
    );
}
