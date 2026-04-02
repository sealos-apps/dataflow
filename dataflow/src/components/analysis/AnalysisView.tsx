import { useEffect } from "react";
import { DashboardEditor } from "./editor";
import { useAnalysisDefinitionStore } from "@/stores/analysisDefinitionStore";
import { useI18n } from '@/i18n/useI18n'
import { LayoutDashboard } from 'lucide-react';

export function AnalysisView() {
    const activeDashboardId = useAnalysisDefinitionStore(state => state.activeDashboardId);
    const isInitialized = useAnalysisDefinitionStore(state => state.isInitialized);
    const loadError = useAnalysisDefinitionStore(state => state.loadError);
    const initializeFromAPI = useAnalysisDefinitionStore(state => state.initializeFromAPI);
    const { t } = useI18n()

    useEffect(() => {
        if (!isInitialized) {
            void initializeFromAPI();
        }
    }, [isInitialized, initializeFromAPI]);

    if (loadError) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-muted/10 p-8 text-center">
                <div>
                    <p className="text-lg font-medium text-foreground">{t('analysis.dashboard.emptyTitle')}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
                </div>
            </div>
        );
    }

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
