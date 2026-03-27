import React, { useMemo } from 'react';
import { useTabStore, type Tab } from '@/stores/useTabStore';
import { SQLEditorView } from '@/components/editor/SQLEditorView';
import { TableDetailView } from '@/components/database/sql/TableDetailView';
import { CollectionDetailView } from '@/components/database/mongodb/CollectionDetailView';
import { RedisDetailView } from '@/components/database/redis/RedisDetailView';
import { Database } from 'lucide-react';

interface TabContentProps {
    refreshTrigger?: number;
}

export function TabContent({ refreshTrigger }: TabContentProps) {
    const { tabs, activeTabId, updateTab } = useTabStore();

    const activeTab = useMemo(() => {
        return tabs.find(t => t.id === activeTabId);
    }, [tabs, activeTabId]);

    // When no tabs are open, show empty state
    if (!activeTab) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                <Database className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">No tabs open</p>
                <p className="text-sm">Select a table or create a new query from the sidebar</p>
            </div>
        );
    }

    // Render content based on tab type
    const renderTabContent = (tab: Tab) => {
        switch (tab.type) {
            case 'query':
                return (
                    <SQLEditorView
                        key={tab.id}
                        tabId={tab.id}
                        context={{
                            connectionId: tab.connectionId,
                            databaseName: tab.databaseName,
                            schemaName: tab.schemaName,
                        }}
                        initialSql={tab.sqlContent}
                        onSqlChange={(sql) => {
                            updateTab(tab.id, { sqlContent: sql, isDirty: true });
                        }}
                    />
                );
            case 'table':
                if (!tab.databaseName || !tab.tableName) {
                    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Invalid table configuration</div>;
                }
                return (
                    <TableDetailView
                        key={tab.id}
                        connectionId={tab.connectionId}
                        databaseName={tab.databaseName}
                        tableName={tab.tableName}
                        schema={tab.schemaName}
                    />
                );
            case 'collection':
                if (!tab.databaseName || !tab.collectionName) {
                    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Invalid collection configuration</div>;
                }
                return (
                    <CollectionDetailView
                        key={tab.id}
                        connectionId={tab.connectionId}
                        databaseName={tab.databaseName}
                        collectionName={tab.collectionName}
                        refreshTrigger={refreshTrigger}
                    />
                );
            case 'redis_keys_list':
                if (!tab.databaseName) {
                    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Invalid database configuration</div>;
                }
                return (
                    <RedisDetailView
                        key={tab.id}
                        connectionId={tab.connectionId}
                        databaseName={tab.databaseName}
                    />
                );
            default:
                return <div className="flex-1 flex items-center justify-center text-muted-foreground">Unknown tab type</div>;
        }
    };

    // Render all tabs but only show the active one
    // This preserves state for inactive tabs
    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            {tabs.map(tab => (
                <div
                    key={tab.id}
                    className={tab.id === activeTabId ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}
                >
                    {renderTabContent(tab)}
                </div>
            ))}
        </div>
    );
}
