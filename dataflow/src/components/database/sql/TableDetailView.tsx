import { Table as TableIcon, Database } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TableViewProvider, useTableView } from './TableView/TableViewProvider'
import { TableViewToolbar } from './TableView/TableView.Toolbar'
import { TableViewDataGrid } from './TableView/TableView.DataGrid'
import { DataViewToolbar } from '@/components/database/shared/DataViewToolbar'
import { DataViewPagination } from '@/components/database/shared/DataViewPagination'
import { DataViewFilterBar } from '@/components/database/shared/DataViewFilterBar'
import { FilterTableModal } from './FilterTableModal'
import { ExportDataModal } from './ExportDataModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { AlertModal } from '@/components/ui/AlertModal'
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

function TableDetailViewContent({ connectionId, databaseName, tableName, schema }: TableDetailViewProps) {
  const { state, actions } = useTableView()

  if (state.error) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/5">
        <div className="text-center p-8 bg-background rounded-xl shadow-sm border">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">{state.error}</p>
          <Button variant="outline" className="mt-4" onClick={() => actions.handleSubmitRequest()}>
            Retry
          </Button>
        </div>
      </div>
    )
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
      <DataViewToolbar
        icon={TableIcon}
        title={`${databaseName}${schema ? `.${schema}` : ''}.${tableName}`}
        subtitle="TABLE VIEW"
      />

      <DataViewFilterBar
        filters={filterChips}
        onClearAll={() => actions.handleFilterApply(state.visibleColumns, [])}
      />

      <div className="flex-1 overflow-hidden bg-muted/5 p-6 flex flex-col">
        <div className="bg-background rounded-xl shadow-sm border border-border/50 overflow-hidden flex-1 flex flex-col">
          <TableViewToolbar />
          <TableViewDataGrid />

          {state.totalRows > 0 && (
            <DataViewPagination
              currentPage={state.currentPage}
              totalPages={state.totalPages}
              pageSize={state.pageSize}
              total={state.totalRows}
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
