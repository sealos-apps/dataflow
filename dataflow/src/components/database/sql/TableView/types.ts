import type { TableData } from '@/utils/graphql-transforms'
import type { Alert } from '@/components/database/shared/types'

/** Context value exposed by TableViewProvider. */
export interface TableViewContextValue {
  state: TableViewState
  actions: TableViewActions
}

/** All state managed by the TableView provider. */
export interface TableViewState {
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
  editingRowIndex: number | null
  editValues: Record<string, any>
  selectedRowIndex: number | null
  isAddingRow: boolean
  newRowData: Record<string, any>
  columnWidths: Record<string, number>
  showExportModal: boolean
  showDeleteModal: boolean
  isFilterModalOpen: boolean
  deletingRowIndex: number | null
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
  handleEditClick: (row: any, index: number) => void
  handleCancelEdit: () => void
  handleInputChange: (col: string, value: string) => void
  handleSave: () => Promise<void>
  handleAddClick: () => void
  handleCancelAdd: () => void
  handleNewRowInputChange: (col: string, value: string) => void
  handleSaveNewRow: () => Promise<void>
  handleDeleteClick: (index: number) => void
  handleConfirmDelete: () => Promise<void>
  handleResizeStart: (e: React.MouseEvent, column: string) => void
  setSelectedRowIndex: (index: number | null) => void
  setIsFilterModalOpen: (open: boolean) => void
  handleFilterApply: (cols: string[], conditions: FilterCondition[]) => void
  setShowExportModal: (open: boolean) => void
  setShowDeleteModal: (open: boolean) => void
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
