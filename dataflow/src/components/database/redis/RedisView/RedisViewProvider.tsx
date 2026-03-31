import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
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
import type { RedisKey, RedisViewContextValue } from './types'
import type { Alert } from '@/components/database/shared/types'
import type { RedisKeyDraft } from '@/components/database/redis/redis-key.types'

const RedisViewCtx = createContext<RedisViewContextValue | null>(null)

/** Hook to access RedisView context. Throws if used outside RedisViewProvider. */
export function useRedisView(): RedisViewContextValue {
  const ctx = use(RedisViewCtx)
  if (!ctx) throw new Error('useRedisView must be used within RedisViewProvider')
  return ctx
}

/** Build fields for AddStorageUnit (create). Redis plugin reads type from fields[0].Extra["type"]. */
function buildRedisFields(draft: RedisKeyDraft): RecordInput[] {
  const fields: RecordInput[] = []
  switch (draft.type) {
    case 'string':
      fields.push({ Key: 'value', Value: draft.stringValue })
      break
    case 'hash':
      for (const item of draft.hashPairs) {
        if (!item.field) continue
        fields.push({ Key: item.field, Value: item.value })
      }
      break
    case 'list':
      for (const item of draft.listItems) {
        if (!item.value) continue
        fields.push({ Key: 'value', Value: item.value })
      }
      break
    case 'set':
      for (const item of draft.setItems) {
        if (!item.value) continue
        fields.push({ Key: 'value', Value: item.value })
      }
      break
    case 'zset':
      for (const item of draft.zsetItems) {
        if (!item.member) continue
        fields.push({ Key: item.score, Value: item.member })
      }
      break
  }
  // Signal key type to Redis plugin via Extra on first field
  if (fields.length > 0) {
    fields[0] = { ...fields[0], Extra: [{ Key: 'type', Value: draft.type }] }
  }
  return fields
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
  const { connections } = useConnectionStore()

  // ---- GraphQL hooks ----
  const [getStorageUnits] = useGetStorageUnitsLazyQuery({ fetchPolicy: 'no-cache' })
  const [getRows] = useGetStorageUnitRowsLazyQuery({ fetchPolicy: 'no-cache' })
  const [addStorageUnitMutation] = useAddStorageUnitMutation()
  const [deleteRowMutation] = useDeleteRowMutation()
  const [updateStorageUnitMutation] = useUpdateStorageUnitMutation()

  // ---- Core state ----
  const [keys, setKeys] = useState<RedisKey[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

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
      let redisKeys: RedisKey[] = units.map(unit => {
        const typeAttr = unit.Attributes.find(a => a.Key === 'Type')
        const sizeAttr = unit.Attributes.find(a => a.Key === 'Size')
        return {
          key: unit.Name,
          type: typeAttr?.Value ?? 'unknown',
          size: sizeAttr?.Value ?? '0',
        }
      })

      // Client-side pattern filtering
      if (pattern !== '*') {
        const regexStr = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
        const regex = new RegExp(`^${regexStr}$`, 'i')
        redisKeys = redisKeys.filter(k => regex.test(k.key))
      }

      // Client-side type filtering
      if (filterTypes.length > 0) {
        redisKeys = redisKeys.filter(k => filterTypes.includes(k.type))
      }

      // Client-side pagination
      setTotal(redisKeys.length)
      const start = (currentPage - 1) * pageSize
      const paged = redisKeys.slice(start, start + pageSize)
      setKeys(paged)
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch Redis keys', 'error')
    } finally {
      setLoading(false)
    }
  }, [connections, connectionId, databaseName, currentPage, pageSize, pattern, filterTypes, getStorageUnits, showAlert])

  useEffect(() => {
    refresh()
  }, [refresh])

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
      showAlert('Unsupported edit mode', 'Editing is currently supported only for string keys.', 'info')
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
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch key details', 'error')
    } finally {
      setLoading(false)
    }
  }, [connections, connectionId, databaseName, getRows, showAlert])

  const handleSaveKey = useCallback(async (draft: RedisKeyDraft) => {
    const conn = connections.find(c => c.id === connectionId)
    if (!conn) throw new Error('Connection not found')

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName)

    try {
      if (draft.mode === 'edit') {
        if (draft.type !== 'string') {
          throw new Error('Editing is currently supported only for string keys')
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
        if (!data?.UpdateStorageUnit.Status) throw new Error('Failed to save key')
      } else {
        const fields = buildRedisFields(draft)
        const { errors, data } = await addStorageUnitMutation({
          variables: { schema: graphqlSchema, storageUnit: draft.key, fields },
          context: { database: databaseName },
        })
        if (errors?.length) throw new Error(errors[0].message)
        if (!data?.AddStorageUnit.Status) throw new Error('Failed to create key')
      }

      showAlert('Success', `Key "${draft.key}" ${draft.mode === 'edit' ? 'updated' : 'created'} successfully!`, 'success')

      setEditingKey(undefined)
      setIsAddModalOpen(false)
      await refresh()
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to save key')
    }
  }, [connections, connectionId, databaseName, addStorageUnitMutation, refresh, showAlert, updateStorageUnitMutation])

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
      showAlert('Success', `Key "${deletingKey.key}" deleted successfully!`, 'success')
      setDeletingKey(undefined)
      refresh()
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to delete key', 'error')
    }
  }, [deletingKey, connections, connectionId, databaseName, deleteRowMutation, refresh, showAlert])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  // ---- Derived values ----
  const totalPages = Math.ceil(total / pageSize)

  const state = {
    keys,
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
