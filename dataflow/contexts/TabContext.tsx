import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type TabType = 'query' | 'table' | 'collection' | 'redis_keys_list';

export interface Tab {
    id: string;
    type: TabType;
    title: string;
    connectionId: string;
    databaseName?: string;
    schemaName?: string;
    // For query tabs
    sqlContent?: string;
    // For table/collection tabs
    tableName?: string;
    collectionName?: string;
    // Track if content has been modified
    isDirty?: boolean;
}

interface TabContextType {
    tabs: Tab[];
    activeTabId: string | null;
    openTab: (tab: Omit<Tab, 'id'> & { id?: string }) => string;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    updateTab: (tabId: string, updates: Partial<Tab>) => void;
    getTab: (tabId: string) => Tab | undefined;
    findExistingTab: (type: TabType, connectionId: string, identifier: string, databaseName?: string) => Tab | undefined;
    closeOtherTabs: (tabId: string) => void;
    closeAllTabs: () => void;
}

const TabContext = createContext<TabContextType | null>(null);

export function useTabContext() {
    const context = useContext(TabContext);
    if (!context) {
        throw new Error('useTabContext must be used within a TabProvider');
    }
    return context;
}

interface TabProviderProps {
    children: ReactNode;
}

export function TabProvider({ children }: TabProviderProps) {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    const generateTabId = useCallback(() => {
        return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }, []);

    const findExistingTab = useCallback((type: TabType, connectionId: string, identifier: string, databaseName?: string) => {
        return tabs.find(tab => {
            if (tab.type !== type || tab.connectionId !== connectionId) return false;
            if (databaseName && tab.databaseName !== databaseName) return false;

            if (type === 'table') {
                return tab.tableName === identifier;
            } else if (type === 'collection') {
                return tab.collectionName === identifier;
            } else if (type === 'redis_keys_list') {
                return tab.databaseName === databaseName;
            }
            // Query tabs are always unique
            return false;
        });
    }, [tabs]);

    const openTab = useCallback((tabData: Omit<Tab, 'id'> & { id?: string }) => {
        const existingTab = tabData.type !== 'query'
            ? findExistingTab(
                tabData.type,
                tabData.connectionId,
                tabData.tableName || tabData.collectionName || '',
                tabData.databaseName
            )
            : undefined;

        if (existingTab) {
            setActiveTabId(existingTab.id);
            return existingTab.id;
        }

        const newTab: Tab = {
            ...tabData,
            id: tabData.id || generateTabId(),
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return newTab.id;
    }, [findExistingTab, generateTabId]);

    const closeTab = useCallback((tabId: string) => {
        setTabs(prev => {
            const index = prev.findIndex(t => t.id === tabId);
            const newTabs = prev.filter(t => t.id !== tabId);

            // If closing the active tab, switch to an adjacent tab
            if (activeTabId === tabId && newTabs.length > 0) {
                const newActiveIndex = Math.min(index, newTabs.length - 1);
                setActiveTabId(newTabs[newActiveIndex].id);
            } else if (newTabs.length === 0) {
                setActiveTabId(null);
            }

            return newTabs;
        });
    }, [activeTabId]);

    const closeOtherTabs = useCallback((tabId: string) => {
        setTabs(prev => {
            const tabToKeep = prev.find(t => t.id === tabId);
            if (!tabToKeep) return prev;

            setActiveTabId(tabId);
            return [tabToKeep];
        });
    }, []);

    const closeAllTabs = useCallback(() => {
        setTabs([]);
        setActiveTabId(null);
    }, []);

    const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(tab =>
            tab.id === tabId ? { ...tab, ...updates } : tab
        ));
    }, []);

    const getTab = useCallback((tabId: string) => {
        return tabs.find(t => t.id === tabId);
    }, [tabs]);

    const value: TabContextType = {
        tabs,
        activeTabId,
        openTab,
        closeTab,
        setActiveTab: setActiveTabId,
        updateTab,
        getTab,
        findExistingTab,
        closeOtherTabs,
        closeAllTabs,
    };

    return (
        <TabContext.Provider value={value}>
            {children}
        </TabContext.Provider>
    );
}
