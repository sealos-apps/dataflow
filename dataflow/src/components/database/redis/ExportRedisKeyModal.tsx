import { createContext, use, useCallback, useState, type ReactNode } from 'react'
import { Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react'
import { useGetStorageUnitRowsLazyQuery } from '@graphql'
import { toCSV, toJSON, toExcel, downloadBlob } from '@/utils/export-utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { FormatSelector, type FormatOption } from '@/components/database/shared/FormatSelector'
import { ExportProgress, ExportFooter } from '@/components/database/shared/ExportProgress'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { resolveSchemaParam } from '@/utils/database-features'
import { useI18n } from '@/i18n/useI18n'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ExportFormat = 'csv' | 'json' | 'excel'

const FORMAT_OPTIONS: FormatOption<ExportFormat>[] = [
  { id: 'csv', label: 'CSV', icon: FileText },
  { id: 'json', label: 'JSON', icon: FileJson },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
]

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  excel: 'xlsx',
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ExportRedisKeyCtxValue {
  format: ExportFormat
  setFormat: (v: ExportFormat) => void
  rowLimit: number | ''
  setRowLimit: (v: number | '') => void
  isSuccess: boolean
  handleExport: () => void
}

const ExportRedisKeyCtx = createContext<ExportRedisKeyCtxValue | null>(null)

function useExportRedisKeyCtx(): ExportRedisKeyCtxValue {
  const ctx = use(ExportRedisKeyCtx)
  if (!ctx) throw new Error('useExportRedisKeyCtx must be used within ExportRedisKeyProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function ExportRedisKeyProvider({
  connectionId,
  databaseName,
  keyName,
  children,
}: {
  connectionId: string
  databaseName: string
  keyName: string
  children: ReactNode
}) {
  const { t } = useI18n()

  return (
    <ModalForm.Provider meta={{ title: t('redis.export.title'), icon: Download }}>
      <ExportRedisKeyBridge connectionId={connectionId} databaseName={databaseName} keyName={keyName}>
        {children}
      </ExportRedisKeyBridge>
    </ModalForm.Provider>
  )
}

function ExportRedisKeyBridge({
  connectionId,
  databaseName,
  keyName,
  children,
}: {
  connectionId: string
  databaseName: string
  keyName: string
  children: ReactNode
}) {
  const { t } = useI18n()
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [rowLimit, setRowLimit] = useState<number | ''>('')
  const [isSuccess, setIsSuccess] = useState(false)
  const { actions } = useModalForm()
  const [getRows] = useGetStorageUnitRowsLazyQuery({ fetchPolicy: 'no-cache' })
  const connections = useConnectionStore((s) => s.connections)

  const handleExport = useCallback(async () => {
    actions.setSubmitting(true)
    actions.closeAlert()
    setIsSuccess(false)

    try {
      const conn = connections.find((c) => c.id === connectionId)
      if (!conn) throw new Error('Connection not found')

      const schema = resolveSchemaParam(conn.type, databaseName)
      const pageSize = rowLimit === '' ? 100_000 : rowLimit

      const { data: result, error: gqlError } = await getRows({
        variables: { schema, storageUnit: keyName, pageSize, pageOffset: 0 },
        context: { database: databaseName },
      })

      if (gqlError) throw new Error(gqlError.message)

      const columns = result?.Row?.Columns
      const rows = result?.Row?.Rows
      if (!columns?.length || !rows?.length) {
        actions.setAlert({ type: 'error', title: t('redis.export.failed'), message: t('redis.export.noData') })
        return
      }

      let blob: Blob
      switch (format) {
        case 'csv':   blob = toCSV(columns, rows); break
        case 'json':  blob = toJSON(columns, rows); break
        case 'excel': blob = toExcel(keyName, columns, rows); break
      }

      downloadBlob(blob, `${keyName}.${FORMAT_EXTENSIONS[format]}`)
      setIsSuccess(true)
    } catch (err: any) {
      actions.setAlert({
        type: 'error',
        title: t('redis.export.failed'),
        message: err.message || String(err),
      })
    } finally {
      actions.setSubmitting(false)
    }
  }, [actions, connectionId, connections, databaseName, format, getRows, keyName, rowLimit, t])

  return (
    <ExportRedisKeyCtx value={{ format, setFormat, rowLimit, setRowLimit, isSuccess, handleExport }}>
      {children}
    </ExportRedisKeyCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ExportRedisKeyFields() {
  const { t } = useI18n()
  const { format, setFormat, rowLimit, setRowLimit, isSuccess } = useExportRedisKeyCtx()
  const { state } = useModalForm()
  const disabled = state.isSubmitting || isSuccess

  return (
    <div className="flex flex-col gap-4">
      <FormatSelector options={FORMAT_OPTIONS} value={format} onChange={setFormat} disabled={disabled} />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">{t('redis.export.rowLimit')}</label>
        <Input
          type="number"
          min={1}
          value={rowLimit}
          onChange={(e) => setRowLimit(e.target.value === '' ? '' : parseInt(e.target.value))}
          placeholder={t('redis.export.rowLimitPlaceholder')}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">{t('redis.export.rowLimitHint')}</p>
      </div>

      <ExportProgress isExporting={state.isSubmitting} isSuccess={isSuccess} />
    </div>
  )
}

function ExportRedisKeyFooterBridge() {
  const { isSuccess, handleExport } = useExportRedisKeyCtx()
  return <ExportFooter isSuccess={isSuccess} onClick={handleExport} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface ExportRedisKeyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  databaseName: string
  keyName: string
}

export function ExportRedisKeyModal({
  open,
  onOpenChange,
  connectionId,
  databaseName,
  keyName,
}: ExportRedisKeyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <ExportRedisKeyProvider connectionId={connectionId} databaseName={databaseName} keyName={keyName}>
          <ModalForm.Header />
          <ExportRedisKeyFields />
          <ModalForm.Alert />
          <ExportRedisKeyFooterBridge />
        </ExportRedisKeyProvider>
      </DialogContent>
    </Dialog>
  )
}
