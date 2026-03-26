import React, { useState } from 'react';
import { X, FileCode, Table, Database, Trash2, SearchX, SplitSquareHorizontal } from 'lucide-react';
import { useTabStore, type Tab, type TabType } from '@/stores/useTabStore';
import { cn } from '@/lib/utils';
import { ContextMenu } from '@/components/ui/ContextMenu';

function getTabIcon(type: TabType) {
    switch (type) {
        case 'query':
            return <FileCode className="h-3.5 w-3.5" />;
        case 'table':
            return <Table className="h-3.5 w-3.5" />;
        case 'collection':
            return <Database className="h-3.5 w-3.5" />;
        default:
            return <FileCode className="h-3.5 w-3.5" />;
    }
}

interface TabItemProps {
    tab: Tab;
    isActive: boolean;
    onActivate: () => void;
    onClose: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

function TabItem({ tab, isActive, onActivate, onClose, onContextMenu }: TabItemProps) {
    return (
        <div
            onClick={onActivate}
            onContextMenu={onContextMenu}
            className={cn(
                "group flex items-center gap-2 px-4 h-12 cursor-pointer border-r border-border/50 transition-all duration-150 min-w-[120px] max-w-[200px] select-none",
                isActive
                    ? "bg-background text-foreground border-b-2 border-b-primary"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border-b border-border/50"
            )}
        >
            <span className={cn(
                "flex-shrink-0",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}>
                {getTabIcon(tab.type)}
            </span>
            <span className="flex-1 truncate text-xs font-medium">
                {tab.title}
                {tab.isDirty && <span className="text-primary ml-1">•</span>}
            </span>
            <button
                onClick={onClose}
                className={cn(
                    "flex-shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors",
                    "opacity-0 group-hover:opacity-100",
                    isActive && "opacity-100"
                )}
                title="Close tab"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

export function TabBar() {
    const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeAllTabs } = useTabStore();
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

    return (
        <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {tabs.map(tab => (
                <TabItem
                    key={tab.id}
                    tab={tab}
                    isActive={tab.id === activeTabId}
                    onActivate={() => setActiveTab(tab.id)}
                    onClose={(e) => handleClose(e, tab.id)}
                    onContextMenu={(e) => handleContextMenu(e, tab.id)}
                />
            ))}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        {
                            label: 'Close',
                            onClick: () => handleMenuAction('close'),
                            icon: <X className="h-4 w-4" />
                        },
                        {
                            label: 'Close Others',
                            onClick: () => handleMenuAction('closeOthers'),
                            icon: <SplitSquareHorizontal className="h-4 w-4" />
                        },
                        { separator: true } as const,
                        {
                            label: 'Close All',
                            onClick: () => handleMenuAction('closeAll'),
                            icon: <X className="h-4 w-4" />
                        },
                    ]}
                />
            )}
        </div>
    );
}
