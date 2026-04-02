import { Plus, Save, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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
 * Foreign keys tab for EditTableModal — per-row save/delete for FK definitions.
 * Renders a table of foreign keys with name, column, ref table, ref column, on delete, on update, and action buttons.
 * Consumes `useEditTable()` for all state and actions.
 */
export function EditTableForeignKeysTab() {
  const { t } = useI18n()
  const { state, actions } = useEditTable()
  const { foreignKeys, columnNames, isExecuting } = state
  const { addForeignKey, updateForeignKey, saveForeignKey, removeForeignKey } = actions

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
              <th className="px-3 py-2 w-20">{t('sql.editTable.foreignKeys.actions')}</th>
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
                  className={cn('group hover:bg-muted/30', fk.isNew && 'bg-primary/5')}
                >
                  <td className="p-2">
                    <Input
                      value={fk.name}
                      onChange={(e) => updateForeignKey(fk.id, 'name', e.target.value)}
                      className="h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background"
                      placeholder={t('sql.editTable.foreignKeys.namePlaceholder')}
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={fk.column}
                      onValueChange={(v) => updateForeignKey(fk.id, 'column', v)}
                      disabled={isExecuting}
                    >
                      <SelectTrigger size="sm" className="w-full border-transparent bg-transparent text-xs">
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
                      className="h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background"
                      placeholder={t('sql.editTable.foreignKeys.refTablePlaceholder')}
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={fk.referencedColumn}
                      onChange={(e) => updateForeignKey(fk.id, 'referencedColumn', e.target.value)}
                      className="h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background"
                      placeholder={t('sql.editTable.foreignKeys.refColumnPlaceholder')}
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={fk.onDelete}
                      onValueChange={(v) => updateForeignKey(fk.id, 'onDelete', v)}
                      disabled={isExecuting}
                    >
                      <SelectTrigger size="sm" className="w-full border-transparent bg-transparent text-xs">
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
                      disabled={isExecuting}
                    >
                      <SelectTrigger size="sm" className="w-full border-transparent bg-transparent text-xs">
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
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => saveForeignKey(fk)}
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
                        <TooltipContent>{t('sql.editTable.foreignKeys.save')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeForeignKey(fk)}
                            disabled={isExecuting}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('sql.editTable.foreignKeys.delete')}</TooltipContent>
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
