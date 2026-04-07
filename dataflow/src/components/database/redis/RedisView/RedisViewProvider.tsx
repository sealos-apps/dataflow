import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
  useGetStorageUnitsLazyQuery,
  useGetStorageUnitRowsLazyQuery,
  useAddStorageUnitMutation,
  useDeleteRowMutation,
  useUpdateStorageUnitMutation,
  type RecordInput,
} from '@graphql'
import { resolveSchemaParam } from '@/utils/database-features'
import { useI18n } from '@/i18n/useI18n'
import type { RedisKey, RedisViewContextValue } from './types'
import type { Alert } from '@/components/database/shared/types'
import type { RedisKeyDraft } from '@/components/database/redis/redis-key.types'
import { buildRedisFields } from '@/components/database/redis/redis-key.utils'
import { applyRedisFilters, paginateRedisKeys } from './redis-view.utils'

const RedisViewCtx = createContext<RedisViewContextValue | null>(null)

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    const message = error.message.trim()
    return message.length > 0 ? message : undefined
  }

  if (typeof error === 'string') {
    const message = error.trim()
    return message.length > 0 ? message : undefined
  }

  return undefined
}

/** Hook to access RedisView context. Throws if used outside RedisViewProvider. */
export function useRedisView(): RedisViewContextValue {
  const ctx = use(RedisViewCtx)
  if (!ctx) throw new Error('useRedisView must be used within RedisViewProvider')
  return ctx
}

/** Transform GraphQL rows for a Redis string key into the normalized edit draft state. */
function transformRedisRowsToStringKeyData(keyName: string, rowResult: any): RedisKeyDraft {
  const columns = rowResult.Columns.map((c: any) => c.Name)
  const valueIndex = columns.indexOf('value')
  const rows = rowResult.Rows

  return {
    mode: 'edit',
    key: keyName,
    type: 'string',
    stringValue: rows[0]?.[valueIndex >= 0 ? valueIndex : 0] ?? '',
    hashPairs: [{ field: '', value: '' }],
    listItems: [{ value: '' }],
    setItems: [{ value: '' }],
    zsetItems: [{ member: '', score: '0' }],
  }
}

interface RedisViewProviderProps {
  connectionId: string
  databaseName: string
  children: ReactNode
}

