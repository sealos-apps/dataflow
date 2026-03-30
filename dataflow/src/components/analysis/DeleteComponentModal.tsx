import { useCallback, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { useAnalysisStore } from '@/stores/useAnalysisStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ModalForm } from '@/components/database/modals/ModalForm'
import { useModalState } from '@/components/database/modals/useModalState'

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for deleting a dashboard component. */
function DeleteComponentProvider({
  componentId,
  onSuccess,
  children,
}: {
  componentId: string
  onSuccess?: () => void
  children: ReactNode
}) {
  const { removeComponent } = useAnalysisStore()
  const { state, actions: baseActions } = useModalState()

  const actions = {
    ...baseActions,
    submit: async () => {
      removeComponent(componentId)
      onSuccess?.()
    },
  }

  return (
    <ModalForm.Provider
      state={state}
      actions={actions}
      meta={{
        title: 'Delete Component',
        description: 'Are you sure you want to delete this component? This action cannot be undone.',
        icon: Trash2,
        isDestructive: true,
      }}
    >
      {children}
    </ModalForm.Provider>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface DeleteComponentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  componentId: string
  onSuccess?: () => void
}

/** Modal for confirming deletion of a dashboard component. */
export function DeleteComponentModal({
  open,
  onOpenChange,
  componentId,
  onSuccess,
}: DeleteComponentModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DeleteComponentProvider componentId={componentId} onSuccess={handleSuccess}>
          <ModalForm.Header />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <ModalForm.SubmitButton label="Delete" />
          </ModalForm.Footer>
        </DeleteComponentProvider>
      </DialogContent>
    </Dialog>
  )
}
