import { Table as TableIcon, Plus, Download, RefreshCw } from 'lucide-react'
import { TableViewProvider, useTableView } from './TableView/TableViewProvider'
import { TableViewDataGrid } from './TableView/TableView.DataGrid'
import { DataView } from '@/components/database/shared/DataView'
import { ActionButton } from '@/components/ui/ActionButton'
import { SearchInput } from '@/components/ui/SearchInput'
import { FilterTableModal } from './FilterTableModal'
import { ExportDataModal } from './ExportDataModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { AlertModal } from '@/components/ui/AlertModal'
import { cn } from '@/lib/utils'
import type { FilterChip } from '@/components/database/shared/types'

interface TableDetailViewProps {
  connectionId: string
  databaseName: string
  tableName: string
  schema?: string
}

export function TableDetailView(props: TableDetailViewProps) {
  return (
    <TableViewProvider {...props}>
      <TableDetailViewContent {...props} />
    </TableViewProvider>
  )
}

function TableDetailViewContent({ databaseName, tableName, schema }: TableDetailViewProps) {
  const { state, actions } = useTableView()

  if (state.error) {
    return <DataView.Error message={state.error} onRetry={() => actions.handleSubmitRequest()} />
  }

  const filterChips: FilterChip[] = state.filterConditions.map((condition, idx) => ({
    id: condition.id,
    label: `${condition.column} ${condition.operator}`,
    value: ['IS NULL', 'IS NOT NULL'].includes(condition.operator) ? '' : condition.value,
    onRemove: () => {
      const remaining = state.filterConditions.filter((_, i) => i !== idx)
      actions.handleFilterApply(state.visibleColumns, remaining)
    },
  }))

  return (
    <div className="flex flex-col h-full bg-background">
      <DataView.Header
        icon={TableIcon}
        title={`${databaseName}${schema ? `.${schema}` : ''}.${tableName}`}
        subtitle="TABLE VIEW"
      />

      <DataView.FilterBar
        filters={filterChips}
        onClearAll={() => actions.handleFilterApply(state.visibleColumns, [])}
      />

      <div className="flex-1 overflow-hidden bg-muted/5 p-6 flex flex-col">
        <div className="bg-background rounded-xl shadow-sm border border-border/50 overflow-hidden flex-1 flex flex-col">
          {/* Action bar */}
          <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-card">
            <SearchInput
              value={state.searchTerm}
              onChange={(v) => actions.setSearchTerm(v)}
              onSubmit={actions.handleSearchSubmit}
            />
            <div className="flex items-center gap-2">
              {state.canEdit && (
                <>
                  <ActionButton onClick={actions.handleAddClick}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Data
                  </ActionButton>
                  <div className="h-4 w-px bg-border mx-1" />
                </>
              )}
              <DataView.FilterButton
                onClick={() => actions.setIsFilterModalOpen(true)}
                count={state.filterConditions.length}
              />
              <ActionButton variant="outline" onClick={() => actions.setShowExportModal(true)}>
                <Download className="h-3.5 w-3.5" />
                Export
              </ActionButton>
              <ActionButton variant="outline" onClick={actions.refresh} disabled={state.loading}>
                <div className={cn("flex items-center justify-center", state.loading && "animate-spin")}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </div>
                Refresh
              </ActionButton>
            </div>
          </div>

          <TableViewDataGrid />

          {state.total > 0 && (
            <DataView.Pagination
              currentPage={state.currentPage}
              totalPages={state.totalPages}
              pageSize={state.pageSize}
              total={state.total}
              loading={state.loading}
              onPageChange={actions.handlePageChange}
              onPageSizeChange={actions.handlePageSizeChange}
            />
          )}
        </div>
      </div>

      <FilterTableModal
        open={state.isFilterModalOpen}
        onOpenChange={actions.setIsFilterModalOpen}
        columns={state.data?.columns || []}
        initialSelectedColumns={state.visibleColumns}
        initialConditions={state.filterConditions}
        onApply={actions.handleFilterApply}
      />

      {state.showExportModal && (
        <ExportDataModal
          open={state.showExportModal}
          onOpenChange={(open) => { if (!open) actions.setShowExportModal(false) }}
          databaseName={databaseName}
          schema={schema}
          tableName={tableName}
        />
      )}

      <ConfirmationModal
        isOpen={state.showDeleteModal}
        onClose={() => actions.setShowDeleteModal(false)}
        onConfirm={actions.handleConfirmDelete}
        title="Delete Row"
        message="Warning: This action cannot be undone. This will permanently delete the selected row."
        confirmText="Delete Row"
        isDestructive={true}
        verificationText={state.deletingRowIndex !== null && state.data?.rows?.[state.deletingRowIndex] && state.primaryKey ? String(state.data.rows[state.deletingRowIndex][state.primaryKey]) : 'DELETE'}
        verificationLabel={state.deletingRowIndex !== null && state.data?.rows?.[state.deletingRowIndex] && state.primaryKey ? `Type "${String(state.data.rows[state.deletingRowIndex][state.primaryKey])}" to confirm` : 'Type confirmation'}
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
