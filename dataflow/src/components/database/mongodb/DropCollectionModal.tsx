import { useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { DropCollectionProvider, useDropCollectionCtx } from './DropCollectionProvider'

interface DropCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  collectionName: string
  onSuccess?: () => void
}

/** Modal for dropping a MongoDB collection with name confirmation. */
export function DropCollectionModal({
  open,
  onOpenChange,
  databaseName,
  collectionName,
  onSuccess,
}: DropCollectionModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DropCollectionProvider
          databaseName={databaseName}
          collectionName={collectionName}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <DropCollectionWarning />
          <DropCollectionConfirmation />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <DropCollectionSubmitButton />
          </ModalForm.Footer>
        </DropCollectionProvider>
      </DialogContent>
    </Dialog>
  )
}

/** Warning banner explaining the destructive action. */
function DropCollectionWarning() {
  const { collectionName } = useDropCollectionCtx()

  return (
    <div className="rounded-lg bg-destructive/5 p-4 text-sm border border-destructive/10">
      <p className="font-medium text-destructive">Warning: This action cannot be undone.</p>
      <p className="mt-1 text-muted-foreground">
        This will permanently drop the collection{' '}
        <strong className="text-foreground">{collectionName}</strong> and all its documents.
      </p>
    </div>
  )
}

/** Confirmation input — user must type the collection name to enable drop. */
function DropCollectionConfirmation() {
  const { confirmName, setConfirmName, collectionName } = useDropCollectionCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Type collection name to confirm
      </label>
      <Input
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder={collectionName}
        disabled={state.isSubmitting}
      />
    </div>
  )
}

/** Submit button disabled until confirmation name matches. */
function DropCollectionSubmitButton() {
  const { canDrop } = useDropCollectionCtx()
  return <ModalForm.SubmitButton label="Drop Collection" disabled={!canDrop} />
}
