import {
  MoreHorizontal,
  ArrowUpAZ,
  ArrowDownAZ,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/separator'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'
import { useTableView, simplifyColumnType } from './TableViewProvider'

interface ColumnHeaderProps {
  column: string
  index: number
  columnMenuRef: React.RefObject<HTMLDivElement | null>
}

/** Renders a single column header `<th>` with type badge, sort indicator, menu dropdown, and resize handle. */
export function TableViewColumnHeader({ column, index, columnMenuRef }: ColumnHeaderProps) {
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
            {state.foreignKeyColumns.includes(column) && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-blue-500 text-blue-600">FK</Badge>}
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
        <button
          onClick={(e) => {
            e.stopPropagation()
            actions.setActiveColumnMenu(state.activeColumnMenu === column ? null : column)
          }}
          className={cn(
            "absolute top-2 right-2 p-0.5 rounded hover:bg-muted transition-all text-muted-foreground",
            state.activeColumnMenu === column && "bg-muted text-foreground"
          )}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 z-20"
        onMouseDown={(e) => actions.handleResizeStart(e, column)}
      />

      {state.activeColumnMenu === column && (
        <div
          ref={columnMenuRef}
          className={cn(
            "absolute top-full mt-1 w-40 bg-popover text-popover-foreground border shadow-md rounded-md py-1 z-50 animate-in fade-in zoom-in-95 duration-100",
            index === 0 ? "left-0 origin-top-left" : "right-0 origin-top-right"
          )}
        >
          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/30 border-b mb-1">
            {t('sql.table.sortActions')}
          </div>
          <button
            onClick={() => actions.handleSort(column, 'asc')}
            className={cn(
              "w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors",
              state.sortColumn === column && state.sortDirection === 'asc' && "text-primary font-medium bg-primary/5"
            )}
            >
              <ArrowUpAZ className="h-3.5 w-3.5" />
              {t('sql.table.sortAsc')}
          </button>
          <button
            onClick={() => actions.handleSort(column, 'desc')}
            className={cn(
              "w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors",
              state.sortColumn === column && state.sortDirection === 'desc' && "text-primary font-medium bg-primary/5"
            )}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" />
              {t('sql.table.sortDesc')}
          </button>
          {state.sortColumn === column && (
            <>
              <Separator className="my-1" />
              <button
                onClick={() => actions.clearSort()}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                {t('sql.table.clearSort')}
              </button>
            </>
          )}
        </div>
      )}
    </th>
  )
}
