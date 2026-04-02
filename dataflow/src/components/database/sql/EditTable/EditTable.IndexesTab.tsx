import { Plus, Save, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { useEditTable } from './EditTableProvider'
import { useI18n } from '@/i18n/useI18n'

/**
 * Indexes tab for EditTableModal — per-row save/delete for index definitions.
 * Renders a table of indexes with name, columns (MultiSelect), unique, and action buttons.
 * Consumes `useEditTable()` for all state and actions.
 */
export function EditTableIndexesTab() {
  const { t } = useI18n()
  const { state, actions } = useEditTable()
  const { indexes, columnNames, isExecuting } = state
  const { addIndex, updateIndex, saveIndex, removeIndex } = actions

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
              <th className="px-3 py-2 w-20">{t('sql.editTable.indexes.actions')}</th>
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
                  className={cn('group hover:bg-muted/30', idx.isNew && 'bg-primary/5')}
                >
                  <td className="p-2">
                    <Input
                      value={idx.name}
                      onChange={(e) => updateIndex(idx.id, 'name', e.target.value)}
                      className="h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background"
                      placeholder={t('sql.editTable.indexes.namePlaceholder')}
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <MultiSelect
                      options={columnNames}
                      selected={idx.columns}
                      onChange={(newCols) => updateIndex(idx.id, 'columns', newCols)}
                      placeholder={t('sql.editTable.indexes.columnsPlaceholder')}
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <Checkbox
                      checked={idx.isUnique}
                      onCheckedChange={(checked) => updateIndex(idx.id, 'isUnique', checked === true)}
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => saveIndex(idx)}
                            disabled={isExecuting}
                            className="text-primary hover:text-primary/80 hover:bg-primary/5"
                          >
                            {isExecuting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('sql.editTable.indexes.save')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeIndex(idx)}
                            disabled={isExecuting}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('sql.editTable.indexes.delete')}</TooltipContent>
                      </Tooltip>
                    </div>
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
