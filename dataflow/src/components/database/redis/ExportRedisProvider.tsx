import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApolloClient } from '@apollo/client'
import { Download, FileJson, FileText } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { GetStorageUnitRowsDocument, type GetStorageUnitRowsQuery, type GetStorageUnitRowsQueryVariables } from '@graphql'
import { resolveSchemaParam } from '@/utils/database-features'
import { downloadBlob, toCSV } from '@/utils/export-utils'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import type { FormatOption } from '@/components/database/shared/FormatSelector'
import type { RedisKey } from './RedisView/types'
import {
  REDIS_EXPORT_COLUMNS,
  buildRedisExportRecords,
  recordsToRedisExportNdjson,
  recordsToRedisExportRows,
} from './redis-export.utils'

type RedisExportFormat = 'json' | 'csv'

const REDIS_EXPORT_FORMATS: FormatOption<RedisExportFormat>[] = [
  { id: 'json', label: 'JSON', icon: FileJson },
  { id: 'csv', label: 'CSV', icon: FileText },
]

interface ExportRedisCtxValue {
  format: RedisExportFormat
  setFormat: (value: RedisExportFormat) => void
  isSuccess: boolean
  statusText: string
  patternSummary: string
  typesSummary: string
  formatOptions: FormatOption<RedisExportFormat>[]
  handleExport: () => void
}

const ExportRedisCtx = createContext<ExportRedisCtxValue | null>(null)

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

/** Accessor for Redis export modal domain state. Throws outside the provider. */
export function useExportRedisCtx(): ExportRedisCtxValue {
  const ctx = use(ExportRedisCtx)
  if (!ctx) throw new Error('useExportRedisCtx must be used within ExportRedisProvider')
  return ctx
}

interface ExportRedisProviderProps {
  open: boolean
  connectionId: string
  databaseName: string
  keys: RedisKey[]
  initialPattern?: string
  initialTypes?: string[]
  children: ReactNode
}

/** Wraps ModalForm.Provider (complex mode, no onSubmit) and domain context for Redis export. */
export function ExportRedisProvider({
  open,
  connectionId,
  databaseName,
  keys,
  initialPattern = '*',
  initialTypes = [],
  children,
}: ExportRedisProviderProps) {
  const { t } = useI18n()
  return (
    <ModalForm.Provider
      meta={{
        title: t('redis.export.title'),
        description: databaseName,
        icon: Download,
      }}
    >
      <ExportRedisBridge
        open={open}
        connectionId={connectionId}
        databaseName={databaseName}
        keys={keys}
        initialPattern={initialPattern}
        initialTypes={initialTypes}
      >
        {children}
      </ExportRedisBridge>
    </ModalForm.Provider>
  )
}

/** Inner bridge that owns domain state and export logic, accessing ModalForm actions via useModalForm(). */
function ExportRedisBridge({
  open,
  connectionId,
  databaseName,
  keys,
  initialPattern,
  initialTypes,
  children,
}: {
  open: boolean
  connectionId: string
  databaseName: string
  keys: RedisKey[]
  initialPattern: string
  initialTypes: string[]
  children: ReactNode
}) {
  const client = useApolloClient()
  const { connections } = useConnectionStore()
  const { t } = useI18n()
  const [format, setFormat] = useState<RedisExportFormat>('json')
  const [isSuccess, setIsSuccess] = useState(false)
  const [statusText, setStatusText] = useState('')
  const { actions } = useModalForm()

  const patternSummary = useMemo(() => initialPattern || '*', [initialPattern])
  const typesSummary = useMemo(
    () => (initialTypes.length > 0 ? initialTypes.join(', ') : t('redis.export.allTypes')),
    [initialTypes, t],
  )

  useEffect(() => {
    if (!open) return
    setFormat('json')
    setIsSuccess(false)
    setStatusText('')
    actions.reset()
  }, [open, actions])

  const handleExport = useCallback(async () => {
    actions.setSubmitting(true)
    actions.closeAlert()
    setIsSuccess(false)
    setStatusText(t('redis.export.starting'))

    try {
      const connection = connections.find((item) => item.id === connectionId)
      if (!connection) throw new Error(t('redis.error.connectionNotFound'))
      if (keys.length === 0) throw new Error(t('redis.table.emptyState'))

      const graphqlSchema = resolveSchemaParam(connection.type, databaseName)
      const keyDetails = []

      for (const redisKey of keys) {
        const pageSize = redisKey.type === 'string'
          ? 1
          : Math.max(Number.parseInt(redisKey.size, 10) || 1, 1)

        const { data, error } = await client.query<GetStorageUnitRowsQuery, GetStorageUnitRowsQueryVariables>({
          query: GetStorageUnitRowsDocument,
          variables: {
            schema: graphqlSchema,
            storageUnit: redisKey.key,
            pageSize,
            pageOffset: 0,
          },
          context: { database: databaseName },
          fetchPolicy: 'no-cache',
        })

        if (error) {
          throw new Error(`${redisKey.key}: ${error.message}`)
        }
        if (!data?.Row) {
          throw new Error(`${redisKey.key}: ${t('redis.alert.fetchKeyDetailsFailed')}`)
        }

        keyDetails.push({
          redisKey,
          columns: data.Row.Columns,
          rows: data.Row.Rows,
        })
      }

      const records = buildRedisExportRecords(keyDetails)
      const blob = format === 'json'
        ? new Blob([recordsToRedisExportNdjson(records)], { type: 'application/x-ndjson;charset=utf-8' })
        : toCSV(REDIS_EXPORT_COLUMNS, recordsToRedisExportRows(records))
      const filename = `redis_export_${databaseName}.${format === 'json' ? 'ndjson' : 'csv'}`

      downloadBlob(blob, filename)
      setStatusText(t('common.status.exportComplete'))
      setIsSuccess(true)
    } catch (error) {
      const rawError = getErrorMessage(error)
      actions.setAlert({
        type: 'error',
        title: t('redis.export.failed'),
        message: rawError
          ? t('redis.export.failedWithError', { error: rawError })
          : t('redis.error.unknown'),
      })
      setStatusText('')
    } finally {
      actions.setSubmitting(false)
    }
  }, [actions, client, connectionId, connections, databaseName, format, keys, t])

  return (
    <ExportRedisCtx
      value={{
        format,
        setFormat,
        isSuccess,
        statusText,
        patternSummary,
        typesSummary,
        formatOptions: REDIS_EXPORT_FORMATS,
        handleExport,
      }}
    >
      {children}
    </ExportRedisCtx>
  )
}
