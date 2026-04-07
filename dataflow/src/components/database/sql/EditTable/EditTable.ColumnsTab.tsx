import { Plus, X } from 'lucide-react'
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
import { useI18n } from '@/i18n/useI18n'

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
 * Columns tab for EditTableModal — batch editing with inline deletion marking.
 * Renders a table of columns with name, type, nullable, and a hover delete button.
 * Consumes `useEditTable()` for all state and actions.
 */
export function EditTableColumnsTab() {
  const { t } = useI18n()
  const { state, actions } = useEditTable()
  const { columns, isExecuting } = state
  const { addColumn, updateColumn, toggleColumnDeletion } = actions

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end">
        <Button
          variant="link"
          size="xs"
          onClick={addColumn}
          className="gap-1 text-primary"
        >
          <Plus className="h-3 w-3" />
          {t('sql.editTable.columns.addField')}
        </Button>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t('sql.editTable.columns.name')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('sql.editTable.columns.type')}</th>
              <th className="px-3 py-2 text-center font-medium w-14">{t('sql.editTable.columns.null')}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {columns.map((col) => (
              <tr
                key={col.id}
                className={cn(
                  'group hover:bg-muted/30 relative',
                  col.isNew && !col.isMarkedForDeletion && 'bg-primary/5',
                  col.isMarkedForDeletion && 'bg-destructive/5 opacity-60',
                )}
              >
                <td className="p-2">
                  <Input
                    value={col.name}
                    onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                    readOnly={!col.isNew}
                    className={cn(
                      'h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background',
                      col.isMarkedForDeletion && 'line-through text-muted-foreground',
                    )}
                    placeholder={t('sql.editTable.columns.columnNamePlaceholder')}
                    disabled={isExecuting || col.isMarkedForDeletion}
                  />
                </td>
                <td className="p-2">
                  <Select
                    value={col.type}
                    onValueChange={(v) => updateColumn(col.id, 'type', v)}
                    disabled={isExecuting || col.isMarkedForDeletion}
                  >
                    <SelectTrigger size="sm" className={cn(
                      'w-full bg-transparent text-xs',
                      col.isMarkedForDeletion && 'line-through text-muted-foreground',
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {col.type && !COLUMN_TYPES.includes(col.type) && (
                        <SelectItem value={col.type}>{col.type}</SelectItem>
                      )}
                      {COLUMN_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={col.isNullable}
                    onCheckedChange={(checked) => updateColumn(col.id, 'isNullable', checked === true)}
                    disabled={isExecuting || col.isMarkedForDeletion}
                  />
                </td>
                <td className="p-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggleColumnDeletion(col)}
                    disabled={isExecuting}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 transition-opacity',
                      col.isMarkedForDeletion
                        ? 'opacity-100 text-destructive hover:text-destructive/80 hover:bg-destructive/5'
                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/5',
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
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
