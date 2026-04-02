import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DeleteTableCtxValue {
  confirmName: string
  setConfirmName: (v: string) => void
  tableName: string
  canDelete: boolean
}

const DeleteTableCtx = createContext<DeleteTableCtxValue | null>(null)

/** Hook to access DeleteTable domain context. Throws outside provider. */
function useDeleteTableCtx(): DeleteTableCtxValue {
  const ctx = use(DeleteTableCtx)
  if (!ctx) throw new Error('useDeleteTableCtx must be used within DeleteTableProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for deleting a SQL table with name confirmation. */
function DeleteTableProvider({
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
  const { deleteTable } = useConnectionStore()
  const [confirmName, setConfirmName] = useState('')
  const canDelete = confirmName === tableName

  const handleSubmit = useCallback(async () => {
    if (!canDelete) return
    const result = await deleteTable(databaseName, schema, tableName)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? t('sql.common.unknownError'))
    }
  }, [canDelete, databaseName, schema, tableName, deleteTable, onSuccess, t])

  return (
    <DeleteTableCtx value={{ confirmName, setConfirmName, tableName, canDelete }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: t('sql.deleteTable.title'), icon: AlertTriangle, isDestructive: true }}
      >
        {children}
      </ModalForm.Provider>
    </DeleteTableCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Warning banner explaining the destructive action. */
function DeleteTableWarning() {
  const { t } = useI18n()
  const { tableName } = useDeleteTableCtx()

  return (
    <div className="rounded-lg bg-destructive/5 p-4 text-sm border border-destructive/10">
      <p className="font-medium text-destructive">{t('sql.deleteTable.warningTitle')}</p>
      <p className="mt-1 text-muted-foreground">
        {t('sql.deleteTable.warningMessage', { tableName })}
      </p>
    </div>
  )
}

/** Confirmation input — user must type the table name to enable deletion. */
function DeleteTableConfirmation() {
  const { t } = useI18n()
  const { confirmName, setConfirmName, tableName } = useDeleteTableCtx()
  const { state } = useModalForm()

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-muted-foreground">
        {t('sql.deleteTable.confirmName')}
      </label>
      <Input
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder={tableName}
        disabled={state.isSubmitting}
      />
    </div>
  )
}

/** Submit button disabled until confirmation name matches. */
function DeleteTableSubmitButton() {
  const { t } = useI18n()
  const { canDelete } = useDeleteTableCtx()
  return <ModalForm.SubmitButton label={t('sql.deleteTable.submit')} disabled={!canDelete} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface DeleteTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  schema?: string
  tableName: string
  onSuccess?: () => void
}

/** Modal for deleting a SQL table with name confirmation. */
export function DeleteTableModal({
  open,
  onOpenChange,
  databaseName,
  schema,
  tableName,
  onSuccess,
}: DeleteTableModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DeleteTableProvider
          databaseName={databaseName}
          schema={schema}
          tableName={tableName}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <DeleteTableWarning />
          <DeleteTableConfirmation />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <DeleteTableSubmitButton />
          </ModalForm.Footer>
        </DeleteTableProvider>
      </DialogContent>
    </Dialog>
  )
}
