import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/database/modals/ModalForm'
import { useModalState } from '@/components/database/modals/useModalState'

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
  const { deleteDatabase } = useConnectionStore()
  const [confirmName, setConfirmName] = useState('')
  const canDelete = confirmName === databaseName
  const { state, actions: baseActions } = useModalState()

  const actions = {
    ...baseActions,
    submit: async () => {
      if (!canDelete) return
      baseActions.setSubmitting(true)
      const result = await deleteDatabase(databaseName)
      baseActions.setSubmitting(false)
      if (result.success) {
        onSuccess?.()
      } else {
        baseActions.setAlert({
          type: 'error',
          title: 'Failed to delete database',
          message: result.message ?? 'Unknown error',
        })
      }
    },
  }

  return (
    <DeleteDatabaseCtx value={{ confirmName, setConfirmName, databaseName, canDelete }}>
      <ModalForm.Provider
        state={state}
        actions={actions}
        meta={{ title: 'Delete Database', icon: AlertTriangle, isDestructive: true }}
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
  const { databaseName } = useDeleteDatabaseCtx()

  return (
    <div className="rounded-lg bg-destructive/5 p-4 text-sm border border-destructive/10">
      <p className="font-medium text-destructive">Warning: This action cannot be undone.</p>
      <p className="mt-1 text-muted-foreground">
        This will permanently delete the database{' '}
        <strong className="text-foreground">{databaseName}</strong> and all its contents.
      </p>
    </div>
  )
}

/** Confirmation input — user must type the database name to enable deletion. */
function DeleteDatabaseConfirmation() {
  const { confirmName, setConfirmName, databaseName } = useDeleteDatabaseCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Type database name to confirm
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
  const { canDelete } = useDeleteDatabaseCtx()
  return <ModalForm.SubmitButton label="Delete Database" disabled={!canDelete} />
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
