import { List } from 'lucide-react'
import { RedisViewProvider, useRedisView } from './RedisView/RedisViewProvider'
import { RedisViewToolbar } from './RedisView/RedisView.Toolbar'
import { RedisViewFilterBar } from './RedisView/RedisView.FilterBar'
import { RedisViewKeyList } from './RedisView/RedisView.KeyList'
import { DataViewToolbar } from '@/components/database/shared/DataViewToolbar'
import { DataViewPagination } from '@/components/database/shared/DataViewPagination'
import { RedisKeyModal } from './RedisKeyModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { ExportRedisModal } from './ExportRedisModal'
import { AlertModal } from '@/components/ui/AlertModal'
import { RedisFilterModal } from './RedisFilterModal'

interface RedisDetailViewProps {
  connectionId: string
  databaseName: string
}

/** Redis key browser composed from Provider + subcomponents. */
export function RedisDetailView(props: RedisDetailViewProps) {
  return (
    <RedisViewProvider {...props}>
      <RedisDetailViewContent {...props} />
    </RedisViewProvider>
  )
}

/** Inner content rendered within the RedisViewProvider context. */
function RedisDetailViewContent({ connectionId, databaseName }: RedisDetailViewProps) {
  const { state, actions } = useRedisView()

  return (
    <div className="flex flex-col h-full bg-background">
      <DataViewToolbar
        icon={List}
        iconClassName="bg-blue-500/10"
        iconColor="text-blue-600"
        title={databaseName}
        subtitle="REDIS KEY VIEW"
        count={state.total}
      >
        <RedisViewToolbar />
      </DataViewToolbar>

      <RedisViewFilterBar />
      <RedisViewKeyList />

      {state.total > 0 && (
        <DataViewPagination
          currentPage={state.page}
          totalPages={state.totalPages}
          pageSize={state.pageSize}
          total={state.total}
          loading={state.isLoading}
          itemLabel="keys"
          onPageChange={actions.handlePageChange}
          onPageSizeChange={actions.handlePageSizeChange}
        />
      )}

      <RedisKeyModal
        open={state.isAddModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            actions.setIsAddModalOpen(false)
            actions.setEditingKey(undefined)
          }
        }}
        onSave={actions.handleSaveKey}
        initialData={state.editingKey}
      />

      <ConfirmationModal
        isOpen={!!state.deletingKey}
        onClose={() => actions.setDeletingKey(undefined)}
        onConfirm={actions.handleConfirmDelete}
        title="Delete Key"
        message={`Are you sure you want to delete key "${state.deletingKey?.key ?? ''}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive
      />

      <ExportRedisModal
        open={state.showExportModal}
        onOpenChange={actions.setShowExportModal}
        connectionId={connectionId}
        databaseName={databaseName}
        initialPattern={state.pattern}
        initialTypes={state.filterTypes}
      />

      <AlertModal
        isOpen={state.alertState.isOpen}
        onClose={actions.closeAlert}
        title={state.alertState.title}
        message={state.alertState.message}
        type={state.alertState.type}
      />

      <RedisFilterModal
        open={state.isFilterModalOpen}
        onOpenChange={actions.setIsFilterModalOpen}
        onApply={actions.handleApplyFilter}
        initialPattern={state.pattern}
        initialTypes={state.filterTypes}
      />
    </div>
  )
}
