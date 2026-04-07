import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { useEditTable } from './EditTableProvider'
import { useI18n } from '@/i18n/useI18n'

/**
 * Indexes tab for EditTableModal — batch editing with inline deletion marking.
 * Renders a table of indexes with name, columns (MultiSelect), unique, and a hover delete button.
 * Consumes `useEditTable()` for all state and actions.
 */
export function EditTableIndexesTab() {
  const { t } = useI18n()
  const { state, actions } = useEditTable()
  const { indexes, columnNames, isExecuting } = state
  const { addIndex, updateIndex, toggleIndexDeletion } = actions

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end">
        <Button
          variant="link"
          size="xs"
          onClick={addIndex}
          className="gap-1 text-primary"
        >
          <Plus className="h-3 w-3" />
          {t('sql.editTable.indexes.addIndex')}
        </Button>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t('sql.editTable.indexes.name')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('sql.editTable.indexes.columns')}</th>
              <th className="px-3 py-2 text-center font-medium w-16">{t('sql.editTable.indexes.unique')}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {indexes.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  {t('sql.editTable.indexes.empty')}
                </td>
              </tr>
            ) : (
              indexes.map((idx) => (
                <tr
                  key={idx.id}
                  className={cn(
                    'group hover:bg-muted/30',
                    idx.isNew && !idx.isMarkedForDeletion && 'bg-primary/5',
                    idx.isMarkedForDeletion && 'bg-destructive/5 opacity-60',
                  )}
                >
                  <td className="p-2">
                    <Input
                      value={idx.name}
                      onChange={(e) => updateIndex(idx.id, 'name', e.target.value)}
                      className={cn(
                        'h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background',
                        idx.isMarkedForDeletion && 'line-through text-muted-foreground',
                      )}
                      placeholder={t('sql.editTable.indexes.namePlaceholder')}
                      disabled={isExecuting || idx.isMarkedForDeletion}
                    />
                  </td>
                  <td className="p-2">
                    <MultiSelect
                      options={columnNames}
                      selected={idx.columns}
                      onChange={(newCols) => updateIndex(idx.id, 'columns', newCols)}
                      placeholder={t('sql.editTable.indexes.columnsPlaceholder')}
                      disabled={isExecuting || idx.isMarkedForDeletion}
                    />
                  </td>
                  <td className="p-2">
                    <Checkbox
                      checked={idx.isUnique}
                      onCheckedChange={(checked) => updateIndex(idx.id, 'isUnique', checked === true)}
                      disabled={isExecuting || idx.isMarkedForDeletion}
                    />
                  </td>
                  <td className="p-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => toggleIndexDeletion(idx)}
                      disabled={isExecuting}
                      className={cn(
                        'opacity-0 group-hover:opacity-100 transition-opacity',
                        idx.isMarkedForDeletion
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
