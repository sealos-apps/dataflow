import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Eraser } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

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
  const { t } = useI18n()
  const { clearTableData } = useConnectionStore()
  const [mode, setMode] = useState<'truncate' | 'delete'>('truncate')

  const handleSubmit = useCallback(async () => {
    const result = await clearTableData(databaseName, schema, tableName, mode)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? t('sql.common.unknownError'))
    }
  }, [databaseName, schema, tableName, mode, clearTableData, onSuccess, t])

  return (
    <ClearTableDataCtx value={{ mode, setMode, tableName }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: t('sql.clearTable.title'), icon: Eraser, isDestructive: true }}
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
  const { t } = useI18n()
  const { tableName } = useClearTableDataCtx()

  return (
    <div className="rounded-lg bg-destructive/5 p-4 text-sm border border-destructive/10">
      <p className="text-destructive">
        {t('sql.clearTable.warning', { tableName })}
      </p>
    </div>
  )
}

/** Radio selector for TRUNCATE vs DELETE mode. */
function ClearTableDataModeSelector() {
  const { t } = useI18n()
  const { mode, setMode } = useClearTableDataCtx()
  const { state } = useModalForm()

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">
        {t('sql.clearTable.mode')}
      </label>
      <RadioGroup
        value={mode}
        onValueChange={(v) => setMode(v as typeof mode)}
        disabled={state.isSubmitting}
      >
        <label
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
            mode === 'truncate' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
          )}
        >
          <RadioGroupItem value="truncate" className="mt-0.5" />
          <div>
            <div className="text-sm font-medium">{t('sql.clearTable.fastTruncate')}</div>
            <div className="text-xs text-muted-foreground">
              {t('sql.clearTable.fastTruncateDescription')}
            </div>
          </div>
        </label>
        <label
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
            mode === 'delete' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
          )}
        >
          <RadioGroupItem value="delete" className="mt-0.5" />
          <div>
            <div className="text-sm font-medium">{t('sql.clearTable.safeDelete')}</div>
            <div className="text-xs text-muted-foreground">
              {t('sql.clearTable.safeDeleteDescription')}
            </div>
          </div>
        </label>
      </RadioGroup>
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
  const { t } = useI18n()
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
            <ModalForm.SubmitButton label={t('sql.clearTable.submit')} />
          </ModalForm.Footer>
        </ClearTableDataProvider>
      </DialogContent>
    </Dialog>
  )
}
