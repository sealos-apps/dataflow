import { useState } from 'react'
import { Download, Plus, RefreshCw, TerminalSquare, BarChart3 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useCollectionView } from './CollectionViewProvider'
import { DataView } from '@/components/database/shared/DataView'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/useI18n'
import { useTabStore } from '@/stores/useTabStore'
import { buildMongoCollectionCommand } from '@/utils/mongodb-shell'
import { ChartCreateModal } from '@/components/analysis/chart-create'

interface CollectionViewToolbarProps {
  connectionId: string
  databaseName: string
  collectionName: string
}

export function CollectionViewToolbar({ connectionId, databaseName, collectionName }: CollectionViewToolbarProps) {
  const { t } = useI18n()
  const { state, actions } = useCollectionView()
  const openTab = useTabStore((s) => s.openTab)
  const [isChartModalOpen, setIsChartModalOpen] = useState(false)

  const handleOpenQuery = () => {
    openTab({
      type: 'query',
      title: t('sidebar.tab.queryWithDatabase', { database: databaseName }),
      connectionId,
      databaseName,
      sqlContent: `${buildMongoCollectionCommand(collectionName, 'find', '{}')};`,
    })
  }

  return (
    <div className="flex items-center justify-between h-12 px-2">
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={actions.refresh} disabled={state.loading}>
              <RefreshCw className={cn('h-4 w-4', state.loading && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('common.actions.refresh')}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setIsChartModalOpen(true)}>
              <BarChart3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('analysis.chart.create')}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <DataView.FilterButton
          onClick={() => actions.setIsFilterModalOpen(true)}
          count={Object.keys(state.activeFilter).length}
        />
        <Button className="rounded-lg gap-2.5 min-w-[86px]" onClick={actions.handleAddClick}>
          <Plus className="h-4 w-4" />
          {t('mongodb.collection.addData')}
        </Button>
        <Button className="rounded-lg gap-2.5 min-w-[86px]" onClick={() => actions.setShowExportModal(true)}>
          <Download className="h-4 w-4" />
          {t('common.actions.export')}
        </Button>
        <Button className="rounded-lg gap-2.5 min-w-[86px]" onClick={handleOpenQuery}>
          <TerminalSquare className="h-4 w-4" />
          {t('common.actions.query')}
        </Button>
      </div>
      <ChartCreateModal open={isChartModalOpen} onOpenChange={setIsChartModalOpen} />
    </div>
  )
}
