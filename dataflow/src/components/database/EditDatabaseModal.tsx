import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Database } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface EditDatabaseCtxValue {
  newName: string
  setNewName: (v: string) => void
  databaseName: string
}

const EditDatabaseCtx = createContext<EditDatabaseCtxValue | null>(null)

function useEditDatabaseCtx(): EditDatabaseCtxValue {
  const ctx = use(EditDatabaseCtx)
  if (!ctx) throw new Error('useEditDatabaseCtx must be used within EditDatabaseProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for renaming a database. */
function EditDatabaseProvider({
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
  const { renameDatabase } = useConnectionStore()
  const [newName, setNewName] = useState(databaseName)

  const handleSubmit = useCallback(async () => {
    if (!newName || newName === databaseName) return
    const result = await renameDatabase(databaseName, newName)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? 'Unknown error')
    }
  }, [newName, databaseName, renameDatabase, onSuccess])

  return (
    <EditDatabaseCtx value={{ newName, setNewName, databaseName }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: 'Rename Database', icon: Database }}
      >
        {children}
      </ModalForm.Provider>
    </EditDatabaseCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Input field for the new database name. */
function EditDatabaseFields() {
  const { newName, setNewName } = useEditDatabaseCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Database Name
      </label>
      <Input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Enter database name"
        disabled={state.isSubmitting}
      />
    </div>
  )
}

/** Submit button disabled when name is empty or unchanged. */
function EditSubmitButton() {
  const { newName, databaseName } = useEditDatabaseCtx()
  return <ModalForm.SubmitButton label="Save Changes" disabled={!newName || newName === databaseName} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface EditDatabaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  databaseName: string
  onSuccess?: () => void
}

/** Modal for renaming a database. */
export function EditDatabaseModal({
  open,
  onOpenChange,
  connectionId,
  databaseName,
  onSuccess,
}: EditDatabaseModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <EditDatabaseProvider
          connectionId={connectionId}
          databaseName={databaseName}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <EditDatabaseFields />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <EditSubmitButton />
          </ModalForm.Footer>
        </EditDatabaseProvider>
      </DialogContent>
    </Dialog>
  )
}
