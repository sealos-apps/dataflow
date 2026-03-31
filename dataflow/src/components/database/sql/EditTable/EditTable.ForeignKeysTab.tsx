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
import { useEditTable } from './EditTableProvider'

const FK_ACTIONS = ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION', 'SET DEFAULT']

/**
 * Foreign keys tab for EditTableModal — per-row save/delete for FK definitions.
 * Renders a table of foreign keys with name, column, ref table, ref column, on delete, on update, and action buttons.
 * Consumes `useEditTable()` for all state and actions.
 */
export function EditTableForeignKeysTab() {
  const { state, actions } = useEditTable()
  const { foreignKeys, columnNames, isExecuting } = state
  const { addForeignKey, updateForeignKey, saveForeignKey, removeForeignKey } = actions

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button
          variant="link"
          size="xs"
          onClick={addForeignKey}
          className="gap-1 text-primary"
        >
          <Plus className="h-3 w-3" />
          Add Foreign Key
        </Button>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Column</th>
              <th className="px-3 py-2 text-left font-medium">Ref Table</th>
              <th className="px-3 py-2 text-left font-medium">Ref Column</th>
              <th className="px-3 py-2 text-left font-medium w-24">On Delete</th>
              <th className="px-3 py-2 text-left font-medium w-24">On Update</th>
              <th className="px-3 py-2 w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {foreignKeys.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No foreign keys found
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
                      placeholder="FK Name"
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
                        <SelectValue placeholder="Select Column" />
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
                      placeholder="Table name"
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={fk.referencedColumn}
                      onChange={(e) => updateForeignKey(fk.id, 'referencedColumn', e.target.value)}
                      className="h-auto border-transparent bg-transparent px-2 py-1 shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:bg-background"
                      placeholder="Column name"
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
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => saveForeignKey(fk)}
                        disabled={isExecuting}
                        className="text-primary hover:text-primary/80 hover:bg-primary/5"
                        title="Save Foreign Key"
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
                        onClick={() => removeForeignKey(fk)}
                        disabled={isExecuting}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        title="Delete Foreign Key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
