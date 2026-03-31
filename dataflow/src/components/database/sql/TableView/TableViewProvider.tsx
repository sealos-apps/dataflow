import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useInlineEditing } from './useInlineEditing'
import { useDataQuery } from './useDataQuery'
import type { TableViewContextValue, TableViewState, TableViewActions, FilterCondition } from './types'
import type { Alert } from '@/components/database/shared/types'

const TableViewCtx = createContext<TableViewContextValue | null>(null)

/** Hook to access TableView context. Throws if used outside TableViewProvider. */
export function useTableView(): TableViewContextValue {
  const ctx = use(TableViewCtx)
  if (!ctx) throw new Error('useTableView must be used within TableViewProvider')
  return ctx
}

/** Simplify verbose PostgreSQL column type names for display. */
export function simplifyColumnType(typeStr: string): string {
  if (!typeStr) return ''
  return typeStr
    .replace(/ varying/gi, '')
    .replace(/ without time zone/gi, '')
    .replace(/ with time zone/gi, ' tz')
    .replace(/character/gi, 'char')
    .replace(/double precision/gi, 'double')
    .trim()
}

interface TableViewProviderProps {
  connectionId: string
  databaseName: string
  tableName: string
  schema?: string
  children: ReactNode
}

/** Provider that owns all TableDetailView state, GraphQL operations, and handlers. */
export function TableViewProvider({ connectionId, databaseName, tableName, schema, children }: TableViewProviderProps) {
  // ---- UI state ----
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // ---- Column resizing state ----
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)

  // ---- Sorting state ----
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [activeColumnMenu, setActiveColumnMenu] = useState<string | null>(null)

  // ---- Filter state ----
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([])

  // ---- Modal state ----
  const [showExportModal, setShowExportModal] = useState(false)

  // ---- Alert state ----
  const [alert, setAlert] = useState<Alert | null>(null)

  // ---- Refs ----
  const lastTableRef = useRef<string>('')

  // ---- Callback for initial visible columns population ----
  const onInitVisibleColumns = useCallback((columns: string[]) => {
    setVisibleColumns(columns)
  }, [])

  // ---- Data query (GraphQL fetch, loading/error, race condition prevention) ----
  const { state: queryState, actions: queryActions } = useDataQuery({
    connectionId,
    databaseName,
    schema,
    tableName,
    currentPage,
    pageSize,
    searchTerm,
    sortColumn,
    sortDirection,
    filterConditions,
    visibleColumnsCount: visibleColumns.length,
    onInitVisibleColumns,
  })

  // ---- Initialize column widths ----
  useEffect(() => {
    if (queryState.data?.columns && Object.keys(columnWidths).length === 0) {
      const initialWidths: Record<string, number> = {}
      queryState.data.columns.forEach((col: string) => {
        initialWidths[col] = Math.max(120, col.length * 10 + 60)
      })
      setColumnWidths(initialWidths)
    }
  }, [queryState.data?.columns])

  // ---- Column resize mouse event listeners ----
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingRef.current) {
        const { column, startX, startWidth } = resizingRef.current
        const diff = e.clientX - startX
        const newWidth = Math.max(60, startWidth + diff)
        setColumnWidths(prev => ({ ...prev, [column]: newWidth }))
      }
    }

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null
        document.body.style.cursor = 'default'
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // ---- Alert helpers ----
  const showAlert = useCallback((title: string, message: string, type: Alert['type'] = 'info') => {
    setAlert({ title, message, type })
  }, [])

  const closeAlert = useCallback(() => setAlert(null), [])

  // ---- Inline editing (edit/add/delete rows) ----
  const { state: editingState, actions: editingActions } = useInlineEditing({
    connectionId,
    databaseName,
    schema,
    tableName,
    primaryKey: queryState.primaryKey,
    data: queryState.data,
    refresh: queryActions.refresh,
    showAlert,
  })

  // ---- Table switch: reset state ----
  useEffect(() => {
    const currentTableKey = `${connectionId}:${databaseName}:${schema || ''}:${tableName}`
    if (lastTableRef.current !== currentTableKey) {
      lastTableRef.current = currentTableKey
      setVisibleColumns([])
      setFilterConditions([])
      setSortColumn(null)
      setSortDirection(null)
      setSearchTerm('')
      setCurrentPage(1)
      editingActions.resetEditing()
    }
  }, [connectionId, databaseName, schema, tableName, editingActions])

  // ---- Search submit (reset to page 1) ----
  const handleSearchSubmit = useCallback(() => {
    setCurrentPage(1)
    queryActions.handleSubmitRequest(0)
  }, [queryActions.handleSubmitRequest])

  // ---- Sorting ----
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column)
    setSortDirection(direction)
    setActiveColumnMenu(null)
  }, [])

  const clearSort = useCallback(() => {
    setSortColumn(null)
    setSortDirection(null)
    setActiveColumnMenu(null)
  }, [])

  // ---- Column resize start ----
  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column] || 120,
    }
    document.body.style.cursor = 'col-resize'
  }, [columnWidths])

  // ---- Page change ----
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  // ---- Page size change ----
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  // ---- Filter apply ----
  const handleFilterApply = useCallback((cols: string[], conditions: FilterCondition[]) => {
    setVisibleColumns(cols)
    setFilterConditions(conditions)
    setCurrentPage(1)
    queryActions.refresh()
  }, [queryActions.refresh])

  const state: TableViewState = {
    ...queryState,
    currentPage,
    pageSize,
    searchTerm,
    visibleColumns,
    filterConditions,
    sortColumn,
    sortDirection,
    activeColumnMenu,
    ...editingState,
    columnWidths,
    showExportModal,
    isFilterModalOpen,
    alert,
  }

  const actions: TableViewActions = {
    refresh: queryActions.refresh,
    handleSubmitRequest: queryActions.handleSubmitRequest,
    handlePageChange,
    handlePageSizeChange,
    setSearchTerm,
    handleSearchSubmit,
    handleSort,
    clearSort,
    setActiveColumnMenu,
    ...editingActions,
    handleResizeStart,
    setIsFilterModalOpen,
    handleFilterApply,
    setShowExportModal,
    showAlert,
    closeAlert,
  }

  return <TableViewCtx value={{ state, actions }}>{children}</TableViewCtx>
}

