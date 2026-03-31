import { useEffect } from "react";
import { DashboardSidebar } from "./sidebar";
import { DashboardEditor } from "./editor";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { useI18n } from '@/i18n/useI18n'

export function AnalysisView() {
    const { activeDashboardId, isInitialized, initializeFromAPI } = useAnalysisStore();
    const { t } = useI18n()

    // Initialize dashboards from API on mount
    useEffect(() => {
        if (!isInitialized) {
            initializeFromAPI();
        }
    }, [isInitialized, initializeFromAPI]);

    return (
        <div className="flex h-full w-full overflow-hidden">
            <DashboardSidebar />
            <div className="flex-1 overflow-hidden bg-muted/10">
                {activeDashboardId ? (
                    <DashboardEditor />
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        {t('analysis.dashboard.selectToView')}
                    </div>
                )}
            </div>
        </div>
    );
}
