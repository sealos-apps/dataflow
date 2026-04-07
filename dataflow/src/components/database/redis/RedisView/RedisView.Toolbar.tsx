import { Plus, Minus, Download, RefreshCw, Undo2, TerminalSquare } from 'lucide-react'
import { useRedisView } from './RedisViewProvider'
import { DataView } from '@/components/database/shared/DataView'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/useI18n'
import { useTabStore } from '@/stores/useTabStore'

interface RedisViewToolbarProps {
  connectionId: string
  databaseName: string
}

export function RedisViewToolbar({ connectionId, databaseName }: RedisViewToolbarProps) {
  const { t } = useI18n()
  const { state, actions } = useRedisView()
  const openTab = useTabStore((s) => s.openTab)

  const handleOpenQuery = () => {
    openTab({
      type: 'query',
      title: t('sidebar.tab.queryWithDatabase', { database: databaseName }),
      connectionId,
      databaseName,
      sqlContent: 'KEYS *',
    })
  }

  return (
    <div className="flex items-center justify-between h-12 pr-2">
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => actions.refresh()} disabled={state.loading}>
              <RefreshCw className={cn("h-4 w-4", state.loading && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('common.actions.refresh')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={actions.openAddModal}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('redis.actions.addKey')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="ghost" size="icon" disabled>
                <Minus className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('common.actions.delete')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="ghost" size="icon" disabled>
                <Undo2 className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('common.actions.undo')}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <DataView.FilterButton onClick={() => actions.setIsFilterModalOpen(true)} />
        <Button
          className="rounded-lg gap-2.5 min-w-[86px]"
          onClick={() => actions.setShowExportModal(true)}
          disabled={state.loading || state.filteredKeys.length === 0}
        >
          <Download className="h-4 w-4" />
          {t('common.actions.export')}
        </Button>
        <Button className="rounded-lg gap-2.5 min-w-[86px]" onClick={handleOpenQuery}>
          <TerminalSquare className="h-4 w-4" />
          {t('common.actions.query')}
        </Button>
      </div>
    </div>
  )
}
