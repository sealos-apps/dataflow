import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Table } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/database/modals/ModalForm'
import { useModalState } from '@/components/database/modals/useModalState'

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
  const { renameTable } = useConnectionStore()
  const [newName, setNewName] = useState(tableName)
  const { state, actions: baseActions } = useModalState()

  const actions = {
    ...baseActions,
    submit: async () => {
      if (!newName.trim() || newName === tableName) return
      baseActions.setSubmitting(true)
      const result = await renameTable(databaseName, schema, tableName, newName)
      baseActions.setSubmitting(false)
      if (result.success) {
        onSuccess?.()
      } else {
        baseActions.setAlert({
          type: 'error',
          title: 'Failed to rename table',
          message: result.message ?? 'Unknown error',
        })
      }
    },
  }

  return (
    <RenameTableCtx value={{ newName, setNewName, tableName }}>
      <ModalForm.Provider
        state={state}
        actions={actions}
        meta={{ title: 'Rename Table', icon: Table }}
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
  const { newName, setNewName, tableName } = useRenameTableCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Current Name
        </label>
        <Input value={tableName} disabled />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          New Name
        </label>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter new table name"
          disabled={state.isSubmitting}
          autoFocus
        />
      </div>
    </div>
  )
}

/** Submit button disabled when name is empty or unchanged. */
function RenameTableSubmitButton() {
  const { newName, tableName } = useRenameTableCtx()
  return <ModalForm.SubmitButton label="Rename" disabled={!newName.trim() || newName === tableName} />
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
