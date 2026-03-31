import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'

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
  const { deleteTable } = useConnectionStore()
  const [confirmName, setConfirmName] = useState('')
  const canDelete = confirmName === tableName

  const handleSubmit = useCallback(async () => {
    if (!canDelete) return
    const result = await deleteTable(databaseName, schema, tableName)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? 'Unknown error')
    }
  }, [canDelete, databaseName, schema, tableName, deleteTable, onSuccess])

  return (
    <DeleteTableCtx value={{ confirmName, setConfirmName, tableName, canDelete }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: 'Delete Table', icon: AlertTriangle, isDestructive: true }}
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
  const { tableName } = useDeleteTableCtx()

  return (
    <div className="rounded-lg bg-destructive/5 p-4 text-sm border border-destructive/10">
      <p className="font-medium text-destructive">Warning: This action cannot be undone.</p>
      <p className="mt-1 text-muted-foreground">
        This will permanently delete the table{' '}
        <strong className="text-foreground">{tableName}</strong> and all its data.
      </p>
    </div>
  )
}

/** Confirmation input — user must type the table name to enable deletion. */
function DeleteTableConfirmation() {
  const { confirmName, setConfirmName, tableName } = useDeleteTableCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Type table name to confirm
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
  const { canDelete } = useDeleteTableCtx()
  return <ModalForm.SubmitButton label="Delete Table" disabled={!canDelete} />
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
