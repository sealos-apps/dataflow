import { useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
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
  const { t } = useI18n()
  const { collectionName } = useDropCollectionCtx()

  return (
    <div className="rounded-lg bg-destructive/5 p-4 text-sm border border-destructive/10">
      <p className="font-medium text-destructive">{t('mongodb.collection.warningTitle')}</p>
      <p className="mt-1 text-muted-foreground">
        {t('mongodb.collection.warningMessage', { collectionName })}
      </p>
    </div>
  )
}

/** Confirmation input — user must type the collection name to enable drop. */
function DropCollectionConfirmation() {
  const { t } = useI18n()
  const { confirmName, setConfirmName, collectionName } = useDropCollectionCtx()
  const { state } = useModalForm()

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {t('mongodb.collection.confirmName')}
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
  const { t } = useI18n()
  const { canDrop } = useDropCollectionCtx()
  return <ModalForm.SubmitButton label={t('mongodb.collection.drop')} disabled={!canDrop} />
}
