import { createContext, use, useCallback, useState, type ReactNode } from 'react'
import { FileJson, FileSpreadsheet, FileCode, FileText, Table2 } from 'lucide-react'
import { useRawExecuteLazyQuery } from '@/generated/graphql'
import { toCSV, toJSON, toSQL, toExcel, downloadBlob } from '@/utils/export-utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/database/modals/ModalForm'
import { FormatSelector, type FormatOption } from '@/components/database/modals/FormatSelector'
import { ExportProgress, ExportFooter } from '@/components/database/modals/ExportProgress'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ExportFormat = 'csv' | 'json' | 'sql' | 'excel'

const FORMAT_OPTIONS: FormatOption<ExportFormat>[] = [
  { id: 'csv', label: 'CSV', icon: FileText },
  { id: 'json', label: 'JSON', icon: FileJson },
  { id: 'sql', label: 'SQL', icon: FileCode },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
]

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  sql: 'sql',
  excel: 'xlsx',
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ExportDataCtxValue {
  format: ExportFormat
  setFormat: (v: ExportFormat) => void
  rowCount: number | ''
  setRowCount: (v: number | '') => void
  filter: string
  setFilter: (v: string) => void
  isSuccess: boolean
  handleExport: () => void
}

const ExportDataCtx = createContext<ExportDataCtxValue | null>(null)

/** Hook to access ExportDataModal domain state. Throws if used outside the provider. */
function useExportDataCtx(): ExportDataCtxValue {
  const ctx = use(ExportDataCtx)
  if (!ctx) throw new Error('useExportDataCtx must be used within ExportDataProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Wraps ModalForm.Provider (complex mode, no onSubmit) and domain context for SQL table export. */
function ExportDataProvider({
  databaseName,
  schema,
  tableName,
  children,
}: {
  databaseName: string
  schema?: string | null
  tableName: string
  children: ReactNode
}) {
  return (
    <ModalForm.Provider
      meta={{
        title: 'Export Data',
        description: schema ? `${databaseName}.${schema}.${tableName}` : `${databaseName}.${tableName}`,
        icon: Table2,
      }}
    >
      <ExportDataBridge databaseName={databaseName} schema={schema} tableName={tableName}>
        {children}
      </ExportDataBridge>
    </ModalForm.Provider>
  )
}

/** Inner bridge that owns domain state and export logic, accessing ModalForm actions via useModalForm(). */
function ExportDataBridge({
  databaseName,
  schema,
  tableName,
  children,
}: {
  databaseName: string
  schema?: string | null
  tableName: string
  children: ReactNode
}) {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [rowCount, setRowCount] = useState<number | ''>(1000)
  const [filter, setFilter] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const { actions } = useModalForm()
  const [executeQuery] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' })

  const handleExport = useCallback(async () => {
    actions.setSubmitting(true)
    actions.closeAlert()
    setIsSuccess(false)

    try {
      const qualifiedName = schema ? `${schema}.${tableName}` : tableName
      let query = `SELECT * FROM ${qualifiedName}`
      if (filter.trim()) query += ` WHERE ${filter.trim()}`
      if (rowCount !== '') query += ` LIMIT ${rowCount}`

      const { data, error } = await executeQuery({
        variables: { query },
        context: { database: databaseName },
      })

      if (error) throw new Error(error.message)
      if (!data?.RawExecute) throw new Error('No data returned from query')

      const { Columns, Rows } = data.RawExecute
      let blob: Blob

      switch (format) {
        case 'csv': blob = toCSV(Columns, Rows); break
        case 'json': blob = toJSON(Columns, Rows); break
        case 'sql': blob = toSQL(qualifiedName, Columns, Rows); break
        case 'excel': blob = toExcel(tableName, Columns, Rows); break
      }

      downloadBlob(blob, `${tableName}.${FORMAT_EXTENSIONS[format]}`)
      setIsSuccess(true)
    } catch (err: any) {
      actions.setAlert({
        type: 'error',
        title: 'Export failed',
        message: err.message || 'Unknown error',
      })
    } finally {
      actions.setSubmitting(false)
    }
  }, [actions, databaseName, executeQuery, filter, format, rowCount, schema, tableName])

  return (
    <ExportDataCtx value={{ format, setFormat, rowCount, setRowCount, filter, setFilter, isSuccess, handleExport }}>
      {children}
    </ExportDataCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Format selector, row limit, filter, and progress display. */
function ExportDataFields() {
  const { format, setFormat, rowCount, setRowCount, filter, setFilter, isSuccess } = useExportDataCtx()
  const { state } = useModalForm()
  const disabled = state.isSubmitting || isSuccess

  return (
    <div className="space-y-6">
      <FormatSelector options={FORMAT_OPTIONS} value={format} onChange={setFormat} disabled={disabled} />

      <div className="space-y-3">
        <label className="text-sm font-medium">Row Limit</label>
        <Input
          type="number"
          value={rowCount}
          onChange={(e) => setRowCount(e.target.value === '' ? '' : parseInt(e.target.value))}
          placeholder="Leave empty for all rows"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to export all rows (warning: large tables may take time)
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Filter Data (Optional)</label>
        <textarea
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Enter SQL WHERE clause (e.g., id > 100 AND status = 'active')"
          disabled={disabled}
          className="w-full h-24 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none font-mono"
        />
      </div>

      <ExportProgress isExporting={state.isSubmitting} isSuccess={isSuccess} />
    </div>
  )
}

/** Footer bridge: reads isSuccess and handleExport from domain context, delegates to shared ExportFooter. */
function ExportDataFooterBridge() {
  const { isSuccess, handleExport } = useExportDataCtx()
  return <ExportFooter isSuccess={isSuccess} onClick={handleExport} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface ExportDataModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  schema?: string | null
  tableName: string
}

/** Modal for exporting a single SQL table with optional row limit and WHERE filter. */
export function ExportDataModal({
  open,
  onOpenChange,
  databaseName,
  schema,
  tableName,
}: ExportDataModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <ExportDataProvider databaseName={databaseName} schema={schema} tableName={tableName}>
          <ModalForm.Header />
          <ExportDataFields />
          <ModalForm.Alert />
          <ExportDataFooterBridge />
        </ExportDataProvider>
      </DialogContent>
    </Dialog>
  )
}
