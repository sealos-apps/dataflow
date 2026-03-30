import { FileJson, Database, Loader2 } from 'lucide-react'
import { CollectionViewProvider, useCollectionView } from './CollectionView/CollectionViewProvider'
import { CollectionViewToolbar } from './CollectionView/CollectionView.Toolbar'
import { CollectionViewDocumentList } from './CollectionView/CollectionView.DocumentList'
import { AddDocumentModal } from './CollectionView/CollectionView.AddDocumentModal'
import { EditDocumentModal } from './CollectionView/CollectionView.EditDocumentModal'
import { DataViewToolbar } from '@/components/database/shared/DataViewToolbar'
import { DataViewPagination } from '@/components/database/shared/DataViewPagination'
import { ExportCollectionModal } from './ExportCollectionModal'
import { FilterCollectionModal } from './FilterCollectionModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { AlertModal } from '@/components/ui/AlertModal'

interface CollectionDetailViewProps {
  connectionId: string
  databaseName: string
  collectionName: string
  refreshTrigger?: number
}

/** MongoDB collection detail view composed from Provider + subcomponents. */
export function CollectionDetailView(props: CollectionDetailViewProps) {
  return (
    <CollectionViewProvider {...props}>
      <CollectionDetailViewContent {...props} />
    </CollectionViewProvider>
  )
}

/** Inner content rendered within the CollectionViewProvider context. */
function CollectionDetailViewContent({ databaseName, collectionName, connectionId }: CollectionDetailViewProps) {
  const { state, actions } = useCollectionView()

  if (state.loading && !state.documents.length && !state.showAddModal) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/5">
        <div className="text-center p-8 bg-background rounded-xl shadow-sm border">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">{state.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <DataViewToolbar
        icon={FileJson}
        iconClassName="bg-purple-500/10"
        iconColor="text-purple-500"
        title={`${databaseName}.${collectionName}`}
        subtitle="COLLECTION VIEW"
      />

      <CollectionViewToolbar />

      <div className="flex-1 overflow-auto p-6 space-y-4 bg-muted/5">
        <CollectionViewDocumentList />
      </div>

      {state.totalDocuments > 0 && (
        <DataViewPagination
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          pageSize={state.pageSize}
          total={state.totalDocuments}
          loading={state.loading}
          itemLabel="documents"
          onPageChange={actions.handlePageChange}
          onPageSizeChange={actions.handlePageSizeChange}
        />
      )}

      <AddDocumentModal
        open={state.showAddModal}
        onOpenChange={actions.setShowAddModal}
        content={state.addContent}
        onContentChange={actions.setAddContent}
        onSave={actions.handleAddSave}
      />

      <EditDocumentModal
        open={state.editingDoc !== null}
        onOpenChange={(open) => {
          if (!open) actions.setEditingDoc(null)
        }}
        content={state.editContent}
        onContentChange={actions.setEditContent}
        onSave={actions.handleSave}
      />

      <ExportCollectionModal
        open={state.showExportModal}
        onOpenChange={(open) => {
          if (!open) actions.setShowExportModal(false)
        }}
        connectionId={connectionId}
        databaseName={databaseName}
        collectionName={collectionName}
      />

      <FilterCollectionModal
        open={state.showFilterModal}
        onOpenChange={actions.setShowFilterModal}
        onApply={actions.handleFilterApply}
        fields={state.availableFields}
        initialFilter={state.activeFilter}
      />

      <ConfirmationModal
        isOpen={state.showDeleteModal}
        onClose={() => actions.setShowDeleteModal(false)}
        onConfirm={actions.handleConfirmDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        isDestructive
      />

      <AlertModal
        isOpen={state.alertState.isOpen}
        onClose={actions.closeAlert}
        title={state.alertState.title}
        message={state.alertState.message}
        type={state.alertState.type}
      />
    </div>
  )
}
