import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CopyTableCtxValue {
  newTableName: string
  setNewTableName: (v: string) => void
  copyOption: 'structure' | 'structure_data'
  setCopyOption: (v: 'structure' | 'structure_data') => void
  tableName: string
}

const CopyTableCtx = createContext<CopyTableCtxValue | null>(null)

/** Hook to access CopyTable domain context. Throws outside provider. */
function useCopyTableCtx(): CopyTableCtxValue {
  const ctx = use(CopyTableCtx)
  if (!ctx) throw new Error('useCopyTableCtx must be used within CopyTableProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for copying a SQL table (structure only or with data). */
function CopyTableProvider({
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
  const { copyTable } = useConnectionStore()
  const [newTableName, setNewTableName] = useState(`${tableName}_copy`)
  const [copyOption, setCopyOption] = useState<'structure' | 'structure_data'>('structure_data')

  const handleSubmit = useCallback(async () => {
    if (!newTableName.trim()) return
    const copyData = copyOption === 'structure_data'
    const result = await copyTable(databaseName, schema, tableName, newTableName, copyData)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? t('common.unknownError'))
    }
  }, [newTableName, copyOption, databaseName, schema, tableName, copyTable, onSuccess, t])

  return (
    <CopyTableCtx value={{ newTableName, setNewTableName, copyOption, setCopyOption, tableName }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: t('sql.copyTable.title'), icon: Copy }}
      >
        {children}
      </ModalForm.Provider>
    </CopyTableCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Source table (disabled), new table name input, and copy option radios. */
function CopyTableFields() {
  const { t } = useI18n()
  const { newTableName, setNewTableName, copyOption, setCopyOption, tableName } = useCopyTableCtx()
  const { state } = useModalForm()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {t('sql.copyTable.sourceTable')}
        </label>
        <Input value={tableName} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {t('sql.copyTable.newTableName')}
        </label>
        <Input
          value={newTableName}
          onChange={(e) => setNewTableName(e.target.value)}
          placeholder={t('sql.copyTable.newTableNamePlaceholder')}
          disabled={state.isSubmitting}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          {t('sql.copyTable.options')}
        </label>
        <RadioGroup
          value={copyOption}
          onValueChange={(v) => setCopyOption(v as typeof copyOption)}
          disabled={state.isSubmitting}
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="structure" />
            <span className="text-sm">{t('sql.copyTable.structureOnly')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="structure_data" />
            <span className="text-sm">{t('sql.copyTable.structureAndData')}</span>
          </label>
        </RadioGroup>
      </div>
    </div>
  )
}

/** Submit button disabled when new table name is empty. */
function CopyTableSubmitButton() {
  const { t } = useI18n()
  const { newTableName } = useCopyTableCtx()
  return <ModalForm.SubmitButton label={t('sql.copyTable.submit')} disabled={!newTableName.trim()} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface CopyTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  schema?: string
  tableName: string
  onSuccess?: () => void
}

/** Modal for copying a SQL table's structure and optionally data. */
export function CopyTableModal({
  open,
  onOpenChange,
  databaseName,
  schema,
  tableName,
  onSuccess,
}: CopyTableModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CopyTableProvider
          databaseName={databaseName}
          schema={schema}
          tableName={tableName}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <CopyTableFields />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <CopyTableSubmitButton />
          </ModalForm.Footer>
        </CopyTableProvider>
      </DialogContent>
    </Dialog>
  )
}
