import { useEffect, useRef } from 'react'
import {
  Loader2,
  Edit2,
  Trash2,
  Save,
  X,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'
import { useTableView } from './TableViewProvider'
import { TableViewColumnHeader } from './TableView.ColumnHeader'

/** Renders the data grid including `<table>`, column headers, add-row form, data rows with inline editing, and action buttons. */
export function TableViewDataGrid() {
  const { t } = useI18n()
  const { state, actions } = useTableView()
  const columnMenuRef = useRef<HTMLDivElement | null>(null)

  // Close column menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        actions.setActiveColumnMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [actions])

  const hiddenColumnCount = state.data?.columns
    ? state.data.columns.length - state.visibleColumns.length
    : 0

  if (state.loading && !state.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-background border-b border-border">
          <tr>
            {state.data?.columns?.filter((col: string) => state.visibleColumns.includes(col)).map((col: string, idx: number) => (
              <TableViewColumnHeader
                key={idx}
                column={col}
                index={idx}
                columnMenuRef={columnMenuRef}
              />
            ))}
            {state.canEdit && (
              <th className="px-6 py-2 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wider border-b border-r border-border/50 w-[120px] sticky top-0 right-0 bg-background z-50 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)]">
                {t('sql.table.actions')}
              </th>
            )}
            {hiddenColumnCount > 0 && (
              <th
                className="px-4 py-2 text-center font-medium text-xs text-muted-foreground border-b border-border/50 sticky top-0 bg-background z-40"
                title={t('sql.table.hiddenColumnsTitle', { count: hiddenColumnCount })}
              >
                <div className="flex items-center gap-1 justify-center">
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>{hiddenColumnCount}</span>
                </div>
              </th>
            )}
            <th className="border-b border-border/50 w-full bg-background sticky top-0 z-40"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 bg-background">
          {/* Add Row */}
          {state.canEdit && state.isAddingRow && (
            <tr className="bg-muted border-b border-border/50">
              {state.data?.columns?.filter((col: string) => state.visibleColumns.includes(col)).map((col: string, idx: number) => {
                const width = state.columnWidths[col] || 120
                return (
                  <td key={idx} className="p-0 border-r border-border/50" style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}>
                    <input
                      type="text"
                      autoFocus={idx === 0}
                      className="w-full h-full min-h-[36px] bg-transparent border-none rounded-none px-6 py-2 text-sm focus:outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary transition-colors"
                      placeholder={t('sql.table.enterValue', { column: col })}
                      value={state.newRowData[col] || ''}
                      onChange={(e) => actions.handleNewRowInputChange(col, e.target.value)}
                    />
                  </td>
                )
              })}
              <td className="px-6 py-2 text-right whitespace-nowrap sticky right-0 bg-muted border-r border-border/50 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] z-20">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    onClick={actions.handleSaveNewRow}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    title={t('sql.table.saveNewRow')}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={actions.handleCancelAdd}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title={t('common.actions.cancel')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
              <td className="border-b border-border/50 bg-muted"></td>
            </tr>
          )}

          {state.data?.rows?.map((row: any, rowIdx: number) => {
            const isEditing = state.editingRowIndex === rowIdx
            const isSelected = state.selectedRowIndex === rowIdx
            return (
              <tr
                key={rowIdx}
                onClick={() => {
                  // If editing another row, close edit mode to keep only one row highlighted
                  if (state.editingRowIndex !== null && state.editingRowIndex !== rowIdx) {
                    actions.handleCancelEdit()
                  }
                  actions.setSelectedRowIndex(rowIdx)
                }}
                className={cn(
                  "transition-colors group cursor-pointer",
                  isEditing ? "bg-muted" : isSelected ? "bg-muted" : "hover:bg-muted/30"
                )}
              >
                {state.data?.columns?.filter((col: string) => state.visibleColumns.includes(col)).map((col: string, colIdx: number) => {
                  const width = state.columnWidths[col] || 120
                  return (
                    <td
                      key={colIdx}
                      className={cn("whitespace-nowrap text-sm text-foreground/80 border-b border-r border-border/50", isEditing ? "p-0" : "px-6 py-2")}
                      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus={colIdx === 0}
                          value={state.editValues[col] !== undefined ? state.editValues[col] : (row[col] ?? '')}
                          onChange={(e) => actions.handleInputChange(col, e.target.value)}
                          className="w-full h-full min-h-[36px] bg-transparent border-none rounded-none px-6 py-2 text-sm focus:outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary transition-colors"
                        />
                      ) : (
                        <span className="block truncate" title={String(row[col])}>
                          {row[col] === null ? <span className="text-muted-foreground italic">NULL</span> : String(row[col])}
                        </span>
                      )}
                    </td>
                  )
                })}
                {state.canEdit && (
                  <td className={cn(
                    "px-6 py-2 text-right whitespace-nowrap sticky right-0 transition-colors z-20 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] border-r border-b border-border/50",
                    isEditing ? "bg-muted" : isSelected ? "bg-muted" : "bg-background group-hover:bg-muted/30"
                  )}>
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            onClick={actions.handleSave}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title={t('common.actions.submit')}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={actions.handleCancelEdit}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title={t('common.actions.cancel')}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => actions.handleEditClick(row, rowIdx)}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title={t('sql.table.editRow')}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() => actions.handleDeleteClick(rowIdx)}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title={t('sql.table.deleteRowAction')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                )}
                <td className={cn(
                  "border-b border-border/50",
                  isEditing ? "bg-muted" : ""
                )}></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
