import { Table, Key, Link as LinkIcon, Loader2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ModalForm } from '@/components/ui/ModalForm'
import { EditTableProvider, useEditTable } from './EditTableProvider'
import { EditTableColumnsTab } from './EditTable.ColumnsTab'
import { EditTableIndexesTab } from './EditTable.IndexesTab'
import { EditTableForeignKeysTab } from './EditTable.ForeignKeysTab'
import { useI18n } from '@/i18n/useI18n'

// ---------------------------------------------------------------------------
// Internal composition component
// ---------------------------------------------------------------------------

/** Renders the tabbed content area, consuming EditTable context. */
function EditTableContent() {
  const { t } = useI18n()
  const { state, actions } = useEditTable()

  return (
    <Tabs
      value={state.activeTab}
      onValueChange={(v) => actions.setActiveTab(v as typeof state.activeTab)}
      className="flex-1 flex flex-col min-h-0"
    >
      <TabsList
        variant="line"
        className="w-full shrink-0 justify-start px-6"
      >
        <TabsTrigger value="fields">
          <Table />
          {t('sql.editTable.tabs.fields')} ({state.columns.length})
        </TabsTrigger>
        <TabsTrigger value="indexes">
          <Key />
          {t('sql.editTable.tabs.indexes')} ({state.indexes.length})
        </TabsTrigger>
        <TabsTrigger value="foreignKeys">
          <LinkIcon />
          {t('sql.editTable.tabs.foreignKeys')} ({state.foreignKeys.length})
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0 px-6">
        {state.isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="fields">
              <EditTableColumnsTab />
            </TabsContent>
            <TabsContent value="indexes">
              <EditTableIndexesTab />
            </TabsContent>
            <TabsContent value="foreignKeys">
              <EditTableForeignKeysTab />
            </TabsContent>
          </>
        )}
      </div>
    </Tabs>
  )
}

/** Footer with Apply Changes and Close buttons. */
function EditTableFooter({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const { state, actions } = useEditTable()
  const { pendingChangeCount, isExecuting } = state

  return (
    <ModalForm.Footer className="shrink-0 border-t bg-muted/5 px-6 py-4">
      <Button variant="outline" onClick={onClose} disabled={isExecuting}>
        {t('sql.editTable.close')}
      </Button>
      <Button
        onClick={actions.applyAllChanges}
        disabled={isExecuting || pendingChangeCount === 0}
      >
        {isExecuting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        {t('sql.editTable.applyChanges')}
        {pendingChangeCount > 0 && ` (${pendingChangeCount})`}
      </Button>
    </ModalForm.Footer>
  )
}

// ---------------------------------------------------------------------------
// Exported modal
// ---------------------------------------------------------------------------

interface EditTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  databaseName: string
  tableName: string
  schema?: string
  onSuccess?: () => void
}

/**
 * Modal for editing an existing SQL table's columns, indexes, and foreign keys.
 * Calls `onSuccess` when closed so the caller can refresh its schema view.
 */
export function EditTableModal({
  open,
  onOpenChange,
  connectionId,
  databaseName,
  tableName,
  schema,
  onSuccess,
}: EditTableModalProps) {
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) onSuccess?.()
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-5xl min-h-[50vh] max-h-[90vh] flex flex-col p-0">
        <EditTableProvider
          connectionId={connectionId}
          databaseName={databaseName}
          tableName={tableName}
          schema={schema}
        >
          <div className="shrink-0 px-6 pt-6">
            <ModalForm.Header />
          </div>
          <EditTableContent />
          <ModalForm.Alert className="shrink-0 mx-6" />
          <EditTableFooter onClose={() => handleClose(false)} />
        </EditTableProvider>
      </DialogContent>
    </Dialog>
  )
}
