import { useCallback, useState } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
  useAddRowMutation,
  useDeleteRowMutation,
  useUpdateStorageUnitMutation,
} from '@graphql'
import { resolveSchemaParam, isNoSQL } from '@/utils/database-features'
import { useI18n } from '@/i18n/useI18n'
import type { TableData } from '@/utils/graphql-transforms'
import type { Alert } from '@/components/database/shared/types'

interface UseInlineEditingParams {
  connectionId: string
  databaseName: string
  schema?: string
  tableName: string
  primaryKey: string | null
  data: TableData | null
  refresh: () => void
  showAlert: (title: string, message: string, type: Alert['type']) => void
}

/** State for row editing, adding, and deleting. */
export interface InlineEditingState {
  editingRowIndex: number | null
  editValues: Record<string, any>
  selectedRowIndex: number | null
  isAddingRow: boolean
  newRowData: Record<string, any>
  deletingRowIndex: number | null
  showDeleteModal: boolean
}

/** Actions for row editing, adding, and deleting. */
export interface InlineEditingActions {
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
  setSelectedRowIndex: (index: number | null) => void
  setShowDeleteModal: (open: boolean) => void
  /** Reset editing/adding state (e.g. on table switch). */
  resetEditing: () => void
}

/** Hook that encapsulates all inline row editing, adding, and deleting logic. */
export function useInlineEditing({
  connectionId,
  databaseName,
  schema,
  tableName,
  primaryKey,
  data,
  refresh,
  showAlert,
}: UseInlineEditingParams): { state: InlineEditingState; actions: InlineEditingActions } {
  const { t } = useI18n()
  const { connections } = useConnectionStore()

  // ---- GraphQL mutations ----
  const [addRow] = useAddRowMutation()
  const [deleteRow] = useDeleteRowMutation()
  const [updateStorageUnit] = useUpdateStorageUnitMutation()

  // ---- Row editing state ----
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [deletingRowIndex, setDeletingRowIndex] = useState<number | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ---- New row state ----
  const [isAddingRow, setIsAddingRow] = useState(false)
  const [newRowData, setNewRowData] = useState<Record<string, any>>({})

  // ---- Row editing actions ----
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
      showAlert(t('common.alert.error'), t('sql.inline.primaryKeyNotFound'), 'error')
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
        showAlert(t('common.alert.error'), t('sql.inline.failedToUpdateRow', { error: errors[0].message }), 'error')
        return
      }

      if (result?.UpdateStorageUnit.Status) {
        showAlert(t('common.alert.success'), t('sql.inline.rowUpdated'), 'success')
        handleCancelEdit()
        refresh()
      } else {
        showAlert(t('common.alert.error'), t('sql.inline.failedToUpdateRowGeneric'), 'error')
      }
    } catch (error: any) {
      showAlert(t('common.alert.error'), t('sql.inline.errorUpdatingRow', { error: error.message }), 'error')
    }
  }, [primaryKey, connections, connectionId, editingRowIndex, data, editValues, databaseName, schema, tableName, updateStorageUnit, showAlert, handleCancelEdit, refresh, t])

  // ---- Delete actions ----
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
        showAlert(t('common.alert.error'), t('sql.inline.failedToDeleteRow', { error: errors[0].message }), 'error')
        return
      }

      if (result?.DeleteRow.Status) {
        showAlert(t('common.alert.success'), t('sql.inline.rowDeleted'), 'success')
        refresh()
      } else {
        showAlert(t('common.alert.error'), t('sql.inline.failedToDeleteRowGeneric'), 'error')
      }
    } catch (error: any) {
      showAlert(t('common.alert.error'), t('sql.inline.errorDeletingRow', { error: error.message }), 'error')
    } finally {
      setDeletingRowIndex(null)
    }
  }, [deletingRowIndex, primaryKey, data, connections, connectionId, databaseName, schema, tableName, deleteRow, showAlert, refresh, t])

  // ---- Add row actions ----
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
        showAlert(t('common.alert.error'), t('sql.inline.invalidJsonDocument'), 'error')
        return
      }
    } else {
      // Standard relational mode
      if (Object.keys(newRowData).length === 0 || Object.values(newRowData).every((v) => !v)) {
        showAlert(t('common.alert.error'), t('sql.inline.enterAtLeastOneValue'), 'error')
        return
      }
      values = Object.entries(newRowData)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([key, value]) => ({ Key: key, Value: String(value) }))
    }

    if (values.length === 0) {
      showAlert(t('common.alert.error'), t('sql.inline.enterAtLeastOneValue'), 'error')
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
        showAlert(t('common.alert.error'), t('sql.inline.failedToAddRow', { error: errors[0].message }), 'error')
        return
      }

      if (result?.AddRow.Status) {
        showAlert(t('common.alert.success'), t('sql.inline.rowAdded'), 'success')
        handleCancelAdd()
        refresh()
      } else {
        showAlert(t('common.alert.error'), t('sql.inline.failedToAddRowGeneric'), 'error')
      }
    } catch (error: any) {
      showAlert(t('common.alert.error'), t('sql.inline.errorAddingRow', { error: error.message }), 'error')
    }
  }, [connections, connectionId, databaseName, schema, data, newRowData, tableName, addRow, showAlert, handleCancelAdd, refresh, t])

  /** Reset editing/adding state (e.g. on table switch). */
  const resetEditing = useCallback(() => {
    setEditingRowIndex(null)
    setSelectedRowIndex(null)
    setIsAddingRow(false)
  }, [])

  const state: InlineEditingState = {
    editingRowIndex,
    editValues,
    selectedRowIndex,
    isAddingRow,
    newRowData,
    deletingRowIndex,
    showDeleteModal,
  }

  const actions: InlineEditingActions = {
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
    setSelectedRowIndex,
    setShowDeleteModal,
    resetEditing,
  }

  return { state, actions }
}
