import { List, Plus, Download, RefreshCw } from 'lucide-react'
import { RedisViewProvider, useRedisView } from './RedisView/RedisViewProvider'
import { RedisViewFilterBar } from './RedisView/RedisView.FilterBar'
import { RedisViewKeyList } from './RedisView/RedisView.KeyList'
import { DataView } from '@/components/database/shared/DataView'
import { ActionButton } from '@/components/ui/ActionButton'
import { RedisKeyModal } from './RedisKeyModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { ExportRedisModal } from './ExportRedisModal'
import { AlertModal } from '@/components/ui/AlertModal'
import { RedisFilterModal } from './RedisFilterModal'
import { cn } from '@/lib/utils'

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
      <DataView.Header
        icon={List}
        iconClassName="bg-blue-500/10"
        iconColor="text-blue-600"
        title={databaseName}
        subtitle="REDIS KEY VIEW"
        count={state.total}
      >
        <ActionButton onClick={actions.openAddModal}>
          <Plus className="h-3.5 w-3.5" />
          Add Key
        </ActionButton>
        <div className="h-4 w-px bg-border mx-1" />
        <DataView.FilterButton onClick={() => actions.setIsFilterModalOpen(true)} />
        <ActionButton variant="outline" onClick={() => actions.setShowExportModal(true)}>
          <Download className="h-3.5 w-3.5" />
          Export
        </ActionButton>
        <ActionButton variant="outline" onClick={() => actions.refresh()} disabled={state.loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", state.loading && "animate-spin")} />
          Refresh
        </ActionButton>
      </DataView.Header>

      <RedisViewFilterBar />
      <RedisViewKeyList />

      {state.total > 0 && (
        <DataView.Pagination
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          pageSize={state.pageSize}
          total={state.total}
          loading={state.loading}
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

      {state.alert && (
        <AlertModal
          isOpen
          onClose={actions.closeAlert}
          {...state.alert}
        />
      )}

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
