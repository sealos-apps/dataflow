import { FileJson, Plus, Download, RefreshCw } from 'lucide-react'
import { CollectionViewProvider, useCollectionView } from './CollectionView/CollectionViewProvider'
import { CollectionViewDocumentList } from './CollectionView/CollectionView.DocumentList'
import { AddDocumentModal } from './CollectionView/CollectionView.AddDocumentModal'
import { EditDocumentModal } from './CollectionView/CollectionView.EditDocumentModal'
import { DataView } from '@/components/database/shared/DataView'
import { ActionButton } from '@/components/ui/ActionButton'
import { SearchInput } from '@/components/ui/SearchInput'
import { ExportCollectionModal } from './ExportCollectionModal'
import { FilterCollectionModal } from './FilterCollectionModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { AlertModal } from '@/components/ui/AlertModal'
import { cn } from '@/lib/utils'

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
    return <DataView.Loading />
  }

  if (state.error) {
    return <DataView.Error message={state.error} />
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <DataView.Header
        icon={FileJson}
        iconClassName="bg-purple-500/10"
        iconColor="text-purple-500"
        title={`${databaseName}.${collectionName}`}
        subtitle="COLLECTION VIEW"
      />

      {/* Action bar */}
      <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-card">
        <SearchInput
          value={state.searchTerm}
          onChange={(v) => actions.setSearchTerm(v)}
        />
        <div className="flex items-center gap-2">
          <ActionButton onClick={actions.handleAddClick}>
            <Plus className="h-3.5 w-3.5" />
            Add Data
          </ActionButton>
          <div className="h-4 w-px bg-border mx-1" />
          <DataView.FilterButton
            onClick={() => actions.setIsFilterModalOpen(true)}
            count={Object.keys(state.activeFilter).length}
          />
          <ActionButton variant="outline" onClick={() => actions.setShowExportModal(true)}>
            <Download className="h-3.5 w-3.5" />
            Export
          </ActionButton>
          <ActionButton variant="outline" onClick={actions.refresh} disabled={state.loading}>
            <div className={cn('flex items-center justify-center', state.loading && 'animate-spin')}>
              <RefreshCw className="h-3.5 w-3.5" />
            </div>
            Refresh
          </ActionButton>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4 bg-muted/5">
        <CollectionViewDocumentList />
      </div>

      {state.total > 0 && (
        <DataView.Pagination
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          pageSize={state.pageSize}
          total={state.total}
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
        open={state.isFilterModalOpen}
        onOpenChange={actions.setIsFilterModalOpen}
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

      {state.alert && (
        <AlertModal
          isOpen
          onClose={actions.closeAlert}
          {...state.alert}
        />
      )}
    </div>
  )
}
