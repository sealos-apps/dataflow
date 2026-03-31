import React from "react";
import { Database, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/useI18n";

export type ActivityTab = 'connections' | 'analysis';

interface ActivityBarProps {
    activeTab: ActivityTab;
    onTabChange: (tab: ActivityTab) => void;
}

export function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
    const { t } = useI18n();
    const tabs: { id: ActivityTab; icon: React.ElementType; label: string }[] = [
        { id: 'connections', icon: Database, label: t('layout.activity.connections') },
        { id: 'analysis', icon: LayoutDashboard, label: t('layout.activity.analysis') },
    ];

    const renderTab = (tab: { id: ActivityTab; icon: React.ElementType; label: string }) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
            <Button
                key={tab.id}
                variant="ghost"
                size="icon"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                    "group relative h-10 w-10 rounded-xl transition-all duration-200",
                    isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted"
                )}
                title={tab.label}
            >
                <Icon className="h-5 w-5 transition-transform group-hover:scale-105" />
            </Button>
        );
    };

    return (
        <div className="flex h-full w-16 flex-col items-center justify-between border-r bg-background py-4">
            <div className="flex flex-col gap-4">
                {tabs.map(renderTab)}
            </div>
        </div>
    );
}
