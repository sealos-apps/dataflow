import { useCallback, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { useAnalysisStore } from '@/stores/useAnalysisStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ModalForm } from '@/components/ui/ModalForm'

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for deleting a dashboard. */
function DeleteDashboardProvider({
  dashboardId,
  dashboardName,
  onSuccess,
  children,
}: {
  dashboardId: string
  dashboardName: string
  onSuccess?: () => void
  children: ReactNode
}) {
  const { deleteDashboard } = useAnalysisStore()

  const handleSubmit = useCallback(async () => {
    deleteDashboard(dashboardId)
    onSuccess?.()
  }, [deleteDashboard, dashboardId, onSuccess])

  return (
    <ModalForm.Provider
      onSubmit={handleSubmit}
      meta={{
        title: 'Delete Dashboard',
        description: `Are you sure you want to delete "${dashboardName}"? This action cannot be undone.`,
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

interface DeleteDashboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: string
  dashboardName: string
}

/** Modal for confirming deletion of a dashboard. */
export function DeleteDashboardModal({
  open,
  onOpenChange,
  dashboardId,
  dashboardName,
}: DeleteDashboardModalProps) {
  const handleSuccess = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DeleteDashboardProvider dashboardId={dashboardId} dashboardName={dashboardName} onSuccess={handleSuccess}>
          <ModalForm.Header />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <ModalForm.SubmitButton label="Delete" />
          </ModalForm.Footer>
        </DeleteDashboardProvider>
      </DialogContent>
    </Dialog>
  )
}
