import { DocumentEditorDialog, type DocumentEditorDialogProps } from './CollectionView.DocumentEditorDialog'
import { useI18n } from '@/i18n/useI18n'

/** Dialog for editing an existing MongoDB document with JSON textarea. */
export function EditDocumentModal(
  props: Omit<DocumentEditorDialogProps, 'title' | 'submitLabel'>,
) {
  const { t } = useI18n()

  return (
    <DocumentEditorDialog
      title={t('mongodb.document.editTitle')}
      submitLabel={t('mongodb.document.saveChanges')}
      {...props}
    />
  )
}
