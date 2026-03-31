import { DocumentEditorDialog, type DocumentEditorDialogProps } from './CollectionView.DocumentEditorDialog'

/** Dialog for editing an existing MongoDB document with JSON textarea. */
export function EditDocumentModal(
  props: Omit<DocumentEditorDialogProps, 'title' | 'submitLabel'>,
) {
  return (
    <DocumentEditorDialog
      title="Edit Document"
      submitLabel="Save Changes"
      {...props}
    />
  )
}