/** Provider that owns all RedisDetailView state, GraphQL operations, and handlers. */
export function RedisViewProvider({ connectionId, databaseName, children }: RedisViewProviderProps) {
  const { t } = useI18n()
  const { connections } = useConnectionStore()

  // ---- GraphQL hooks ----
  const [getStorageUnits] = useGetStorageUnitsLazyQuery({ fetchPolicy: 'no-cache' })
  const [getRows] = useGetStorageUnitRowsLazyQuery({ fetchPolicy: 'no-cache' })
  const [addStorageUnitMutation] = useAddStorageUnitMutation()
  const [deleteRowMutation] = useDeleteRowMutation()
  const [updateStorageUnitMutation] = useUpdateStorageUnitMutation()

  // ---- Core state ----
  const [allKeys, setAllKeys] = useState<RedisKey[]>([])
  const [loading, setLoading] = useState(false)

  // ---- Filter state ----
  const [pattern, setPattern] = useState('*')
  const [filterTypes, setFilterTypes] = useState<string[]>([])

  // ---- Pagination state ----
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // ---- Modal state ----
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<RedisKeyDraft | undefined>(undefined)
  const [deletingKey, setDeletingKey] = useState<RedisKey | undefined>(undefined)
  const [showExportModal, setShowExportModal] = useState(false)

  // ---- Alert state ----
  const [alert, setAlert] = useState<Alert | null>(null)

  // ---- Alert helpers ----
  const showAlert = useCallback((title: string, message: string, type: Alert['type'] = 'info') => {
    setAlert({ title, message, type })
  }, [])

  const closeAlert = useCallback(() => setAlert(null), [])

  // ---- Fetch keys ----
  const refresh = useCallback(async () => {
    const conn = connections.find(c => c.id === connectionId)
    if (!conn) return

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
    setLoading(true)
    try {
      const { data, error } = await getStorageUnits({
        variables: { schema: graphqlSchema },
        context: { database: databaseName },
      })
      if (error) throw new Error(error.message)

      const units = data?.StorageUnit ?? []

      // Transform StorageUnit[] to RedisKey[]
      const redisKeys: RedisKey[] = units.map(unit => {
        const typeAttr = unit.Attributes.find(a => a.Key === 'Type')
        const sizeAttr = unit.Attributes.find(a => a.Key === 'Size')
        return {
          key: unit.Name,
          type: typeAttr?.Value ?? 'unknown',
          size: sizeAttr?.Value ?? '0',
        }
      })
      setAllKeys(redisKeys)
    } catch (error) {
      const rawError = getErrorMessage(error)
      showAlert(
        t('common.alert.error'),
        rawError
          ? t('redis.alert.fetchKeysFailedWithError', { error: rawError })
          : t('redis.alert.fetchKeysFailed'),
        'error',
      )
    } finally {
      setLoading(false)
    }
  }, [connections, connectionId, databaseName, getStorageUnits, showAlert, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filteredKeys = useMemo(
    () => applyRedisFilters(allKeys, pattern, filterTypes),
    [allKeys, pattern, filterTypes],
  )
  const total = filteredKeys.length
  const totalPages = Math.ceil(total / pageSize)
  const keys = useMemo(
    () => paginateRedisKeys(filteredKeys, currentPage, pageSize),
    [currentPage, filteredKeys, pageSize],
  )

  useEffect(() => {
    const nextPage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1
    if (currentPage !== nextPage) {
      setCurrentPage(nextPage)
    }
  }, [currentPage, totalPages])

  // ---- Handlers ----
  const handleApplyFilter = useCallback((newPattern: string, newTypes: string[]) => {
    setPattern(newPattern)
    setFilterTypes(newTypes)
    setCurrentPage(1)
  }, [])

  const openAddModal = useCallback(() => {
    setEditingKey(undefined)
    setIsAddModalOpen(true)
  }, [])

  const handleEditKey = useCallback(async (key: RedisKey) => {
    if (key.type !== 'string') {
      showAlert(t('common.alert.info'), t('redis.alert.unsupportedEditMode'), 'info')
      return
    }

    const conn = connections.find(c => c.id === connectionId)
    if (!conn) return
    const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
    try {
      setLoading(true)
      const { data, error } = await getRows({
        variables: {
          schema: graphqlSchema,
          storageUnit: key.key,
          pageSize: 1000,
          pageOffset: 0,
        },
        context: { database: databaseName },
      })
      if (error) throw new Error(error.message)
      if (data?.Row) {
        const keyData = transformRedisRowsToStringKeyData(key.key, data.Row)
        setEditingKey(keyData)
        setIsAddModalOpen(true)
      }
    } catch (error) {
      const rawError = getErrorMessage(error)
      showAlert(
        t('common.alert.error'),
        rawError
          ? t('redis.alert.fetchKeyDetailsFailedWithError', { error: rawError })
          : t('redis.alert.fetchKeyDetailsFailed'),
        'error',
      )
    } finally {
      setLoading(false)
    }
  }, [connections, connectionId, databaseName, getRows, showAlert, t])

  const handleSaveKey = useCallback(async (draft: RedisKeyDraft) => {
    const conn = connections.find(c => c.id === connectionId)
    if (!conn) throw new Error(t('common.error.connectionNotFound'))

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName)

    try {
      if (draft.mode === 'edit') {
        if (draft.type !== 'string') {
          throw new Error(t('redis.alert.unsupportedEditMode'))
        }

        const values: RecordInput[] = [{ Key: 'value', Value: draft.stringValue }]
        const { errors, data } = await updateStorageUnitMutation({
          variables: {
            schema: graphqlSchema,
            storageUnit: draft.key,
            values,
            updatedColumns: ['value'],
          },
          context: { database: databaseName },
        })
        if (errors?.length) throw new Error(errors[0].message)
        if (!data?.UpdateStorageUnit.Status) throw new Error(t('redis.alert.saveFailed'))
      } else {
        const fields = buildRedisFields(draft)
        const { errors, data } = await addStorageUnitMutation({
          variables: { schema: graphqlSchema, storageUnit: draft.key, fields },
          context: { database: databaseName },
        })
        if (errors?.length) throw new Error(errors[0].message)
        if (!data?.AddStorageUnit.Status) throw new Error(t('redis.alert.saveFailed'))
      }

      showAlert(
        t('common.alert.success'),
        draft.mode === 'edit'
          ? t('redis.alert.updateSuccess', { key: draft.key })
          : t('redis.alert.createSuccess', { key: draft.key }),
        'success',
      )

      setEditingKey(undefined)
      setIsAddModalOpen(false)
      await refresh()
    } catch (error) {
      const rawError = getErrorMessage(error)
      if (!rawError || rawError === t('redis.alert.saveFailed')) {
        throw new Error(t('redis.alert.saveFailed'))
      }
      throw new Error(t('redis.alert.saveFailedWithError', { error: rawError }))
    }
  }, [connections, connectionId, databaseName, addStorageUnitMutation, refresh, showAlert, t, updateStorageUnitMutation])

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingKey) return
    const conn = connections.find(c => c.id === connectionId)
    if (!conn) return
    const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
    try {
      const values = [{ Key: 'key', Value: deletingKey.key }]
      const { errors } = await deleteRowMutation({
        variables: { schema: graphqlSchema, storageUnit: deletingKey.key, values },
        context: { database: databaseName },
      })
      if (errors?.length) throw new Error(errors[0].message)
      showAlert(t('common.alert.success'), t('redis.alert.deleteSuccess', { key: deletingKey.key }), 'success')
      setDeletingKey(undefined)
      refresh()
    } catch (error) {
      const rawError = getErrorMessage(error)
      showAlert(
        t('common.alert.error'),
        rawError
          ? t('redis.alert.deleteFailedWithError', { error: rawError })
          : t('redis.alert.deleteFailed'),
        'error',
      )
    }
  }, [deletingKey, connections, connectionId, databaseName, deleteRowMutation, refresh, showAlert, t])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  const state = {
    keys,
    filteredKeys,
    loading,
    total,
    currentPage,
    pageSize,
    totalPages,
    pattern,
    filterTypes,
    isFilterModalOpen,
    isAddModalOpen,
    editingKey,
    deletingKey,
    showExportModal,
    alert,
  }

  const actions = {
    refresh,
    handlePageChange,
    handlePageSizeChange,
    handleApplyFilter,
    setIsFilterModalOpen,
    handleEditKey,
    handleSaveKey,
    handleConfirmDelete,
    openAddModal,
    setIsAddModalOpen,
    setEditingKey,
    setDeletingKey,
    setShowExportModal,
    closeAlert,
  }

  return <RedisViewCtx value={{ state, actions }}>{children}</RedisViewCtx>
}
