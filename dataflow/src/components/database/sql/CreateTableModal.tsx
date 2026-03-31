import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Table, Plus, Trash2 } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import { resolveSchemaParam } from '@/utils/database-features'
import type { RecordInput } from '@graphql'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColumnDefinition {
  id: string
  name: string
  type: string
  isPrimaryKey: boolean
  isNullable: boolean
}

const COLUMN_TYPES = [
  'INT', 'VARCHAR(255)', 'TEXT', 'BOOLEAN', 'DATE', 'DATETIME', 'DECIMAL', 'FLOAT', 'JSON',
]

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CreateTableCtxValue {
  tableName: string
  setTableName: (v: string) => void
  columns: ColumnDefinition[]
  addColumn: () => void
  removeColumn: (id: string) => void
  updateColumn: (id: string, field: keyof ColumnDefinition, value: string | boolean) => void
}

const CreateTableCtx = createContext<CreateTableCtxValue | null>(null)

/** Hook to access CreateTable domain context. Throws outside provider. */
function useCreateTableCtx(): CreateTableCtxValue {
  const ctx = use(CreateTableCtx)
  if (!ctx) throw new Error('useCreateTableCtx must be used within CreateTableProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for creating a SQL table with column definitions. */
function CreateTableProvider({
  connectionId,
  databaseName,
  schema,
  onSuccess,
  children,
}: {
  connectionId: string
  databaseName: string
  schema?: string
  onSuccess?: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const { createTable, connections } = useConnectionStore()
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { id: '1', name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false },
  ])

  const addColumn = useCallback(() => {
    setColumns(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 11),
        name: '',
        type: 'VARCHAR(255)',
        isPrimaryKey: false,
        isNullable: true,
      },
    ])
  }, [])

  const removeColumn = useCallback((id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id))
  }, [])

  const updateColumn = useCallback(
    (id: string, field: keyof ColumnDefinition, value: string | boolean) => {
      setColumns(prev => prev.map(c => (c.id === id ? { ...c, [field]: value } : c)))
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    if (!tableName || columns.length === 0) return

    const conn = connections.find(c => c.id === connectionId)
    const schemaParam = resolveSchemaParam(conn?.type, databaseName, schema)
    const fields: RecordInput[] = columns.map(col => ({
      Key: col.name,
      Value: col.type,
      Extra: [
        { Key: 'Nullable', Value: col.isNullable ? 'true' : 'false' },
        { Key: 'Primary', Value: col.isPrimaryKey ? 'true' : 'false' },
      ],
    }))

    const result = await createTable(databaseName, schemaParam, tableName, fields)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? t('sql.common.unknownError'))
    }
  }, [tableName, columns, connections, connectionId, databaseName, schema, createTable, onSuccess, t])

  return (
    <CreateTableCtx value={{ tableName, setTableName, columns, addColumn, removeColumn, updateColumn }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: t('sql.createTable.title'), icon: Table }}
      >
        {children}
      </ModalForm.Provider>
    </CreateTableCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Input for the new table name. */
function CreateTableNameField() {
  const { t } = useI18n()
  const { tableName, setTableName } = useCreateTableCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t('sql.createTable.tableName')}
      </label>
      <Input
        value={tableName}
        onChange={(e) => setTableName(e.target.value)}
        placeholder={t('sql.createTable.tableNamePlaceholder')}
        disabled={state.isSubmitting}
        className="max-w-md"
      />
    </div>
  )
}

/** Editable table of column definitions with add/remove/update. */
function CreateTableColumnEditor() {
  const { t } = useI18n()
  const { columns, addColumn, removeColumn, updateColumn } = useCreateTableCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t('sql.createTable.columns')}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addColumn}
          disabled={state.isSubmitting}
          className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          {t('sql.createTable.addColumn')}
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">{t('sql.createTable.name')}</th>
              <th className="px-4 py-2 text-left font-medium">{t('sql.createTable.type')}</th>
              <th className="px-4 py-2 text-center font-medium w-20">{t('sql.createTable.pk')}</th>
              <th className="px-4 py-2 text-center font-medium w-20">{t('sql.createTable.null')}</th>
              <th className="px-4 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {columns.map(col => (
              <tr key={col.id} className="group hover:bg-muted/30">
                <td className="p-2">
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                    placeholder={t('sql.createTable.columnNamePlaceholder')}
                    disabled={state.isSubmitting}
                    className="w-full rounded border-transparent bg-transparent px-2 py-1 text-sm focus:border-primary focus:bg-background outline-none"
                  />
                </td>
                <td className="p-2">
                  <Select
                    value={col.type}
                    onValueChange={(v) => updateColumn(col.id, 'type', v)}
                    disabled={state.isSubmitting}
                  >
                    <SelectTrigger size="sm" className="w-full border-transparent bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMN_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={col.isPrimaryKey}
                    onCheckedChange={(checked) => updateColumn(col.id, 'isPrimaryKey', checked === true)}
                    disabled={state.isSubmitting}
                  />
                </td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={col.isNullable}
                    onCheckedChange={(checked) => updateColumn(col.id, 'isNullable', checked === true)}
                    disabled={state.isSubmitting}
                  />
                </td>
                <td className="p-2 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeColumn(col.id)}
                    disabled={state.isSubmitting}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Submit button disabled when table name or columns are empty. */
function CreateTableSubmitButton() {
  const { t } = useI18n()
  const { tableName, columns } = useCreateTableCtx()
  return <ModalForm.SubmitButton label={t('sql.createTable.submit')} disabled={!tableName || columns.length === 0} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface CreateTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  databaseName: string
  schema?: string
  onSuccess?: () => void
}

/** Modal for creating a SQL table with a dynamic column editor. */
export function CreateTableModal({
  open,
  onOpenChange,
  connectionId,
  databaseName,
  schema,
  onSuccess,
}: CreateTableModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <CreateTableProvider
          connectionId={connectionId}
          databaseName={databaseName}
          schema={schema}
          onSuccess={handleSuccess}
        >
          <ModalForm.Header />
          <div className="flex-1 overflow-y-auto space-y-6">
            <CreateTableNameField />
            <CreateTableColumnEditor />
          </div>
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <CreateTableSubmitButton />
          </ModalForm.Footer>
        </CreateTableProvider>
      </DialogContent>
    </Dialog>
  )
}
