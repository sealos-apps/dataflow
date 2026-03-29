import { Plus, Save, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useEditTable } from './EditTableProvider'

const COLUMN_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
  'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(255)', 'VARCHAR(500)',
  'TEXT', 'LONGTEXT', 'MEDIUMTEXT',
  'BOOLEAN', 'BIT',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
  'DECIMAL(10,2)', 'DECIMAL(18,4)', 'FLOAT', 'DOUBLE',
  'JSON', 'BLOB',
]

/**
 * Columns tab for EditTableModal — per-row save/delete for column definitions.
 * Renders a table of columns with name, type, PK, nullable, comment, and action buttons.
 * Consumes `useEditTable()` for all state and actions.
 */
export function EditTableColumnsTab() {
  const { state, actions } = useEditTable()
  const { columns, isExecuting } = state
  const { addColumn, updateColumn, saveColumn, removeColumn } = actions

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button
          variant="link"
          size="xs"
          onClick={addColumn}
          className="gap-1 text-primary"
        >
          <Plus className="h-3 w-3" />
          Add Field
        </Button>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-center font-medium w-14">PK</th>
              <th className="px-3 py-2 text-center font-medium w-14">Null</th>
              <th className="px-3 py-2 text-left font-medium">Comment</th>
              <th className="px-3 py-2 w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {columns.map((col) => (
              <tr
                key={col.id}
                className={cn('group hover:bg-muted/30', col.isNew && 'bg-primary/5')}
              >
                <td className="p-2">
                  <Input
                    value={col.name}
                    onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                    className="h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background"
                    placeholder="Column Name"
                    disabled={isExecuting}
                  />
                </td>
                <td className="p-2">
                  <Select
                    value={col.type}
                    onValueChange={(v) => updateColumn(col.id, 'type', v)}
                    disabled={isExecuting}
                  >
                    <SelectTrigger size="sm" className="w-full border-transparent bg-transparent text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMN_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={col.isPrimaryKey}
                    onCheckedChange={(checked) => updateColumn(col.id, 'isPrimaryKey', checked === true)}
                    disabled={isExecuting}
                  />
                </td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={col.isNullable}
                    onCheckedChange={(checked) => updateColumn(col.id, 'isNullable', checked === true)}
                    disabled={isExecuting}
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={col.comment}
                    onChange={(e) => updateColumn(col.id, 'comment', e.target.value)}
                    className="h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background text-muted-foreground text-xs"
                    placeholder="Comment..."
                    disabled={isExecuting}
                  />
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => saveColumn(col)}
                      disabled={isExecuting}
                      className="text-primary hover:text-primary/80 hover:bg-primary/5"
                      title="Save Column"
                    >
                      {isExecuting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeColumn(col)}
                      disabled={isExecuting}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                      title="Delete Column"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
