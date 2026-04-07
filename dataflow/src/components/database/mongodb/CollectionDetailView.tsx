import { useMemo } from 'react'
import { CollectionViewProvider, useCollectionView } from './CollectionView/CollectionViewProvider'
import { CollectionViewDocumentList } from './CollectionView/CollectionView.DocumentList'
import { CollectionViewToolbar } from './CollectionView/CollectionView.Toolbar'
import { AddDocumentModal } from './CollectionView/CollectionView.AddDocumentModal'
import { EditDocumentModal } from './CollectionView/CollectionView.EditDocumentModal'
import { DataView } from '@/components/database/shared/DataView'
import { FindBar } from '@/components/database/shared/FindBar'
import { ExportCollectionModal } from './ExportCollectionModal'
import { FilterCollectionModal } from './FilterCollectionModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { AlertModal } from '@/components/ui/AlertModal'
import { useI18n } from '@/i18n/useI18n'

interface CollectionDetailViewProps {
  connectionId: string
  databaseName: string
  collectionName: string
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
  const { t } = useI18n()
  const { state, actions } = useCollectionView()

  if (state.loading && !state.documents.length && !state.showAddModal) {
    return <DataView.Loading />
  }

  if (state.error) {
    return <DataView.Error message={state.error} />
  }

  /** Extract all top-level field names from visible documents for FindBar. */
  const docColumns = useMemo(() => {
    const keys = new Set<string>()
    state.documents.forEach((doc) => {
      if (typeof doc === 'object' && doc !== null) {
        Object.keys(doc).forEach((k) => keys.add(k))
      }
    })
    return Array.from(keys)
  }, [state.documents])

  return (
    <div className="flex flex-col h-full bg-background">
      <CollectionViewToolbar connectionId={connectionId} databaseName={databaseName} collectionName={collectionName} />

      <FindBar.Provider
        rows={state.documents}
        columns={docColumns}
        searchTerm={state.searchTerm}
        onSearchTermChange={actions.setSearchTerm}
      >
        <FindBar.Bar />
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <CollectionViewDocumentList />
        </div>
      </FindBar.Provider>

      {state.total > 0 && (
        <DataView.Pagination
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          pageSize={state.pageSize}
          total={state.total}
          loading={state.loading}
          itemLabel={t('mongodb.collection.documents')}
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
        title={t('mongodb.collection.deleteDocumentTitle')}
        message={t('mongodb.collection.deleteDocumentMessage')}
        confirmText={t('mongodb.document.delete')}
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
