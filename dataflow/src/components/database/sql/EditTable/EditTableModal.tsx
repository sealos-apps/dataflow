import { Table, Key, Link as LinkIcon, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
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
        className="w-full shrink-0 justify-start px-6 pt-4"
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

      <div className="flex-1 overflow-y-auto p-6">
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
  const { t } = useI18n()

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) onSuccess?.()
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0">
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
          <div className="shrink-0 px-6 pb-4">
            <ModalForm.Alert />
          </div>
          <DialogFooter className="shrink-0 border-t bg-muted/5 px-6 py-4">
            <Button variant="outline" onClick={() => handleClose(false)}>
              {t('sql.editTable.close')}
            </Button>
          </DialogFooter>
        </EditTableProvider>
      </DialogContent>
    </Dialog>
  )
}
