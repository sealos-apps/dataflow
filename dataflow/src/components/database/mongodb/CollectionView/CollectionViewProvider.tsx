import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
  useGetStorageUnitRowsLazyQuery,
  WhereConditionType,
  type WhereCondition,
} from '@graphql'
import { resolveSchemaParam } from '@/utils/database-features'
import type { CollectionViewContextValue } from './types'
import type { Alert } from '@/components/database/shared/types'
import type { FlatMongoFilter } from '@/components/database/mongodb/filter-collection.types'
import { useDocumentEditing } from './useDocumentEditing'
import { useI18n } from '@/i18n/useI18n'

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
  children: ReactNode
}

/** Provider that owns all CollectionDetailView state, GraphQL operations, and handlers. */
export function CollectionViewProvider({ connectionId, databaseName, collectionName, children }: CollectionViewProviderProps) {
  const { t } = useI18n()
  const { connections, collectionRefreshKey } = useConnectionStore()

  // ---- GraphQL hooks ----
  const [getRows] = useGetStorageUnitRowsLazyQuery({ fetchPolicy: 'no-cache' })

  // ---- Core state ----
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // ---- Export state ----
  const [showExportModal, setShowExportModal] = useState(false)

  // ---- Filter state ----
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FlatMongoFilter>({})
  const [availableFields, setAvailableFields] = useState<string[]>([])

  // ---- Alert state ----
  const [alert, setAlert] = useState<Alert | null>(null)

  // ---- Alert helpers ----
  const showAlert = useCallback((title: string, message: string, type: Alert['type'] = 'info') => {
    setAlert({ title, message, type })
  }, [])

  const closeAlert = useCallback(() => setAlert(null), [])

  // ---- Refresh ----
  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  // ---- Document editing (add / edit / delete) ----
  const { state: editingState, actions: editingActions } = useDocumentEditing({
    connectionId,
    databaseName,
    collectionName,
    documents,
    refresh,
    showAlert,
  })

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
      editingActions.setEditingDoc(null)
      editingActions.setSelectedDocIndex(null)

      const conn = connections.find(c => c.id === connectionId)
      if (!conn) {
        setError(t('common.error.connectionNotFound'))
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
      for (const [fieldName, condition] of Object.entries(activeFilter)) {
        if (condition === undefined || condition === null) continue
        if (typeof condition !== 'object' || Array.isArray(condition)) {
          // Primitive value -> $eq
          filterConditions.push({
            Type: WhereConditionType.Atomic,
            Atomic: { Key: fieldName, Operator: 'eq', Value: String(condition), ColumnType: 'string' },
          })
        } else {
          // Object with MongoDB operators: { $regex: "...", $options: "..." } or { $gt: value }
          for (const [op, val] of Object.entries(condition as Record<string, unknown>)) {
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
          setTotal(result.Row.TotalCount)
        }
      } catch (err: any) {
        setError(err.message || t('mongodb.error.fetchCollectionData'))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [connectionId, databaseName, collectionName, connections, collectionRefreshKey, currentPage, pageSize, searchTerm, activeFilter, refreshKey, getRows, t])

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
  const handleFilterApply = useCallback((filter: FlatMongoFilter) => {
    setActiveFilter(filter)
    setCurrentPage(1)
  }, [])

  // ---- Derived values ----
  const totalPages = Math.ceil(total / pageSize)

  const state: CollectionViewContextValue['state'] = {
    loading,
    documents,
    error,
    currentPage,
    pageSize,
    total,
    totalPages,
    searchTerm,
    activeFilter,
    availableFields,
    showExportModal,
    isFilterModalOpen,
    alert,
    ...editingState,
  }

  const actions: CollectionViewContextValue['actions'] = {
    refresh,
    handlePageChange,
    handlePageSizeChange,
    setSearchTerm,
    setIsFilterModalOpen,
    handleFilterApply,
    setShowExportModal,
    showAlert,
    closeAlert,
    ...editingActions,
  }

  return <CollectionViewCtx value={{ state, actions }}>{children}</CollectionViewCtx>
}
