import { useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";

import { ActivityBar, ActivityTab } from "./ActivityBar";
import { AnalysisView } from "../analysis/AnalysisView";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";

export function MainLayout() {
    const [activeTab, setActiveTab] = useState<ActivityTab>('connections');
    const [collectionRefreshTrigger, setCollectionRefreshTrigger] = useState(0);

    // Determine if the Sidebar (Database Tree) should be visible
    // Currently only for 'connections', but could be others if needed
    const showSidebar = activeTab === 'connections';

    const handleRefreshCollection = () => {
        console.log('[MainLayout] 🔄 Refresh triggered! Current counter:', collectionRefreshTrigger);
        setCollectionRefreshTrigger(prev => {
            const newValue = prev + 1;
            console.log('[MainLayout] ✅ Counter updated:', prev, '->', newValue);
            return newValue;
        });
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} />

            {showSidebar && (
                <Sidebar
                    onRefreshCollection={handleRefreshCollection}
                />
            )}

            <main className="flex flex-1 flex-col overflow-hidden relative">
                {activeTab === 'connections' ? (
                    <>
                        <TabBar />
                        <TabContent refreshTrigger={collectionRefreshTrigger} />
                    </>
                ) : activeTab === 'analysis' ? (
                    <AnalysisView />
                ) : null}

            </main>
        </div>
    );
}

