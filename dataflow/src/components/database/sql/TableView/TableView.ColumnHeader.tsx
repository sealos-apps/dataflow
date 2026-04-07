import {
  MoreHorizontal,
  ArrowUpAZ,
  ArrowDownAZ,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'
import { useTableView, simplifyColumnType } from './TableViewProvider'

interface ColumnHeaderProps {
  column: string
  index: number
}

/** Renders a single column header `<th>` with type badge, sort indicator, menu dropdown, and resize handle. */
export function TableViewColumnHeader({ column, index }: ColumnHeaderProps) {
  const { t } = useI18n()
  const { state, actions } = useTableView()
  const width = state.columnWidths[column] || 120

  return (
    <th
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
      className="px-6 py-2 text-left font-medium text-sm text-muted-foreground whitespace-nowrap group/header relative border-r border-border/50 select-none sticky top-0 bg-background z-40"
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex flex-col overflow-hidden mr-6">
          <div className="flex items-center gap-1">
            <span className="truncate" title={column}>{column}</span>
            {column === state.primaryKey && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">PK</Badge>}
            {state.foreignKeyColumns.includes(column) && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-primary/30 text-primary">FK</Badge>}
            {state.sortColumn === column && (
              <span className="text-primary shrink-0">
                {state.sortDirection === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />}
              </span>
            )}
          </div>
          {state.data?.columnTypes?.[column] && (
            <span className="text-xs font-normal text-muted-foreground/80 normal-case truncate">
              {simplifyColumnType(state.data.columnTypes[column])}
            </span>
          )}
        </div>
        <DropdownMenu
          open={state.activeColumnMenu === column}
          onOpenChange={(open) => actions.setActiveColumnMenu(open ? column : null)}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                "absolute top-2 right-2 text-muted-foreground",
                state.activeColumnMenu === column && "bg-muted text-foreground"
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={index === 0 ? 'start' : 'end'} className="w-40">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">
              {t('sql.table.sortActions')}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => actions.handleSort(column, 'asc')}
              className={cn(
                state.sortColumn === column && state.sortDirection === 'asc' && "bg-primary/5 font-medium text-primary"
              )}
            >
              <ArrowUpAZ className="h-3.5 w-3.5" />
              {t('sql.table.sortAsc')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => actions.handleSort(column, 'desc')}
              className={cn(
                state.sortColumn === column && state.sortDirection === 'desc' && "bg-primary/5 font-medium text-primary"
              )}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" />
              {t('sql.table.sortDesc')}
            </DropdownMenuItem>
            {state.sortColumn === column && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => actions.clearSort()}>
                  <X className="h-3.5 w-3.5" />
                  {t('sql.table.clearSort')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Resize Handle */}
      <div
        data-resize-col={column}
        className={cn(
          'absolute right-0 top-0 -bottom-px w-1 cursor-col-resize z-20 data-[resize-active]:bg-primary/50',
          state.resizingColumn === column && 'bg-primary/50',
        )}
        onMouseEnter={() => {
          if (state.resizingColumn) return
          document.querySelectorAll<HTMLElement>(`[data-resize-col="${column}"]`).forEach(el => { el.dataset.resizeActive = '' })
        }}
        onMouseLeave={() => {
          if (state.resizingColumn) return
          document.querySelectorAll<HTMLElement>(`[data-resize-col="${column}"]`).forEach(el => { delete el.dataset.resizeActive })
        }}
        onMouseDown={(e) => actions.handleResizeStart(e, column)}
      />
    </th>
  )
}
