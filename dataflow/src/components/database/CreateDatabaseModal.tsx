import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Database } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

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
  const { t } = useI18n()
  const { createDatabase } = useConnectionStore()
  const [dbName, setDbName] = useState('')

  const handleSubmit = useCallback(async () => {
    if (!dbName) return
    const result = await createDatabase(dbName)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? t('common.unknownError'))
    }
  }, [dbName, createDatabase, onSuccess, t])

  return (
    <CreateDatabaseCtx value={{ dbName, setDbName }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: t('database.create.title'), icon: Database }}
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
  const { t } = useI18n()
  const { dbName, setDbName } = useCreateDatabaseCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t('database.name')}
      </label>
      <Input
        value={dbName}
        onChange={(e) => setDbName(e.target.value)}
        placeholder={t('database.namePlaceholder')}
        disabled={state.isSubmitting}
      />
    </div>
  )
}

/** Submit button disabled when database name is empty. */
function CreateSubmitButton() {
  const { t } = useI18n()
  const { dbName } = useCreateDatabaseCtx()
  return <ModalForm.SubmitButton label={t('database.create.submit')} disabled={!dbName} />
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
