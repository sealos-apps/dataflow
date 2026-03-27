import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Database } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/database/modals/ModalForm'
import { useModalState } from '@/components/database/modals/useModalState'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CreateDatabaseCtxValue {
  dbName: string
  setDbName: (v: string) => void
}

const CreateDatabaseCtx = createContext<CreateDatabaseCtxValue | null>(null)

function useCreateDatabaseCtx(): CreateDatabaseCtxValue {
  const ctx = use(CreateDatabaseCtx)
  if (!ctx) throw new Error('useCreateDatabaseCtx must be used within CreateDatabaseProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for creating a new database. */
function CreateDatabaseProvider({
  connectionId,
  onSuccess,
  children,
}: {
  connectionId: string
  onSuccess?: () => void
  children: ReactNode
}) {
  const { createDatabase } = useConnectionStore()
  const [dbName, setDbName] = useState('')
  const { state, actions: baseActions } = useModalState()

  const actions = {
    ...baseActions,
    submit: async () => {
      if (!dbName) return
      baseActions.setSubmitting(true)
      const result = await createDatabase(dbName)
      baseActions.setSubmitting(false)
      if (result.success) {
        onSuccess?.()
      } else {
        baseActions.setAlert({
          type: 'error',
          title: 'Failed to create database',
          message: result.message ?? 'Unknown error',
        })
      }
    },
  }

  return (
    <CreateDatabaseCtx value={{ dbName, setDbName }}>
      <ModalForm.Provider
        state={state}
        actions={actions}
        meta={{ title: 'Create Database', icon: Database }}
      >
        {children}
      </ModalForm.Provider>
    </CreateDatabaseCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Input field for the new database name. */
function CreateDatabaseFields() {
  const { dbName, setDbName } = useCreateDatabaseCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Database Name
      </label>
      <Input
        value={dbName}
        onChange={(e) => setDbName(e.target.value)}
        placeholder="Enter database name"
        disabled={state.isSubmitting}
      />
    </div>
  )
}

/** Submit button disabled when database name is empty. */
function CreateSubmitButton() {
  const { dbName } = useCreateDatabaseCtx()
  return <ModalForm.SubmitButton label="Save" disabled={!dbName} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface CreateDatabaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  onSuccess?: () => void
}

/** Modal for creating a new database. */
export function CreateDatabaseModal({
  open,
  onOpenChange,
  connectionId,
  onSuccess,
}: CreateDatabaseModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CreateDatabaseProvider connectionId={connectionId} onSuccess={handleSuccess}>
          <ModalForm.Header />
          <CreateDatabaseFields />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <CreateSubmitButton />
          </ModalForm.Footer>
        </CreateDatabaseProvider>
      </DialogContent>
    </Dialog>
  )
}
