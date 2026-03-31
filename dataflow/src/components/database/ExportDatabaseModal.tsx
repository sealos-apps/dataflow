import { createContext, use, useCallback, useState, type ReactNode } from 'react'
import { Database, FileJson, FileSpreadsheet, FileCode, FileText } from 'lucide-react'
import { useRawExecuteLazyQuery, useGetStorageUnitsLazyQuery } from '@/generated/graphql'
import { toCSV, toJSON, toSQL, toExcel, downloadBlob } from '@/utils/export-utils'
import JSZip from 'jszip'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { FormatSelector, type FormatOption } from '@/components/database/shared/FormatSelector'
import { ExportProgress, ExportFooter } from '@/components/database/shared/ExportProgress'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ExportFormat = 'csv' | 'json' | 'sql' | 'excel'

const FORMAT_OPTIONS: FormatOption<ExportFormat>[] = [
  { id: 'sql', label: 'SQL', icon: FileCode },
  { id: 'json', label: 'JSON', icon: FileJson },
  { id: 'csv', label: 'CSV', icon: FileText },
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

interface ExportDatabaseCtxValue {
  format: ExportFormat
  setFormat: (v: ExportFormat) => void
  isSuccess: boolean
  statusText: string
  handleExport: () => void
}

const ExportDatabaseCtx = createContext<ExportDatabaseCtxValue | null>(null)

/** Hook to access ExportDatabaseModal domain state. Throws if used outside the provider. */
function useExportDatabaseCtx(): ExportDatabaseCtxValue {
  const ctx = use(ExportDatabaseCtx)
  if (!ctx) throw new Error('useExportDatabaseCtx must be used within ExportDatabaseProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Wraps ModalForm.Provider (complex mode, no onSubmit) and domain context for database ZIP export. */
function ExportDatabaseProvider({
  databaseName,
  schema,
  children,
}: {
  databaseName: string
  schema: string
  children: ReactNode
}) {
  return (
    <ModalForm.Provider
      meta={{ title: 'Export Database', description: databaseName, icon: Database }}
    >
      <ExportDatabaseBridge databaseName={databaseName} schema={schema}>
        {children}
      </ExportDatabaseBridge>
    </ModalForm.Provider>
  )
}

/**
 * Inner bridge that owns domain state and multi-table export logic.
 * Fetches table list via GraphQL, iterates each table, converts to selected format,
 * bundles into ZIP via JSZip, triggers download. Partial failures surface as an info alert.
 */
function ExportDatabaseBridge({
  databaseName,
  schema,
  children,
}: {
  databaseName: string
  schema: string
  children: ReactNode
}) {
  const [format, setFormat] = useState<ExportFormat>('sql')
  const [isSuccess, setIsSuccess] = useState(false)
  const [statusText, setStatusText] = useState('')
  const { actions } = useModalForm()
  const [fetchTables] = useGetStorageUnitsLazyQuery({ fetchPolicy: 'no-cache' })
  const [executeQuery] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' })

  const handleExport = useCallback(async () => {
    actions.setSubmitting(true)
    actions.closeAlert()
    setIsSuccess(false)
    setStatusText('Fetching table list...')

    try {
      const { data: tablesData, error: tablesError } = await fetchTables({
        variables: { schema },
        context: { database: databaseName },
      })

      if (tablesError) throw new Error(tablesError.message)
      const tables = tablesData?.StorageUnit ?? []
      if (tables.length === 0) throw new Error('No tables found in database')

      const zip = new JSZip()
      const failedTables: string[] = []

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i]
        const tableName = table.Name
        setStatusText(`Exporting table ${i + 1} of ${tables.length}... (${tableName})`)

        try {
          const qualifiedName = schema ? `${schema}.${tableName}` : tableName
          const { data, error } = await executeQuery({
            variables: { query: `SELECT * FROM ${qualifiedName}` },
            context: { database: databaseName },
          })

          if (error || !data?.RawExecute) {
            failedTables.push(tableName)
            continue
          }

          const { Columns, Rows } = data.RawExecute
          let blob: Blob

          switch (format) {
            case 'csv': blob = toCSV(Columns, Rows); break
            case 'json': blob = toJSON(Columns, Rows); break
            case 'sql': blob = toSQL(qualifiedName, Columns, Rows); break
            case 'excel': blob = toExcel(tableName, Columns, Rows); break
          }

          zip.file(`${tableName}.${FORMAT_EXTENSIONS[format]}`, blob)
        } catch {
          failedTables.push(tableName)
        }
      }

      setStatusText('Generating zip file...')

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(zipBlob, `export_${databaseName}.zip`)

      setIsSuccess(true)

      if (failedTables.length > 0) {
        actions.setAlert({
          type: 'info',
          title: 'Partial export',
          message: `Exported ${tables.length - failedTables.length} of ${tables.length} tables. Failed: ${failedTables.join(', ')}`,
        })
      }
    } catch (err: any) {
      actions.setAlert({
        type: 'error',
        title: 'Export failed',
        message: err.message || 'Unknown error',
      })
    } finally {
      actions.setSubmitting(false)
    }
  }, [actions, databaseName, executeQuery, fetchTables, format, schema])

  return (
    <ExportDatabaseCtx value={{ format, setFormat, isSuccess, statusText, handleExport }}>
      {children}
    </ExportDatabaseCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Format selector and progress display for database export. */
function ExportDatabaseFields() {
  const { format, setFormat, isSuccess, statusText } = useExportDatabaseCtx()
  const { state } = useModalForm()
  const disabled = state.isSubmitting || isSuccess

  return (
    <div className="space-y-6">
      <FormatSelector options={FORMAT_OPTIONS} value={format} onChange={setFormat} disabled={disabled} />
      <ExportProgress isExporting={state.isSubmitting} isSuccess={isSuccess} statusText={statusText} />
    </div>
  )
}

/** Footer bridge: reads isSuccess and handleExport from domain context, delegates to shared ExportFooter. */
function ExportDatabaseFooterBridge() {
  const { isSuccess, handleExport } = useExportDatabaseCtx()
  return <ExportFooter isSuccess={isSuccess} onClick={handleExport} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface ExportDatabaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  schema: string
}

/** Modal for exporting all tables in a database as a ZIP archive. */
export function ExportDatabaseModal({
  open,
  onOpenChange,
  databaseName,
  schema,
}: ExportDatabaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <ExportDatabaseProvider databaseName={databaseName} schema={schema}>
          <ModalForm.Header />
          <ExportDatabaseFields />
          <ModalForm.Alert />
          <ExportDatabaseFooterBridge />
        </ExportDatabaseProvider>
      </DialogContent>
    </Dialog>
  )
}
