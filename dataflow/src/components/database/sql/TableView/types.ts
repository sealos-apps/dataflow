import type { TableData } from '@/utils/graphql-transforms'
import type { Alert } from '@/components/database/shared/types'
import type { StagedSessionAction } from '@/components/database/shared/staged-session/reducer'
import type { StagedSessionModalState, StagedSessionPendingChangesState, StagedSessionPublicState } from '@/components/database/shared/staged-session/types'

export type ChangesetCellValue = string | null
export type ChangesetRowKey = string

export interface SqlChangesetEditorState {
  activeCell: { rowKey: ChangesetRowKey; column: string } | null
  activeDraftValue: string
  /**
   * Local monotonic counter used to generate stable "new-*" row keys for inserted rows.
   * This stays SQL-local because it is an editor implementation detail.
   */
  newRowCounter: number
}

export interface UndoEntryCell {
  kind: 'cell'
  rowKey: ChangesetRowKey
  column: string
  oldValue: ChangesetCellValue
  newValue: ChangesetCellValue
}

export interface UndoEntryAddRow {
  kind: 'add-row'
  rowKey: ChangesetRowKey
}

export interface UndoEntryDeleteRows {
  kind: 'delete-rows'
  rowKeys: ChangesetRowKey[]
  previousChanges: Array<[ChangesetRowKey, RowChange | undefined]>
}

export type UndoEntry = UndoEntryCell | UndoEntryAddRow | UndoEntryDeleteRows

export interface RowChange {
  type: 'update' | 'insert' | 'delete'
  originalRow: Record<string, ChangesetCellValue>
  cells: Record<string, { old: ChangesetCellValue; new: ChangesetCellValue }>
  values: Record<string, ChangesetCellValue>
}

export interface RenderedTableRow {
  rowKey: ChangesetRowKey
  sourceRowIndex: number | null
  rowNumber: number | null
  values: Record<string, ChangesetCellValue>
  originalRow: Record<string, ChangesetCellValue>
  changeType: RowChange['type'] | null
  isDeleted: boolean
  isInserted: boolean
}

export type ChangesetSessionAction = StagedSessionAction<RowChange, UndoEntry>

export type ChangesetAction =
  | { type: 'activate-cell'; rowKey: ChangesetRowKey; column: string; initialValue?: string }
  | { type: 'deactivate-cell' }
  | { type: 'update-active-draft'; value: string }
  | {
      type: 'commit-active-cell'
      rowKey: ChangesetRowKey
      column: string
      originalRow: Record<string, ChangesetCellValue>
      previousValue: ChangesetCellValue
      value: ChangesetCellValue
    }
  | {
      type: 'add-row'
      rowKey: ChangesetRowKey
      initialValues: Record<string, ChangesetCellValue>
    }
  | {
      type: 'delete-selected'
      rows: Array<{
        rowKey: ChangesetRowKey
        originalRow: Record<string, ChangesetCellValue>
        isInserted?: boolean
      }>
    }
  | { type: 'undo' }
  | ChangesetSessionAction

export type SqlChangesetSessionPublicState = StagedSessionPublicState<ChangesetRowKey, RowChange, UndoEntry>

export type SqlChangesetModalState = StagedSessionModalState

export type SqlChangesetPendingChangesState = StagedSessionPendingChangesState

/** Context value exposed by TableViewProvider. */
export interface TableViewContextValue {
  state: TableViewState
  actions: TableViewActions
}

/** All state managed by the TableView provider. */
export interface TableViewState extends SqlChangesetSessionPublicState {
  loading: boolean
  data: TableData | null
  error: string | null
  primaryKey: string | null
  foreignKeyColumns: string[]
  currentPage: number
  pageSize: number
  total: number
  totalPages: number
  searchTerm: string
  visibleColumns: string[]
  filterConditions: FilterCondition[]
  sortColumn: string | null
  sortDirection: 'asc' | 'desc' | null
  activeColumnMenu: string | null
  activeCell: { rowKey: ChangesetRowKey; column: string } | null
  activeDraftValue: string
  renderedRows: RenderedTableRow[]
  columnWidths: Record<string, number>
  resizingColumn: string | null
  resizedColumns: Set<string>
  showExportModal: boolean
  isFilterModalOpen: boolean
  alert: Alert | null
  canEdit: boolean
}

/** All actions exposed by the TableView provider. */
export interface TableViewActions {
  refresh: () => void
  handleSubmitRequest: (overridePageOffset?: number) => Promise<void>
  handlePageChange: (page: number) => void
  handlePageSizeChange: (size: number) => void
  setSearchTerm: (term: string) => void
  handleSearchSubmit: () => void
  handleSort: (column: string, direction: 'asc' | 'desc') => void
  clearSort: () => void
  setActiveColumnMenu: (col: string | null) => void
  activateCell: (rowKey: ChangesetRowKey, column: string) => void
  deactivateCell: () => void
  updateActiveCellValue: (value: string) => void
  moveActiveCell: (direction: 'left' | 'right' | 'up' | 'down') => void
  toggleRowSelection: (rowKey: ChangesetRowKey) => void
  addPendingRow: () => void
  markSelectedRowsForDelete: () => void
  undoLastChange: () => void
  submitChanges: () => Promise<void>
  discardChanges: () => void
  setShowPreviewModal: (open: boolean) => void
  setShowSubmitModal: (open: boolean) => void
  setShowDiscardModal: (open: boolean) => void
  handleResizeStart: (e: React.MouseEvent, column: string) => void
  setIsFilterModalOpen: (open: boolean) => void
  handleFilterApply: (cols: string[], conditions: FilterCondition[]) => void
  setShowExportModal: (open: boolean) => void
  confirmDiscardAndContinue: () => void
  showAlert: (title: string, message: string, type: Alert['type']) => void
  closeAlert: () => void
}

/** A single filter condition for SQL WHERE clause. */
export interface FilterCondition {
  id: string
  column: string
  operator: string
  value: string
}
