import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Download, FileJson, FileText } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { addAuthHeader } from '@/config/auth-headers'
import { resolveSchemaParam } from '@/utils/database-features'
import { downloadBlob } from '@/utils/export-utils'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import type { FormatOption } from '@/components/database/shared/FormatSelector'

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
  initialPattern?: string
  initialTypes?: string[]
  children: ReactNode
}

/** Wraps ModalForm.Provider (complex mode, no onSubmit) and domain context for Redis export. */
export function ExportRedisProvider({
  open,
  connectionId,
  databaseName,
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
  initialPattern,
  initialTypes,
  children,
}: {
  open: boolean
  connectionId: string
  databaseName: string
  initialPattern: string
  initialTypes: string[]
  children: ReactNode
}) {
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

      const graphqlSchema = resolveSchemaParam(connection.type, databaseName)
      const backendFormat = format === 'json' ? 'ndjson' : 'csv'

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...addAuthHeader({}, databaseName),
        },
        body: JSON.stringify({
          schema: graphqlSchema,
          storageUnit: '',
          format: backendFormat,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        if (text.trim().length > 0) {
          throw new Error(text)
        }
        throw new Error(t('redis.export.failedWithStatus', { status: response.status }))
      }

      const disposition = response.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      const filename =
        filenameMatch?.[1] ??
        `redis_export_${databaseName}.${format === 'json' ? 'ndjson' : 'csv'}`

      const blob = await response.blob()
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
  }, [actions, connectionId, connections, databaseName, format, t])

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
