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
import { useEditTable } from './EditTableProvider'
import { useI18n } from '@/i18n/useI18n'

const FK_ACTIONS = ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION', 'SET DEFAULT']

/**
 * Foreign keys tab for EditTableModal — batch editing with inline deletion marking.
 * Renders a table of foreign keys with name, column, ref table, ref column, on delete, on update, and a hover delete button.
 * Consumes `useEditTable()` for all state and actions.
 */
export function EditTableForeignKeysTab() {
  const { t } = useI18n()
  const { state, actions } = useEditTable()
  const { foreignKeys, columnNames, isExecuting } = state
  const { addForeignKey, updateForeignKey, toggleForeignKeyDeletion } = actions

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end">
        <Button
          variant="link"
          size="xs"
          onClick={addForeignKey}
          className="gap-1 text-primary"
        >
          <Plus className="h-3 w-3" />
          {t('sql.editTable.foreignKeys.add')}
        </Button>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t('sql.editTable.foreignKeys.name')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('sql.editTable.foreignKeys.column')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('sql.editTable.foreignKeys.refTable')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('sql.editTable.foreignKeys.refColumn')}</th>
              <th className="px-3 py-2 text-left font-medium w-24">{t('sql.editTable.foreignKeys.onDelete')}</th>
              <th className="px-3 py-2 text-left font-medium w-24">{t('sql.editTable.foreignKeys.onUpdate')}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {foreignKeys.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {t('sql.editTable.foreignKeys.empty')}
                </td>
              </tr>
            ) : (
              foreignKeys.map((fk) => (
                <tr
                  key={fk.id}
                  className={cn(
                    'group hover:bg-muted/30',
                    fk.isNew && !fk.isMarkedForDeletion && 'bg-primary/5',
                    fk.isMarkedForDeletion && 'bg-destructive/5 opacity-60',
                  )}
                >
                  <td className="p-2">
                    <Input
                      value={fk.name}
                      onChange={(e) => updateForeignKey(fk.id, 'name', e.target.value)}
                      className={cn(
                        'h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background',
                        fk.isMarkedForDeletion && 'line-through text-muted-foreground',
                      )}
                      placeholder={t('sql.editTable.foreignKeys.namePlaceholder')}
                      disabled={isExecuting || fk.isMarkedForDeletion}
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={fk.column}
                      onValueChange={(v) => updateForeignKey(fk.id, 'column', v)}
                      disabled={isExecuting || fk.isMarkedForDeletion}
                    >
                      <SelectTrigger size="sm" className={cn(
                        'w-full border-transparent bg-transparent text-xs',
                        fk.isMarkedForDeletion && 'line-through text-muted-foreground',
                      )}>
                        <SelectValue placeholder={t('sql.editTable.foreignKeys.columnPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {columnNames.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      value={fk.referencedTable}
                      onChange={(e) => updateForeignKey(fk.id, 'referencedTable', e.target.value)}
                      className={cn(
                        'h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background',
                        fk.isMarkedForDeletion && 'line-through text-muted-foreground',
                      )}
                      placeholder={t('sql.editTable.foreignKeys.refTablePlaceholder')}
                      disabled={isExecuting || fk.isMarkedForDeletion}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={fk.referencedColumn}
                      onChange={(e) => updateForeignKey(fk.id, 'referencedColumn', e.target.value)}
                      className={cn(
                        'h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background',
                        fk.isMarkedForDeletion && 'line-through text-muted-foreground',
                      )}
                      placeholder={t('sql.editTable.foreignKeys.refColumnPlaceholder')}
                      disabled={isExecuting || fk.isMarkedForDeletion}
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={fk.onDelete}
                      onValueChange={(v) => updateForeignKey(fk.id, 'onDelete', v)}
                      disabled={isExecuting || fk.isMarkedForDeletion}
                    >
                      <SelectTrigger size="sm" className={cn(
                        'w-full border-transparent bg-transparent text-xs',
                        fk.isMarkedForDeletion && 'line-through text-muted-foreground',
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FK_ACTIONS.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Select
                      value={fk.onUpdate}
                      onValueChange={(v) => updateForeignKey(fk.id, 'onUpdate', v)}
                      disabled={isExecuting || fk.isMarkedForDeletion}
                    >
                      <SelectTrigger size="sm" className={cn(
                        'w-full border-transparent bg-transparent text-xs',
                        fk.isMarkedForDeletion && 'line-through text-muted-foreground',
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FK_ACTIONS.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => toggleForeignKeyDeletion(fk)}
                      disabled={isExecuting}
                      className={cn(
                        'opacity-0 group-hover:opacity-100 transition-opacity',
                        fk.isMarkedForDeletion
                          ? 'opacity-100 text-destructive hover:text-destructive/80 hover:bg-destructive/5'
                          : 'text-muted-foreground hover:text-destructive hover:bg-destructive/5',
                      )}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
