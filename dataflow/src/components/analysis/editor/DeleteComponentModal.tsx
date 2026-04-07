import { useCallback, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { useAnalysisDefinitionStore } from '@/stores/analysisDefinitionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

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
  const { t } = useI18n()
  const deleteWidget = useAnalysisDefinitionStore(state => state.deleteWidget)

  const handleSubmit = useCallback(async () => {
    await deleteWidget(componentId)
    onSuccess?.()
  }, [deleteWidget, componentId, onSuccess])

  return (
    <ModalForm.Provider
      onSubmit={handleSubmit}
      meta={{
        title: t('analysis.widget.deleteTitle'),
        description: t('analysis.widget.deleteConfirm'),
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
            <ModalForm.SubmitButton />
          </ModalForm.Footer>
        </DeleteComponentProvider>
      </DialogContent>
    </Dialog>
  )
}
