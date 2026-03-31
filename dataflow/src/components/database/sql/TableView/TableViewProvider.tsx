import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
  useGetStorageUnitRowsLazyQuery,
  useAddRowMutation,
  useDeleteRowMutation,
  useUpdateStorageUnitMutation,
  WhereConditionType,
  SortDirection,
  type WhereCondition,
  type SortCondition,
} from '@graphql'
import { transformRowsResult, type TableData } from '@/utils/graphql-transforms'
import { resolveSchemaParam, isNoSQL } from '@/utils/database-features'
import { parseSearchToWhereCondition, mergeSearchWithWhere } from '@/utils/search-parser'
import type { TableViewContextValue, FilterCondition } from './types'
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
  const { connections, tableRefreshKey } = useConnectionStore()

  // ---- GraphQL hooks ----
  const [getRows] = useGetStorageUnitRowsLazyQuery({ fetchPolicy: 'no-cache' })
  const [addRow] = useAddRowMutation()
  const [deleteRow] = useDeleteRowMutation()
  const [updateStorageUnit] = useUpdateStorageUnitMutation()

  // ---- Core state ----
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TableData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  // ---- Row editing state ----
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [deletingRowIndex, setDeletingRowIndex] = useState<number | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [primaryKey, setPrimaryKey] = useState<string | null>(null)
  const [foreignKeyColumns, setForeignKeyColumns] = useState<string[]>([])

  // ---- Column resizing state ----
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)

  // ---- New row state ----
  const [isAddingRow, setIsAddingRow] = useState(false)
  const [newRowData, setNewRowData] = useState<Record<string, any>>({})

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
  const latestRequestIdRef = useRef(0)
  const filterConditionsRef = useRef(filterConditions)
  const columnsRef = useRef<{ names: string[]; types: string[] }>({ names: [], types: [] })
  const lastTableRef = useRef<string>('')

  // ---- Keep refs in sync ----
  useEffect(() => { filterConditionsRef.current = filterConditions }, [filterConditions])

  useEffect(() => {
    if (data?.columns && data.columns.length > 0) {
      columnsRef.current = {
        names: data.columns,
        types: data.columns.map(c => data.columnTypes[c] ?? 'string'),
      }
    }
  }, [data?.columns, data?.columnTypes])

  // ---- Initialize column widths ----
  useEffect(() => {
    if (data?.columns && Object.keys(columnWidths).length === 0) {
      const initialWidths: Record<string, number> = {}
      data.columns.forEach((col: string) => {
        initialWidths[col] = Math.max(120, col.length * 10 + 60)
      })
      setColumnWidths(initialWidths)
    }
  }, [data?.columns])

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

  // ---- Main data fetch ----
  const handleSubmitRequest = useCallback(async (overridePageOffset?: number) => {
    const conn = connections.find((c) => c.id === connectionId)
    if (!conn) return

    setLoading(true)
    setError(null)

    latestRequestIdRef.current += 1
    const thisRequestId = latestRequestIdRef.current

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema)

    // Build sort condition
    const sort: SortCondition[] | undefined =
      sortColumn && sortDirection
        ? [{ Column: sortColumn, Direction: sortDirection === 'asc' ? SortDirection.Asc : SortDirection.Desc }]
        : undefined

    // Build filter where condition
    const currentFilters = filterConditionsRef.current
    let filterWhere: WhereCondition | undefined
    if (currentFilters.length > 0) {
      const atomicConditions: WhereCondition[] = currentFilters
        .filter((fc) => fc.column && fc.operator)
        .map((fc) => ({
          Type: WhereConditionType.Atomic,
          Atomic: {
            Key: fc.column,
            Operator: fc.operator,
            Value: fc.value ?? '',
            ColumnType: data?.columnTypes[fc.column] ?? 'string',
          },
        }))

      if (atomicConditions.length === 1) {
        filterWhere = atomicConditions[0]
      } else if (atomicConditions.length > 1) {
        filterWhere = { Type: WhereConditionType.And, And: { Children: atomicConditions } }
      }
    }

    // Build search where condition
    const searchWhere = searchTerm.trim()
      ? parseSearchToWhereCondition(
          searchTerm,
          columnsRef.current.names,
          columnsRef.current.types,
        )
      : undefined

    const where = mergeSearchWithWhere(searchWhere, filterWhere)

    try {
      const { data: result, error: queryError } = await getRows({
        variables: {
          schema: graphqlSchema,
          storageUnit: tableName,
          where,
          sort,
          pageSize,
          pageOffset: overridePageOffset ?? (currentPage - 1) * pageSize,
        },
        context: { database: databaseName },
      })

      if (thisRequestId !== latestRequestIdRef.current) return

      if (queryError) {
        setError(queryError.message)
        return
      }

      if (result?.Row) {
        const tableData = transformRowsResult(result.Row)
        setData(tableData)
        setPrimaryKey(tableData.primaryKey)
        setForeignKeyColumns(tableData.foreignKeyColumns)
        if (visibleColumns.length === 0 && tableData.columns.length > 0) {
          setVisibleColumns(tableData.columns)
        }
      }
    } catch (err: any) {
      if (thisRequestId !== latestRequestIdRef.current) return
      setError(err.message || 'Failed to fetch table data')
    } finally {
      if (thisRequestId === latestRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [connections, connectionId, databaseName, schema, tableName, sortColumn, sortDirection, searchTerm, pageSize, currentPage, getRows, visibleColumns.length])

  // ---- Table switch: reset state + fetch ----
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
      setEditingRowIndex(null)
      setSelectedRowIndex(null)
      setIsAddingRow(false)
    }
  }, [connectionId, databaseName, schema, tableName])

  // ---- Initial fetch + refetch on data-changing params ----
  useEffect(() => {
    handleSubmitRequest()
  }, [handleSubmitRequest, refreshKey, tableRefreshKey])

  // ---- Search submit (reset to page 1) ----
  const handleSearchSubmit = useCallback(() => {
    setCurrentPage(1)
    handleSubmitRequest(0)
  }, [handleSubmitRequest])

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

  // ---- Row editing ----
  const handleEditClick = useCallback((row: any, index: number) => {
    setEditingRowIndex(index)
    setSelectedRowIndex(index)
    setEditValues({ ...row })
    setIsAddingRow(false)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingRowIndex(null)
    setEditValues({})
  }, [])

  const handleInputChange = useCallback((col: string, value: string) => {
    setEditValues(prev => ({ ...prev, [col]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!primaryKey) {
      showAlert('Error', 'Cannot update row: Primary Key not found for this table.', 'error')
      return
    }

    const conn = connections.find((c) => c.id === connectionId)
    if (!conn || editingRowIndex === null || !data) return

    const originalRow = data.rows[editingRowIndex]

    const updatedColumns = Object.keys(editValues).filter(
      (key) => editValues[key] !== originalRow[key],
    )

    if (updatedColumns.length === 0) {
      handleCancelEdit()
      return
    }

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema)

    const values = Object.entries(editValues).map(([key, value]) => ({
      Key: key,
      Value: String(value ?? ''),
    }))

    try {
      const { data: result, errors } = await updateStorageUnit({
        variables: {
          schema: graphqlSchema,
          storageUnit: tableName,
          values,
          updatedColumns,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert('Error', `Failed to update row: ${errors[0].message}`, 'error')
        return
      }

      if (result?.UpdateStorageUnit.Status) {
        showAlert('Success', 'Row updated successfully!', 'success')
        handleCancelEdit()
        setRefreshKey(prev => prev + 1)
      } else {
        showAlert('Error', 'Failed to update row', 'error')
      }
    } catch (error: any) {
      showAlert('Error', `Error updating row: ${error.message}`, 'error')
    }
  }, [primaryKey, connections, connectionId, editingRowIndex, data, editValues, databaseName, schema, tableName, updateStorageUnit, showAlert, handleCancelEdit])

  // ---- Delete ----
  const handleDeleteClick = useCallback((index: number) => {
    setDeletingRowIndex(index)
    setShowDeleteModal(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (deletingRowIndex === null || !primaryKey || !data) return

    const conn = connections.find((c) => c.id === connectionId)
    if (!conn) return

    const row = data.rows[deletingRowIndex]
    const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema)

    const values = Object.entries(row).map(([key, value]) => ({
      Key: key,
      Value: String(value ?? ''),
    }))

    try {
      const { data: result, errors } = await deleteRow({
        variables: {
          schema: graphqlSchema,
          storageUnit: tableName,
          values,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert('Error', `Failed to delete row: ${errors[0].message}`, 'error')
        return
      }

      if (result?.DeleteRow.Status) {
        showAlert('Success', 'Row deleted successfully!', 'success')
        setRefreshKey(prev => prev + 1)
      } else {
        showAlert('Error', 'Failed to delete row', 'error')
      }
    } catch (error: any) {
      showAlert('Error', `Error deleting row: ${error.message}`, 'error')
    } finally {
      setDeletingRowIndex(null)
    }
  }, [deletingRowIndex, primaryKey, data, connections, connectionId, databaseName, schema, tableName, deleteRow, showAlert])

  // ---- Add row ----
  const handleAddClick = useCallback(() => {
    setIsAddingRow(true)
    setNewRowData({})
    setEditingRowIndex(null)
    setSelectedRowIndex(null)
  }, [])

  const handleCancelAdd = useCallback(() => {
    setIsAddingRow(false)
    setNewRowData({})
  }, [])

  const handleNewRowInputChange = useCallback((col: string, value: string) => {
    setNewRowData(prev => ({ ...prev, [col]: value }))
  }, [])

  const handleSaveNewRow = useCallback(async () => {
    const conn = connections.find((c) => c.id === connectionId)
    if (!conn) return

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema)
    let values: Array<{ Key: string; Value: string }>

    // MongoDB document mode: single Document column -> parse JSON
    if (isNoSQL(conn.type) && data?.columns.length === 1 && data.columnTypes[data.columns[0]] === 'Document') {
      const docValue = newRowData[data.columns[0]] || newRowData['document'] || ''
      try {
        const json = JSON.parse(docValue)
        values = Object.keys(json).map(key => {
          const val = json[key]
          return {
            Key: key,
            Value: typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val),
          }
        })
      } catch {
        showAlert('Error', 'Invalid JSON document', 'error')
        return
      }
    } else {
      // Standard relational mode
      if (Object.keys(newRowData).length === 0 || Object.values(newRowData).every((v) => !v)) {
        showAlert('Error', 'Please enter at least one value', 'error')
        return
      }
      values = Object.entries(newRowData)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([key, value]) => ({ Key: key, Value: String(value) }))
    }

    if (values.length === 0) {
      showAlert('Error', 'Please enter at least one value', 'error')
      return
    }

    try {
      const { data: result, errors } = await addRow({
        variables: {
          schema: graphqlSchema,
          storageUnit: tableName,
          values,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert('Error', `Failed to add row: ${errors[0].message}`, 'error')
        return
      }

      if (result?.AddRow.Status) {
        showAlert('Success', 'New row added successfully!', 'success')
        handleCancelAdd()
        setRefreshKey(prev => prev + 1)
      } else {
        showAlert('Error', 'Failed to add row', 'error')
      }
    } catch (error: any) {
      showAlert('Error', `Error adding row: ${error.message}`, 'error')
    }
  }, [connections, connectionId, databaseName, schema, data, newRowData, tableName, addRow, showAlert, handleCancelAdd])

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

  // ---- Page change (useEffect-driven refetch) ----
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  // ---- Page size change ----
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  // ---- Refresh ----
  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  // ---- Filter apply ----
  const handleFilterApply = useCallback((cols: string[], conditions: FilterCondition[]) => {
    setVisibleColumns(cols)
    setFilterConditions(conditions)
    setCurrentPage(1)
    filterConditionsRef.current = conditions
    setRefreshKey(prev => prev + 1)
  }, [])

  // ---- Derived values ----
  const canEdit = data ? !data.disableUpdate : false
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  const state = {
    loading,
    data,
    error,
    primaryKey,
    foreignKeyColumns,
    currentPage,
    pageSize,
    total,
    totalPages,
    searchTerm,
    visibleColumns,
    filterConditions,
    sortColumn,
    sortDirection,
    activeColumnMenu,
    editingRowIndex,
    editValues,
    selectedRowIndex,
    isAddingRow,
    newRowData,
    columnWidths,
    showExportModal,
    showDeleteModal,
    isFilterModalOpen,
    deletingRowIndex,
    alert,
    canEdit,
  }

  const actions = {
    refresh,
    handleSubmitRequest,
    handlePageChange,
    handlePageSizeChange,
    setSearchTerm,
    handleSearchSubmit,
    handleSort,
    clearSort,
    setActiveColumnMenu,
    handleEditClick,
    handleCancelEdit,
    handleInputChange,
    handleSave,
    handleAddClick,
    handleCancelAdd,
    handleNewRowInputChange,
    handleSaveNewRow,
    handleDeleteClick,
    handleConfirmDelete,
    handleResizeStart,
    setSelectedRowIndex,
    setIsFilterModalOpen,
    handleFilterApply,
    setShowExportModal,
    setShowDeleteModal,
    showAlert,
    closeAlert,
  }

  return <TableViewCtx value={{ state, actions }}>{children}</TableViewCtx>
}

