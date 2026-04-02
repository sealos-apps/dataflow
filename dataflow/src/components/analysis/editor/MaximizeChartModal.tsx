import { useAnalysisStore } from '@/stores/useAnalysisStore'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SafeECharts } from '@/components/ui/SafeECharts'
import { buildWidgetChartOption } from '../chart-utils'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/useI18n'

interface MaximizeChartModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  componentId: string | null
}

/** Full-screen modal for viewing a dashboard component at maximum size. */
export function MaximizeChartModal({ open, onOpenChange, componentId }: MaximizeChartModalProps) {
  const { activeDashboardId, dashboards } = useAnalysisStore()
  const dashboard = dashboards.find(d => d.id === activeDashboardId)
  const component = dashboard?.components.find(c => c.id === componentId)

  return (
    <Dialog open={open && !!component} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 flex flex-col overflow-hidden gap-0">
        {component && (
          <>
            <DialogHeader className="h-16 border-b px-6 flex flex-row items-center shrink-0 gap-0">
              <div className="flex-1">
                <DialogTitle className="text-lg">{component.title}</DialogTitle>
                {component.description && (
                  <DialogDescription>{component.description}</DialogDescription>
                )}
              </div>
            </DialogHeader>
            <div className="flex-1 p-6 min-h-0 overflow-auto">
              <MaximizedContent component={component} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MaximizedContent({ component }: { component: { type: string; title: string; config?: any; data?: any } }) {
  const { t } = useI18n()
  switch (component.type) {
    case 'chart': {
      const chartOption = buildWidgetChartOption(component.config)
      if (!chartOption) return null
      return <SafeECharts option={chartOption} className="h-full w-full" />
    }
    case 'table':
      if (!component.data?.rows) return null
      return (
        <div className="overflow-auto h-full w-full">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
              <tr>
                {component.data.columns.map((col: string, i: number) => (
                  <th key={i} className="px-4 py-2 font-medium">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {component.data.rows.map((row: any, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  {component.data.columns.map((col: string, j: number) => (
                    <td key={j} className="px-4 py-2 whitespace-nowrap">{row[col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'text':
      return (
        <div
          className="prose prose-lg max-w-none h-full w-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: component.data?.content || '' }}
        />
      )
    case 'stats':
      return (
        <div className="flex flex-col justify-center items-center h-full px-4">
          <div className="text-6xl font-bold">{component.data?.value || '0'}</div>
          <div className={cn(
            "text-xl font-medium mt-4",
            component.data?.trend?.startsWith('+') ? "text-success" : "text-destructive"
          )}>
            {t('analysis.widget.statsComparison', { trend: component.data?.trend || '0%' })}
          </div>
        </div>
      )
    default:
      return null
  }
}
