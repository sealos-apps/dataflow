import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
  useGetStorageUnitRowsLazyQuery,
  useAddRowMutation,
  useDeleteRowMutation,
  useUpdateStorageUnitMutation,
  WhereConditionType,
  type WhereCondition,
} from '@graphql'
import { resolveSchemaParam } from '@/utils/database-features'
import type { CollectionViewContextValue } from './types'
import type { AlertState } from '@/components/database/shared/types'

const CollectionViewCtx = createContext<CollectionViewContextValue | null>(null)

/** Hook to access CollectionView context. Throws if used outside CollectionViewProvider. */
export function useCollectionView(): CollectionViewContextValue {
  const ctx = use(CollectionViewCtx)
  if (!ctx) throw new Error('useCollectionView must be used within CollectionViewProvider')
  return ctx
}

interface CollectionViewProviderProps {
  connectionId: string
  databaseName: string
  collectionName: string
  refreshTrigger?: number
  children: ReactNode
}

/** Provider that owns all CollectionDetailView state, GraphQL operations, and handlers. */
export function CollectionViewProvider({ connectionId, databaseName, collectionName, refreshTrigger, children }: CollectionViewProviderProps) {
  const { connections } = useConnectionStore()

  // ---- GraphQL hooks ----
  const [getRows] = useGetStorageUnitRowsLazyQuery({ fetchPolicy: 'no-cache' })
  const [addRowMutation] = useAddRowMutation()
  const [deleteRowMutation] = useDeleteRowMutation()
  const [updateStorageUnitMutation] = useUpdateStorageUnitMutation()

  // ---- Core state ----
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // ---- Document editing state ----
  const [editingDoc, setEditingDoc] = useState<any>(null)
  const [editContent, setEditContent] = useState('')
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ---- Add document state ----
  const [showAddModal, setShowAddModal] = useState(false)
  const [addContent, setAddContent] = useState('{\n  \n}')

  // ---- Export state ----
  const [showExportModal, setShowExportModal] = useState(false)

  // ---- Filter state ----
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [activeFilter, setActiveFilter] = useState<any>({})
  const [availableFields, setAvailableFields] = useState<string[]>([])

  // ---- Alert state ----
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })

  // ---- Alert helpers ----
  const showAlert = useCallback((title: string, message: string, type: AlertState['type'] = 'info') => {
    setAlertState({ isOpen: true, title, message, type })
  }, [])

  const closeAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, isOpen: false }))
  }, [])

  // ---- Extract available fields from documents ----
  useEffect(() => {
    if (documents.length > 0) {
      const keys = new Set<string>()
      documents.slice(0, 50).forEach(doc => {
        if (typeof doc === 'object' && doc !== null) {
          Object.keys(doc).forEach(k => keys.add(k))
        }
      })
      setAvailableFields(Array.from(keys).sort())
    }
  }, [documents])

  // ---- Reset to page 1 when search term changes ----
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // ---- Main data fetch ----
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      setEditingDoc(null)
      setSelectedDocIndex(null)

      const conn = connections.find(c => c.id === connectionId)
      if (!conn) {
        setError('Connection not found')
        setLoading(false)
        return
      }

      const graphqlSchema = resolveSchemaParam(conn.type, databaseName)

      // Build WhereCondition from activeFilter
      // FilterCollectionModal outputs MongoDB-native format:
      //   $eq:    { field: value }
      //   $regex: { field: { $regex: "...", $options: "i" } }
      //   others: { field: { $gt: value } }
      const filterConditions: WhereCondition[] = []
      for (const [fieldName, cond] of Object.entries(activeFilter)) {
        if (cond === undefined || cond === null) continue
        if (typeof cond !== 'object' || Array.isArray(cond)) {
          // Primitive value -> $eq
          filterConditions.push({
            Type: WhereConditionType.Atomic,
            Atomic: { Key: fieldName, Operator: 'eq', Value: String(cond), ColumnType: 'string' },
          })
        } else {
          // Object with MongoDB operators: { $regex: "...", $options: "..." } or { $gt: value }
          for (const [op, val] of Object.entries(cond as Record<string, any>)) {
            if (op === '$options') continue // Skip $options (handled with $regex)
            const operator = op.replace('$', '')
            const value = Array.isArray(val) ? val.join(', ') : String(val ?? '')
            filterConditions.push({
              Type: WhereConditionType.Atomic,
              Atomic: { Key: fieldName, Operator: operator, Value: value, ColumnType: 'string' },
            })
          }
        }
      }

      // Add search term as regex on 'document' column if present
      if (searchTerm.trim()) {
        filterConditions.push({
          Type: WhereConditionType.Atomic,
          Atomic: {
            Key: 'document',
            Operator: 'regex',
            Value: searchTerm.trim(),
            ColumnType: 'string',
          },
        })
      }

      let where: WhereCondition | undefined
      if (filterConditions.length === 1) {
        where = filterConditions[0]
      } else if (filterConditions.length > 1) {
        where = { Type: WhereConditionType.And, And: { Children: filterConditions } }
      }

      try {
        const { data: result, error: queryError } = await getRows({
          variables: {
            schema: graphqlSchema,
            storageUnit: collectionName,
            where,
            pageSize,
            pageOffset: (currentPage - 1) * pageSize,
          },
          context: { database: databaseName },
        })

        if (queryError) {
          setError(queryError.message)
          return
        }

        if (result?.Row) {
          const parsedDocs = result.Row.Rows.map(row => {
            try {
              return JSON.parse(row[0])
            } catch {
              return { _raw: row[0] }
            }
          })
          setDocuments(parsedDocs)
          setTotalDocuments(result.Row.TotalCount)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch collection data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [connectionId, databaseName, collectionName, connections, refreshTrigger, currentPage, pageSize, searchTerm, activeFilter, refreshKey, getRows])

  // ---- Handlers ----
  const handleAddClick = useCallback(() => {
    if (documents.length > 0 && typeof documents[0] === 'object' && documents[0] !== null) {
      const template: Record<string, string> = {}
      Object.keys(documents[0]).filter(k => k !== '_id').forEach(k => { template[k] = '' })
      setAddContent(JSON.stringify(template, null, 2))
    } else {
      setAddContent('{\n  \n}')
    }
    setShowAddModal(true)
  }, [documents])

  const handleAddSave = useCallback(async () => {
    try {
      const newDoc = JSON.parse(addContent)

      const conn = connections.find(c => c.id === connectionId)
      if (!conn) return

      const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
      const values = Object.entries(newDoc).map(([key, value]) => ({
        Key: key,
        Value: typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value ?? ''),
      }))

      if (values.length === 0) {
        showAlert('Error', 'Document must have at least one field', 'error')
        return
      }

      const { data: result, errors } = await addRowMutation({
        variables: {
          schema: graphqlSchema,
          storageUnit: collectionName,
          values,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert('Error', `Failed to add document: ${errors[0].message}`, 'error')
        return
      }

      if (result?.AddRow.Status) {
        showAlert('Success', 'Document added successfully!', 'success')
        setShowAddModal(false)
        setRefreshKey(prev => prev + 1)
      } else {
        showAlert('Error', 'Failed to add document', 'error')
      }
    } catch (e: any) {
      showAlert('Error', `Invalid JSON or add error: ${e.message}`, 'error')
    }
  }, [addContent, connections, connectionId, databaseName, collectionName, addRowMutation, showAlert])

  const handleEditClick = useCallback((doc: any) => {
    setEditingDoc(doc)
    setEditContent(JSON.stringify(doc, null, 2))
  }, [])

  const handleSave = useCallback(async () => {
    if (!editingDoc) return

    try {
      const updatedDoc = JSON.parse(editContent)
      const docId = editingDoc._id

      const conn = connections.find(c => c.id === connectionId)
      if (!conn) return

      const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
      const values = [{ Key: 'document', Value: JSON.stringify({ ...updatedDoc, _id: docId }) }]
      const updatedColumns = Object.keys(updatedDoc).filter(k => k !== '_id')

      const { data: result, errors } = await updateStorageUnitMutation({
        variables: {
          schema: graphqlSchema,
          storageUnit: collectionName,
          values,
          updatedColumns,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert('Error', `Failed to update document: ${errors[0].message}`, 'error')
        return
      }

      if (result?.UpdateStorageUnit.Status) {
        showAlert('Success', 'Document updated successfully!', 'success')
        setEditingDoc(null)
        setRefreshKey(prev => prev + 1)
      } else {
        showAlert('Error', 'Failed to update document', 'error')
      }
    } catch (e: any) {
      showAlert('Error', `Invalid JSON or update error: ${e.message}`, 'error')
    }
  }, [editingDoc, editContent, connections, connectionId, databaseName, collectionName, updateStorageUnitMutation, showAlert])

  const handleDeleteClick = useCallback((docId: string) => {
    setDeletingDocId(docId)
    setShowDeleteModal(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingDocId) return

    const conn = connections.find(c => c.id === connectionId)
    if (!conn) return

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
    const values = [{ Key: 'document', Value: JSON.stringify({ _id: deletingDocId }) }]

    try {
      const { data: result, errors } = await deleteRowMutation({
        variables: {
          schema: graphqlSchema,
          storageUnit: collectionName,
          values,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert('Error', `Failed to delete document: ${errors[0].message}`, 'error')
        return
      }

      if (result?.DeleteRow.Status) {
        showAlert('Success', 'Document deleted successfully!', 'success')
        setRefreshKey(prev => prev + 1)
      } else {
        showAlert('Error', 'Failed to delete document', 'error')
      }
    } catch (e: any) {
      showAlert('Error', `Delete error: ${e.message}`, 'error')
    } finally {
      setDeletingDocId(null)
      setShowDeleteModal(false)
    }
  }, [deletingDocId, connections, connectionId, databaseName, collectionName, deleteRowMutation, showAlert])

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
  const handleFilterApply = useCallback((filter: any) => {
    setActiveFilter(filter)
    setCurrentPage(1)
  }, [])

  // ---- Refresh ----
  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  // ---- Derived values ----
  const totalPages = Math.ceil(totalDocuments / pageSize)

  const state = {
    loading,
    documents,
    error,
    currentPage,
    pageSize,
    totalDocuments,
    totalPages,
    searchTerm,
    activeFilter,
    availableFields,
    selectedDocIndex,
    showAddModal,
    showExportModal,
    showFilterModal,
    showDeleteModal,
    editingDoc,
    editContent,
    addContent,
    deletingDocId,
    alertState,
  }

  const actions = {
    refresh,
    handlePageChange,
    handlePageSizeChange,
    setSearchTerm,
    handleAddClick,
    setShowAddModal,
    setAddContent,
    handleAddSave,
    handleEditClick,
    setEditingDoc,
    setEditContent,
    handleSave,
    handleDeleteClick,
    handleConfirmDelete,
    setShowDeleteModal,
    setShowFilterModal,
    handleFilterApply,
    setShowExportModal,
    setSelectedDocIndex,
    showAlert,
    closeAlert,
  }

  return <CollectionViewCtx value={{ state, actions }}>{children}</CollectionViewCtx>
}
