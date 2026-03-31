import { DocumentEditorDialog, type DocumentEditorDialogProps } from './CollectionView.DocumentEditorDialog'

/** Dialog for adding a new MongoDB document with JSON textarea input. */
export function AddDocumentModal(
  props: Omit<DocumentEditorDialogProps, 'title' | 'submitLabel' | 'description' | 'placeholder'>,
) {
  return (
    <DocumentEditorDialog
      title="Add New Document"
      submitLabel="Add Document"
      description="Enter the document content in JSON format:"
      placeholder="{ ... }"
      {...props}
    />
  )
}
