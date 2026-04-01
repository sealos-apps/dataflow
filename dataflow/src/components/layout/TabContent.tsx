import { useMemo } from 'react';
import { useTabStore, type Tab } from '@/stores/useTabStore';
import { SQLEditorView } from '@/components/editor/SQLEditorView';
import { TableDetailView } from '@/components/database/sql/TableDetailView';
import { CollectionDetailView } from '@/components/database/mongodb/CollectionDetailView';
import { RedisDetailView } from '@/components/database/redis/RedisDetailView';
import { Database } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';

export function TabContent() {
    const { tabs, activeTabId, updateTab } = useTabStore();
    const { t } = useI18n();

    const activeTab = useMemo(() => {
        return tabs.find(t => t.id === activeTabId);
    }, [tabs, activeTabId]);

    // When no tabs are open, show empty state
    if (!activeTab) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                <Database className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">{t('layout.empty.noTabsTitle')}</p>
                <p className="text-sm">{t('layout.empty.noTabsDescription')}</p>
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
                    return <div className="flex-1 flex items-center justify-center text-muted-foreground">{t('layout.invalid.tableConfig')}</div>;
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
                    return <div className="flex-1 flex items-center justify-center text-muted-foreground">{t('layout.invalid.collectionConfig')}</div>;
                }
                return (
                    <CollectionDetailView
                        key={tab.id}
                        connectionId={tab.connectionId}
                        databaseName={tab.databaseName}
                        collectionName={tab.collectionName}
                    />
                );
            case 'redis_keys_list':
                if (!tab.databaseName) {
                    return <div className="flex-1 flex items-center justify-center text-muted-foreground">{t('layout.invalid.databaseConfig')}</div>;
                }
                return (
                    <RedisDetailView
                        key={tab.id}
                        connectionId={tab.connectionId}
                        databaseName={tab.databaseName}
                    />
                );
            default:
                return <div className="flex-1 flex items-center justify-center text-muted-foreground">{t('layout.invalid.unknownTabType')}</div>;
        }
    };

    // Render all tabs but only show the active one
    // This preserves state for inactive tabs
    return (
        <div className="flex-1 flex flex-col overflow-hidden relative p-2 pt-0">
            {tabs.map(tab => (
                <div
                    key={tab.id}
                    className={tab.id === activeTabId ? 'flex-1 flex flex-col overflow-hidden rounded-lg border border-border/50' : 'hidden'}
                >
                    {renderTabContent(tab)}
                </div>
            ))}
        </div>
    );
}
