import { useState, useCallback, useRef, useEffect } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";

import { ActivityBar, ActivityTab } from "./ActivityBar";
import { AnalysisView } from "../analysis/AnalysisView";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 256;

export function MainLayout() {
    const [activeTab, setActiveTab] = useState<ActivityTab>('connections');
    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
    const isResizing = useRef(false);

    const showSidebar = activeTab === 'connections';

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            // Account for ActivityBar width (80px = w-20)
            const newWidth = e.clientX - 80;
            setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, newWidth)));
        };

        const handleMouseUp = () => {
            if (!isResizing.current) return;
            isResizing.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} />

            {showSidebar && (
                <div className="relative shrink-0" style={{ width: sidebarWidth }}>
                    <Sidebar />
                    <div
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10"
                        onMouseDown={handleMouseDown}
                    />
                </div>
            )}

            <main className="flex flex-1 flex-col overflow-hidden relative">
                {activeTab === 'connections' ? (
                    <>
                        <TabBar />
                        <TabContent />
                    </>
                ) : activeTab === 'analysis' ? (
                    <AnalysisView />
                ) : null}

            </main>
        </div>
    );
}
