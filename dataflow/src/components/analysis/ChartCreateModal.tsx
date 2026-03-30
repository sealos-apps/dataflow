import { BarChart3, ChevronLeft, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { SafeECharts } from '@/components/ui/SafeECharts'
import { SQLEditorView } from '@/components/editor/SQLEditorView'
import { ChartConfigPanel } from './ChartConfigPanel'
import { ChartCreateProvider, useChartCreateCtx } from './ChartCreateProvider'

interface ChartCreateModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/** Modal for creating chart widgets with two views: chart configuration and SQL data. */
export function ChartCreateModal({ open, onOpenChange }: ChartCreateModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[1200px] w-[90vw] h-[85vh] p-0 flex flex-col overflow-hidden gap-0"
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">Create Chart</DialogTitle>
                <ChartCreateProvider onClose={() => onOpenChange(false)}>
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
    const { title, setTitle, previewOption, canSave, handleSave } = useChartCreateCtx()

    return (
        <>
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                    <h2 className="font-medium text-xl">Create Chart</h2>
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
                        placeholder="Enter title"
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
                                <p className="text-sm">Configure data source and chart parameters to preview</p>
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
                <DialogClose className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors">
                    Cancel
                </DialogClose>
                <button
                    onClick={handleSave}
                    disabled={!canSave}
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </div>
        </>
    )
}

function DataConfigView() {
    const { setActiveView, sqlQuery, setSqlQuery, handleQueryResults, editorContext } = useChartCreateCtx()

    return (
        <>
            {/* Header with back button */}
            <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                <button
                    onClick={() => setActiveView('chart-config')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-muted transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Chart
                </button>
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
