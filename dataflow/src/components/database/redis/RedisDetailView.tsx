import { RedisViewProvider, useRedisView } from './RedisView/RedisViewProvider'
import { RedisViewFilterBar } from './RedisView/RedisView.FilterBar'
import { RedisViewToolbar } from './RedisView/RedisView.Toolbar'
import { RedisViewKeyList } from './RedisView/RedisView.KeyList'
import { DataView } from '@/components/database/shared/DataView'
import { RedisKeyModal } from './RedisKeyModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { ExportRedisModal } from './ExportRedisModal'
import { AlertModal } from '@/components/ui/AlertModal'
import { RedisFilterModal } from './RedisFilterModal'
import { useI18n } from '@/i18n/useI18n'

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
  const { t } = useI18n()
  const { state, actions } = useRedisView()

  return (
    <div className="flex flex-col h-full bg-background">
      <RedisViewToolbar connectionId={connectionId} databaseName={databaseName} />

      <RedisViewFilterBar />
      <RedisViewKeyList />

      {state.total > 0 && (
        <DataView.Pagination
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          pageSize={state.pageSize}
          total={state.total}
          loading={state.loading}
          itemLabel={t('redis.pagination.keys')}
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
        title={t('redis.delete.title')}
        message={t('redis.delete.message', { key: state.deletingKey?.key ?? '' })}
        confirmText={t('redis.delete.confirmText')}
        isDestructive
      />

      <ExportRedisModal
        open={state.showExportModal}
        onOpenChange={actions.setShowExportModal}
        connectionId={connectionId}
        databaseName={databaseName}
        keys={state.filteredKeys}
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
