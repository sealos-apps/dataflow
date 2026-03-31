import { useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import { CreateCollectionProvider, useCreateCollectionCtx } from './CreateCollectionProvider'

interface CreateCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  databaseName: string
  onSuccess?: () => void
}

/** Modal for creating a MongoDB collection using the composition pattern. */
export function CreateCollectionModal({
  open,
  onOpenChange,
  connectionId,
  databaseName,
  onSuccess,
}: CreateCollectionModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CreateCollectionProvider
          connectionId={connectionId}
          databaseName={databaseName}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <CreateCollectionFields />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <CreateCollectionSubmitButton />
          </ModalForm.Footer>
        </CreateCollectionProvider>
      </DialogContent>
    </Dialog>
  )
}

/** Input field for the new collection name. */
function CreateCollectionFields() {
  const { t } = useI18n()
  const { collectionName, setCollectionName } = useCreateCollectionCtx()
  const { state, actions } = useModalForm()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t('mongodb.collection.name')}
      </label>
      <Input
        value={collectionName}
        onChange={(e) => setCollectionName(e.target.value)}
        placeholder={t('mongodb.collection.namePlaceholder')}
        disabled={state.isSubmitting}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && collectionName && !state.isSubmitting) {
            actions.submit?.()
          }
        }}
      />
    </div>
  )
}

/** Submit button disabled when collection name is empty. */
function CreateCollectionSubmitButton() {
  const { t } = useI18n()
  const { collectionName } = useCreateCollectionCtx()
  return <ModalForm.SubmitButton label={t('mongodb.collection.createAction')} disabled={!collectionName} />
}
