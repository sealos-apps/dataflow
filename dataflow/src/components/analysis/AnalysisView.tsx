import { useEffect } from "react";
import { DashboardEditor } from "./editor";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { useI18n } from '@/i18n/useI18n'
import { LayoutDashboard } from 'lucide-react';

export function AnalysisView() {
    const { activeDashboardId, isInitialized, initializeFromAPI } = useAnalysisStore();
    const { t } = useI18n()

    useEffect(() => {
        if (!isInitialized) {
            initializeFromAPI();
        }
    }, [isInitialized, initializeFromAPI]);

    return (
        <div className="flex h-full w-full overflow-hidden">
            {activeDashboardId ? (
                <DashboardEditor />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                    <LayoutDashboard className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">{t('analysis.dashboard.emptyTitle')}</p>
                    <p className="text-sm">{t('analysis.dashboard.emptyDescription')}</p>
                </div>
            )}
        </div>
    );
}
