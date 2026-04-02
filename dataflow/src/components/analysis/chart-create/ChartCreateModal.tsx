import { BarChart3, ChevronLeft, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { SafeECharts } from '@/components/ui/SafeECharts'
import { SQLEditorView } from '@/components/editor/SQLEditorView'
import { ChartConfigPanel } from './ChartConfigPanel'
import { ChartCreateProvider, useChartCreateCtx } from './ChartCreateProvider'
import { useAnalysisStore, type DashboardComponent } from '@/stores/useAnalysisStore'
import { useI18n } from '@/i18n/useI18n'

interface ChartCreateModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editComponentId?: string | null
}

/** Modal for creating or editing chart widgets with two views: chart configuration and SQL data. */
export function ChartCreateModal({ open, onOpenChange, editComponentId }: ChartCreateModalProps) {
    const { t } = useI18n()
    const { dashboards, activeDashboardId } = useAnalysisStore()

    const dashboard = dashboards.find(d => d.id === activeDashboardId)
    const editComponent: DashboardComponent | null = editComponentId
        ? dashboard?.components.find(c => c.id === editComponentId) ?? null
        : null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[1200px] w-[90vw] h-[85vh] p-0 flex flex-col overflow-hidden gap-0"
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">
                    {editComponent ? t('analysis.chart.edit') : t('analysis.chart.create')}
                </DialogTitle>
                <ChartCreateProvider
                    key={editComponentId ?? 'create'}
                    editComponent={editComponent}
                    onClose={() => onOpenChange(false)}
                >
                    <ChartCreateContent />
                </ChartCreateProvider>
            </DialogContent>
        </Dialog>
    )
}

/** Routes to the active wizard view. */
function ChartCreateContent() {
    const { activeView } = useChartCreateCtx()
    return activeView === 'chart-config' ? <ChartConfigView /> : <DataConfigView />
}

function ChartConfigView() {
    const { t } = useI18n()
    const { title, setTitle, previewOption, canSave, handleSave, isEditing } = useChartCreateCtx()

    return (
        <>
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                    <h2 className="font-medium text-xl">
                        {isEditing ? t('analysis.chart.edit') : t('analysis.chart.create')}
                    </h2>
                </div>
                <DialogClose className="p-2 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                </DialogClose>
            </div>

            {/* Two-column content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left column: Title + Chart Preview */}
                <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden border-r">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('analysis.chart.titlePlaceholder')}
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex-1 border rounded-md bg-background overflow-hidden flex items-center justify-center">
                        {previewOption ? (
                            <SafeECharts
                                option={previewOption}
                                className="w-full h-full"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                <BarChart3 className="w-12 h-12 opacity-20" />
                                <p className="text-sm">{t('analysis.chart.previewHint')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: Config Panel */}
                <div className="w-[414px] shrink-0">
                    <ChartConfigPanel />
                </div>
            </div>

            {/* Footer */}
            <div className="h-16 border-t px-6 flex items-center justify-end gap-3 shrink-0">
                <DialogClose asChild>
                    <Button variant="outline">{t('common.actions.cancel')}</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={!canSave}>
                    {t('analysis.chart.save')}
                </Button>
            </div>
        </>
    )
}

function DataConfigView() {
    const { t } = useI18n()
    const { setActiveView, sqlQuery, setSqlQuery, handleQueryResults, editorContext } = useChartCreateCtx()

    return (
        <>
            {/* Header with back button */}
            <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                <Button
                    variant="outline"
                    onClick={() => setActiveView('chart-config')}
                >
                    <ChevronLeft className="w-4 h-4" />
                    {t('analysis.chart.backToChart')}
                </Button>
                <DialogClose className="p-2 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                </DialogClose>
            </div>

            {/* Embedded SQL Editor.
                tabId uses a sentinel value -- SQLEditorView calls updateTab() internally
                for database/schema changes, but this is a no-op since no tab with this ID
                exists in the tab store. Database/schema state is tracked by the editor's
                own local state (selectedDatabase, selectedSchema). */}
            <div className="flex-1 overflow-hidden">
                <SQLEditorView
                    tabId="__chart-create-sql__"
                    context={editorContext}
                    initialSql={sqlQuery}
                    onSqlChange={setSqlQuery}
                    onQueryResults={handleQueryResults}
                />
            </div>
        </>
    )
}
