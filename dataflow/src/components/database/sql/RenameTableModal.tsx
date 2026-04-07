import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Table } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface RenameTableCtxValue {
  newName: string
  setNewName: (v: string) => void
  tableName: string
}

const RenameTableCtx = createContext<RenameTableCtxValue | null>(null)

/** Hook to access RenameTable domain context. Throws outside provider. */
function useRenameTableCtx(): RenameTableCtxValue {
  const ctx = use(RenameTableCtx)
  if (!ctx) throw new Error('useRenameTableCtx must be used within RenameTableProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for renaming a SQL table. */
function RenameTableProvider({
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
  const { renameTable } = useConnectionStore()
  const [newName, setNewName] = useState(tableName)

  const handleSubmit = useCallback(async () => {
    if (!newName.trim() || newName === tableName) return
    const result = await renameTable(databaseName, schema, tableName, newName)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? t('sql.common.unknownError'))
    }
  }, [newName, tableName, databaseName, schema, renameTable, onSuccess, t])

  return (
    <RenameTableCtx value={{ newName, setNewName, tableName }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: t('sql.renameTable.title'), icon: Table }}
      >
        {children}
      </ModalForm.Provider>
    </RenameTableCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Shows current table name (disabled) and new name input. */
function RenameTableFields() {
  const { t } = useI18n()
  const { newName, setNewName, tableName } = useRenameTableCtx()
  const { state } = useModalForm()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground">
          {t('sql.renameTable.currentName')}
        </label>
        <Input value={tableName} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground">
          {t('sql.renameTable.newName')}
        </label>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('sql.renameTable.newNamePlaceholder')}
          disabled={state.isSubmitting}
          autoFocus
        />
      </div>
    </div>
  )
}

/** Submit button disabled when name is empty or unchanged. */
function RenameTableSubmitButton() {
  const { t } = useI18n()
  const { newName, tableName } = useRenameTableCtx()
  return <ModalForm.SubmitButton label={t('sql.renameTable.submit')} disabled={!newName.trim() || newName === tableName} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface RenameTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  schema?: string
  tableName: string
  onSuccess?: () => void
}

/** Modal for renaming a SQL table. */
export function RenameTableModal({
  open,
  onOpenChange,
  databaseName,
  schema,
  tableName,
  onSuccess,
}: RenameTableModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <RenameTableProvider
          databaseName={databaseName}
          schema={schema}
          tableName={tableName}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <RenameTableFields />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <RenameTableSubmitButton />
          </ModalForm.Footer>
        </RenameTableProvider>
      </DialogContent>
    </Dialog>
  )
}
