import React, { useState } from 'react';
import { X, FileCode, Table, Database, Plus, SplitSquareHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTabStore, type Tab, type TabType } from '@/stores/useTabStore';
import { cn } from '@/lib/utils';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from '@/i18n/useI18n';

function getTabIcon(type: TabType) {
    switch (type) {
        case 'query':
            return <FileCode className="h-4 w-4" />;
        case 'table':
            return <Table className="h-4 w-4" />;
        case 'collection':
            return <Database className="h-4 w-4" />;
        default:
            return <FileCode className="h-4 w-4" />;
    }
}

interface TabItemProps {
    tab: Tab;
    isActive: boolean;
    onActivate: () => void;
    onClose: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    closeTitle: string;
}

function TabItem({ tab, isActive, onActivate, onClose, onContextMenu, closeTitle }: TabItemProps) {
    return (
        <div
            onClick={onActivate}
            onContextMenu={onContextMenu}
            className={cn(
                "group flex items-center gap-2 p-2 h-9 cursor-pointer border-r border-sidebar-border transition-colors duration-150 select-none",
                isActive
                    ? "bg-input text-foreground"
                    : "text-foreground hover:bg-input"
            )}
        >
            <span className="flex-shrink-0">
                {getTabIcon(tab.type)}
            </span>
            <span className="truncate text-sm font-normal whitespace-nowrap">
                {tab.title}
                {tab.isDirty && <span className="text-primary ml-1">•</span>}
            </span>
            <Button
                variant="ghost"
                size="icon-xs"
                onClick={onClose}
                className={cn(
                    "flex-shrink-0 hover:bg-destructive/10 hover:text-destructive transition-colors",
                    "opacity-0 group-hover:opacity-100",
                    isActive && "opacity-100"
                )}
                title={closeTitle}
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function TabBar() {
    const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeAllTabs, openTab } = useTabStore();
    const { t } = useI18n();
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

    if (tabs.length === 0) {
        return null;
    }

    const handleClose = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        closeTab(tabId);
    };

    const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, tabId });
    };

    const handleMenuAction = (action: 'close' | 'closeOthers' | 'closeAll') => {
        if (!contextMenu) return;

        switch (action) {
            case 'close':
                closeTab(contextMenu.tabId);
                break;
            case 'closeOthers':
                closeOtherTabs(contextMenu.tabId);
                break;
            case 'closeAll':
                closeAllTabs();
                break;
        }
        setContextMenu(null);
    };

    const handleAddTab = () => {
        const activeTab = tabs.find(tab => tab.id === activeTabId);
        if (!activeTab) return;
        openTab({
            type: 'query',
            title: activeTab.databaseName
                ? t('sidebar.tab.queryWithDatabase', { database: activeTab.databaseName })
                : t('layout.tab.newQuery'),
            connectionId: activeTab.connectionId,
            databaseName: activeTab.databaseName,
            schemaName: activeTab.schemaName,
        });
    };

    return (
        <ScrollArea className="">
            <div className="flex items-center pr-2">
                {tabs.map(tab => (
                    <TabItem
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === activeTabId}
                        onActivate={() => setActiveTab(tab.id)}
                        onClose={(e) => handleClose(e, tab.id)}
                        onContextMenu={(e) => handleContextMenu(e, tab.id)}
                        closeTitle={t('layout.tab.close')}
                    />
                ))}
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleAddTab}
                    className="h-9 w-9 shrink-0 rounded-none border-l border-r border-sidebar-border hover:bg-muted"
                    title={t('layout.tab.newQuery')}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        {
                            label: t('layout.tab.close'),
                            onClick: () => handleMenuAction('close'),
                            icon: <X className="h-4 w-4" />
                        },
                        {
                            label: t('layout.tab.closeOthers'),
                            onClick: () => handleMenuAction('closeOthers'),
                            icon: <SplitSquareHorizontal className="h-4 w-4" />
                        },
                        { separator: true } as const,
                        {
                            label: t('layout.tab.closeAll'),
                            onClick: () => handleMenuAction('closeAll'),
                            icon: <X className="h-4 w-4" />
                        },
                    ]}
                />
            )}
        </ScrollArea>
    );
}
