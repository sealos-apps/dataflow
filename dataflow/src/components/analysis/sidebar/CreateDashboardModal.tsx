import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { useAnalysisStore } from '@/stores/useAnalysisStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CreateDashboardCtxValue {
  name: string
  setName: (v: string) => void
}

const CreateDashboardCtx = createContext<CreateDashboardCtxValue | null>(null)

function useCreateDashboardCtx(): CreateDashboardCtxValue {
  const ctx = use(CreateDashboardCtx)
  if (!ctx) throw new Error('useCreateDashboardCtx must be used within CreateDashboardProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for creating a new dashboard. */
function CreateDashboardProvider({
  onSuccess,
  children,
}: {
  onSuccess?: () => void
  children: ReactNode
}) {
  const { createDashboard, isDashboardNameExists } = useAnalysisStore()
  const [name, setName] = useState('')

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return
    if (isDashboardNameExists(name)) {
      throw new Error('Dashboard name already exists, please use a different name')
    }
    createDashboard(name)
    onSuccess?.()
  }, [name, isDashboardNameExists, createDashboard, onSuccess])

  return (
    <CreateDashboardCtx value={{ name, setName }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: 'New Dashboard', icon: LayoutDashboard }}
      >
        {children}
      </ModalForm.Provider>
    </CreateDashboardCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Input for the new dashboard name. */
function CreateDashboardFields() {
  const { name, setName } = useCreateDashboardCtx()
  const { state, actions } = useModalForm()

  return (
    <Input
      value={name}
      onChange={(e) => { setName(e.target.value); actions.closeAlert() }}
      placeholder="Enter dashboard name"
      maxLength={15}
      disabled={state.isSubmitting}
      autoFocus
    />
  )
}

/** Submit button disabled when name is empty. */
function CreateSubmitButton() {
  const { name } = useCreateDashboardCtx()
  return <ModalForm.SubmitButton label="Create" disabled={!name.trim()} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface CreateDashboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Modal for creating a new dashboard. */
export function CreateDashboardModal({ open, onOpenChange }: CreateDashboardModalProps) {
  const handleSuccess = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CreateDashboardProvider onSuccess={handleSuccess}>
          <ModalForm.Header />
          <CreateDashboardFields />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <CreateSubmitButton />
          </ModalForm.Footer>
        </CreateDashboardProvider>
      </DialogContent>
    </Dialog>
  )
}
