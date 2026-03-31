import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Eraser } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ClearTableDataCtxValue {
  mode: 'truncate' | 'delete'
  setMode: (v: 'truncate' | 'delete') => void
  tableName: string
}

const ClearTableDataCtx = createContext<ClearTableDataCtxValue | null>(null)

/** Hook to access ClearTableData domain context. Throws outside provider. */
function useClearTableDataCtx(): ClearTableDataCtxValue {
  const ctx = use(ClearTableDataCtx)
  if (!ctx) throw new Error('useClearTableDataCtx must be used within ClearTableDataProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for clearing all data from a SQL table. */
function ClearTableDataProvider({
  databaseName,
  schema,
  tableName,
  onSuccess,
  children,
}: {
  databaseName: string
  schema?: string
  tableName: string
  onSuccess?: () => void
  children: ReactNode
}) {
  const { clearTableData } = useConnectionStore()
  const [mode, setMode] = useState<'truncate' | 'delete'>('truncate')

  const handleSubmit = useCallback(async () => {
    const result = await clearTableData(databaseName, schema, tableName, mode)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? 'Unknown error')
    }
  }, [databaseName, schema, tableName, mode, clearTableData, onSuccess])

  return (
    <ClearTableDataCtx value={{ mode, setMode, tableName }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: 'Clear Table Data', icon: Eraser, isDestructive: true }}
      >
        {children}
      </ModalForm.Provider>
    </ClearTableDataCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Warning banner about data loss. */
function ClearTableDataWarning() {
  const { tableName } = useClearTableDataCtx()

  return (
    <div className="rounded-lg bg-destructive/5 p-3 text-sm border border-destructive/10">
      <p className="text-muted-foreground">
        This will remove <strong className="text-foreground">all data</strong> from{' '}
        <strong className="text-foreground">{tableName}</strong>. This action cannot be undone.
      </p>
    </div>
  )
}

/** Radio selector for TRUNCATE vs DELETE mode. */
function ClearTableDataModeSelector() {
  const { mode, setMode } = useClearTableDataCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Mode
      </label>
      <div className="space-y-2">
        <label
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
            mode === 'truncate' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
          )}
        >
          <input
            type="radio"
            name="clearMode"
            checked={mode === 'truncate'}
            onChange={() => setMode('truncate')}
            disabled={state.isSubmitting}
            className="mt-0.5"
          />
          <div>
            <div className="text-sm font-medium">Fast (TRUNCATE)</div>
            <div className="text-xs text-muted-foreground">
              Resets auto-increment counters. Skips row-level triggers. Fastest for large tables.
            </div>
          </div>
        </label>
        <label
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
            mode === 'delete' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
          )}
        >
          <input
            type="radio"
            name="clearMode"
            checked={mode === 'delete'}
            onChange={() => setMode('delete')}
            disabled={state.isSubmitting}
            className="mt-0.5"
          />
          <div>
            <div className="text-sm font-medium">Safe (DELETE)</div>
            <div className="text-xs text-muted-foreground">
              Preserves auto-increment state. Fires row-level triggers. Slower on large tables.
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface ClearTableDataModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  schema?: string
  tableName: string
  onSuccess?: () => void
}

/** Modal for clearing all data from a SQL table (TRUNCATE or DELETE). */
export function ClearTableDataModal({
  open,
  onOpenChange,
  databaseName,
  schema,
  tableName,
  onSuccess,
}: ClearTableDataModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ClearTableDataProvider
          databaseName={databaseName}
          schema={schema}
          tableName={tableName}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <ClearTableDataWarning />
          <ClearTableDataModeSelector />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <ModalForm.SubmitButton label="Clear Data" />
          </ModalForm.Footer>
        </ClearTableDataProvider>
      </DialogContent>
    </Dialog>
  )
}
