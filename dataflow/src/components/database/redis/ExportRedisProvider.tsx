import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Download, FileJson, FileText } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { addAuthHeader } from '@/config/auth-headers'
import { resolveSchemaParam } from '@/utils/database-features'
import { downloadBlob } from '@/utils/export-utils'
import { ModalForm } from '@/components/database/modals/ModalForm'
import { useModalState } from '@/components/database/modals/useModalState'
import type { FormatOption } from '@/components/database/modals/FormatSelector'

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
}

const ExportRedisCtx = createContext<ExportRedisCtxValue | null>(null)

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

/** Owns Redis export state and keeps export filter controls read-only until backend support exists. */
export function ExportRedisProvider({
  open,
  connectionId,
  databaseName,
  initialPattern = '*',
  initialTypes = [],
  children,
}: ExportRedisProviderProps) {
  const { connections } = useConnectionStore()
  const [format, setFormat] = useState<RedisExportFormat>('json')
  const [isSuccess, setIsSuccess] = useState(false)
  const [statusText, setStatusText] = useState('')
  const {
    state,
    actions: { closeAlert, reset, setAlert, setSubmitting },
  } = useModalState()

  const patternSummary = useMemo(() => initialPattern || '*', [initialPattern])
  const typesSummary = useMemo(
    () => (initialTypes.length > 0 ? initialTypes.join(', ') : 'All types'),
    [initialTypes],
  )

  useEffect(() => {
    if (!open) return
    setFormat('json')
    setIsSuccess(false)
    setStatusText('')
    reset()
  }, [open, reset])

  const submit = useCallback(async () => {
    setSubmitting(true)
    closeAlert()
    setIsSuccess(false)
    setStatusText('Starting Redis export...')

    try {
      const connection = connections.find((item) => item.id === connectionId)
      if (!connection) throw new Error('Connection not found')

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
        throw new Error(text || `Export failed with status ${response.status}`)
      }

      const disposition = response.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      const filename =
        filenameMatch?.[1] ??
        `redis_export_${databaseName}.${format === 'json' ? 'ndjson' : 'csv'}`

      const blob = await response.blob()
      downloadBlob(blob, filename)
      setStatusText('Export complete! File downloaded.')
      setIsSuccess(true)
    } catch (error) {
      setAlert({
        type: 'error',
        title: 'Export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
      setStatusText('')
    } finally {
      setSubmitting(false)
    }
  }, [closeAlert, connectionId, connections, databaseName, format, setAlert, setSubmitting])

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
      }}
    >
      <ModalForm.Provider
        state={state}
        actions={{
          closeAlert,
          reset,
          setAlert,
          setSubmitting,
          submit,
        }}
        meta={{
          title: 'Export Redis Data',
          description: databaseName,
          icon: Download,
        }}
      >
        {children}
      </ModalForm.Provider>
    </ExportRedisCtx>
  )
}
