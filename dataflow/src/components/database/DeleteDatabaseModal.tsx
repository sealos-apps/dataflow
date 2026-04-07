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

interface DeleteDatabaseCtxValue {
  confirmName: string
  setConfirmName: (v: string) => void
  databaseName: string
  canDelete: boolean
}

const DeleteDatabaseCtx = createContext<DeleteDatabaseCtxValue | null>(null)

function useDeleteDatabaseCtx(): DeleteDatabaseCtxValue {
  const ctx = use(DeleteDatabaseCtx)
  if (!ctx) throw new Error('useDeleteDatabaseCtx must be used within DeleteDatabaseProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for deleting a database. */
function DeleteDatabaseProvider({
  connectionId,
  databaseName,
  onSuccess,
  children,
}: {
  connectionId: string
  databaseName: string
  onSuccess?: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const { deleteDatabase } = useConnectionStore()
  const [confirmName, setConfirmName] = useState('')
  const canDelete = confirmName === databaseName

  const handleSubmit = useCallback(async () => {
    if (!canDelete) return
    const result = await deleteDatabase(databaseName)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? t('common.unknownError'))
    }
  }, [canDelete, databaseName, deleteDatabase, onSuccess, t])

  return (
    <DeleteDatabaseCtx value={{ confirmName, setConfirmName, databaseName, canDelete }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: t('database.delete.title'), icon: AlertTriangle, isDestructive: true }}
      >
        {children}
      </ModalForm.Provider>
    </DeleteDatabaseCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Warning banner explaining the destructive action. */
function DeleteDatabaseWarning() {
  const { t } = useI18n()
  const { databaseName } = useDeleteDatabaseCtx()

  return (
    <div className="rounded-lg bg-destructive/5 p-4 text-sm border border-destructive/10">
      <p className="font-medium text-destructive">{t('database.delete.warningTitle')}</p>
      <p className="mt-1 text-muted-foreground">{t('database.delete.warningMessage', { databaseName })}</p>
    </div>
  )
}

/** Confirmation input — user must type the database name to enable deletion. */
function DeleteDatabaseConfirmation() {
  const { t } = useI18n()
  const { confirmName, setConfirmName, databaseName } = useDeleteDatabaseCtx()
  const { state } = useModalForm()

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {t('database.delete.confirmName')}
      </label>
      <Input
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder={databaseName}
        disabled={state.isSubmitting}
      />
    </div>
  )
}

/** Submit button disabled until confirmation name matches. */
function DeleteSubmitButton() {
  const { t } = useI18n()
  const { canDelete } = useDeleteDatabaseCtx()
  return <ModalForm.SubmitButton label={t('database.delete.submit')} disabled={!canDelete} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface DeleteDatabaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  databaseName: string
  onSuccess?: () => void
}

/** Modal for deleting a database with confirmation. */
export function DeleteDatabaseModal({
  open,
  onOpenChange,
  connectionId,
  databaseName,
  onSuccess,
}: DeleteDatabaseModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DeleteDatabaseProvider
          connectionId={connectionId}
          databaseName={databaseName}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <DeleteDatabaseWarning />
          <DeleteDatabaseConfirmation />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <DeleteSubmitButton />
          </ModalForm.Footer>
        </DeleteDatabaseProvider>
      </DialogContent>
    </Dialog>
  )
}
