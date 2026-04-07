import { use, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Loader2, EyeOff } from 'lucide-react'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'
import { useTableView } from './TableViewProvider'
import { TableViewColumnHeader } from './TableView.ColumnHeader'
import { FindBarContext } from '@/components/database/shared/FindBar.Provider'

/** Renders the SQL table data grid with row-number selection, cell editing, and pending-change states. */
export function TableViewDataGrid() {
  const { t } = useI18n()
  const { state, actions } = useTableView()
  const findBar = use(FindBarContext)

  const visibleColumns = state.data?.columns?.filter((col) => state.visibleColumns.includes(col)) ?? []
  const hiddenColumnCount = state.data?.columns
    ? state.data.columns.length - state.visibleColumns.length
    : 0

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !isTypingTarget) {
        event.preventDefault()
        actions.undoLastChange()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [actions.undoLastChange])

  if (state.loading && !state.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  function isEditableCell(rowKey: string, column: string, isDeleted: boolean, isInserted: boolean) {
    if (!state.canEdit || isDeleted) return false
    if (isInserted) return true
    if (state.primaryKey && column === state.primaryKey) return false
    return true
  }

  function handleCellKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
    rowKey: string,
    column: string,
  ) {
    if (event.key === 'Escape') {
      event.preventDefault()
      actions.deactivateCell()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      actions.moveActiveCell(event.shiftKey ? 'left' : 'right')
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      actions.moveActiveCell(event.shiftKey ? 'up' : 'down')
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      actions.deactivateCell()
      actions.undoLastChange()
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      actions.deactivateCell()
      actions.setShowSubmitModal(true)
      return
    }

    if (state.activeCell?.rowKey !== rowKey || state.activeCell.column !== column) {
      actions.activateCell(rowKey, column)
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead className="border-b border-border bg-background">
          <tr>
            <th
              className="sticky top-0 left-0 z-50 border-b border-r border-border/50 bg-background px-2 py-2 text-center text-xs font-semibold text-muted-foreground"
              style={{ width: 64, minWidth: 64, maxWidth: 64 }}
            > </th>
            {visibleColumns.map((col, idx) => (
              <TableViewColumnHeader key={col} column={col} index={idx} />
            ))}
            {hiddenColumnCount > 0 && (
              <th
                className="sticky top-0 z-40 border-b border-border/50 bg-background px-4 py-2 text-center text-xs font-medium text-muted-foreground"
                title={t('sql.table.hiddenColumnsTitle', { count: hiddenColumnCount })}
              >
                <div className="flex items-center justify-center gap-1">
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>{hiddenColumnCount}</span>
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-background">
          {state.renderedRows.map((row, rowIdx) => {
            const isSelected = state.selectedRowKeys.has(row.rowKey)

            return (
              <tr
                key={row.rowKey}
                className={cn(
                  'group transition-colors',
                  row.isInserted && 'bg-blue-100/20',
                  row.isDeleted && 'bg-red-100/20',
                  !row.isInserted && !row.isDeleted && 'hover:bg-muted/50',
                )}
              >
                <td
                  className={cn(
                    'sticky left-0 z-30 border-b border-r border-border/50 px-2 py-2 text-center text-xs font-medium',
                    row.isInserted && 'bg-blue-100/60',
                    row.isDeleted && 'bg-red-100/60 text-muted-foreground line-through',
                    isSelected && 'bg-primary text-primary-foreground',
                  )}
                  style={{ width: 64, minWidth: 64, maxWidth: 64 }}
                  onClick={() => {
                    if (state.canEdit) actions.toggleRowSelection(row.rowKey)
                  }}
                >
                  {row.rowNumber ?? ''}
                </td>

                {visibleColumns.map((col) => {
                  const width = state.columnWidths[col] || 120
                  const isActiveCell =
                    state.activeCell?.rowKey === row.rowKey &&
                    state.activeCell.column === col
                  const editable = isEditableCell(row.rowKey, col, row.isDeleted, row.isInserted)
                  const changed =
                    row.changeType === 'update' &&
                    row.originalRow[col] !== row.values[col]
                  const highlight = findBar?.state.total
                    ? findBar.state.matches.findIndex((match) => match.rowIndex === rowIdx && match.columnKey === col) === findBar.state.currentMatchIndex
                      ? 'current'
                      : findBar.state.matches.some((match) => match.rowIndex === rowIdx && match.columnKey === col)
                        ? 'match'
                        : null
                    : null
                  const displayValue = row.values[col]

                  return (
                    <td
                      key={col}
                      data-find-current={highlight === 'current' ? 'true' : undefined}
                      className={cn(
                        'relative border-b border-r border-border/50 text-sm text-foreground/80 scroll-mt-14',
                        isActiveCell ? 'p-0' : 'px-6 py-2',
                        row.isInserted && 'bg-blue-100/60',
                        row.isDeleted && 'bg-red-100/60 line-through text-muted-foreground',
                        changed && 'bg-green-100/60',
                        isSelected && !row.isInserted && !row.isDeleted && !changed && 'bg-primary/10',
                        highlight === 'current' && 'bg-blue-200',
                        highlight === 'match' && 'bg-blue-100/60',
                        editable && !isActiveCell && 'cursor-default',
                      )}
                      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                      onDoubleClick={() => {
                        if (editable) actions.activateCell(row.rowKey, col)
                      }}
                    >
                      {isActiveCell ? (
                        <input
                          autoFocus
                          type="text"
                          data-changeset-editor="true"
                          value={state.activeDraftValue}
                          onChange={(event) => actions.updateActiveCellValue(event.target.value)}
                          onBlur={() => {
                            queueMicrotask(() => {
                              const activeElement = document.activeElement
                              if (
                                activeElement instanceof HTMLInputElement &&
                                activeElement.dataset.changesetEditor === 'true'
                              ) {
                                return
                              }
                              actions.deactivateCell()
                            })
                          }}
                          onKeyDown={(event) => handleCellKeyDown(event, row.rowKey, col)}
                          className="w-full min-h-[36px] bg-transparent px-6 py-2 text-sm focus:bg-background focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                        />
                      ) : (
                        <span className="block truncate" title={displayValue ?? 'NULL'}>
                          {displayValue == null ? (
                            <span className="italic text-muted-foreground">NULL</span>
                          ) : (
                            String(displayValue)
                          )}
                        </span>
                      )}
                      <div
                        data-resize-col={col}
                        className={cn(
                          'absolute right-0 top-0 -bottom-px w-1 cursor-col-resize z-20 data-[resize-active]:bg-primary/50',
                          state.resizingColumn === col && 'bg-primary/50',
                        )}
                        onMouseEnter={() => {
                          if (state.resizingColumn) return
                          document.querySelectorAll<HTMLElement>(`[data-resize-col="${col}"]`).forEach(el => { el.dataset.resizeActive = '' })
                        }}
                        onMouseLeave={() => {
                          if (state.resizingColumn) return
                          document.querySelectorAll<HTMLElement>(`[data-resize-col="${col}"]`).forEach(el => { delete el.dataset.resizeActive })
                        }}
                        onMouseDown={(e) => actions.handleResizeStart(e, col)}
                      />
                    </td>
                  )
                })}

                {hiddenColumnCount > 0 && <td className="border-b border-border/50 bg-background" />}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
