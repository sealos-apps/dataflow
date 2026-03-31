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
import { MultiSelect } from '@/components/ui/MultiSelect'
import { useEditTable } from './EditTableProvider'

const INDEX_TYPES = ['BTREE', 'HASH', 'FULLTEXT', 'SPATIAL']

/**
 * Indexes tab for EditTableModal — per-row save/delete for index definitions.
 * Renders a table of indexes with name, columns (MultiSelect), type, unique, comment, and action buttons.
 * Consumes `useEditTable()` for all state and actions.
 */
export function EditTableIndexesTab() {
  const { state, actions } = useEditTable()
  const { indexes, columnNames, isExecuting } = state
  const { addIndex, updateIndex, saveIndex, removeIndex } = actions

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button
          variant="link"
          size="xs"
          onClick={addIndex}
          className="gap-1 text-primary"
        >
          <Plus className="h-3 w-3" />
          Add Index
        </Button>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Columns</th>
              <th className="px-3 py-2 text-left font-medium w-24">Type</th>
              <th className="px-3 py-2 text-center font-medium w-16">Unique</th>
              <th className="px-3 py-2 text-left font-medium">Comment</th>
              <th className="px-3 py-2 w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {indexes.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No indexes found
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
                      placeholder="Index Name"
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <MultiSelect
                      options={columnNames}
                      selected={idx.columns}
                      onChange={(newCols) => updateIndex(idx.id, 'columns', newCols)}
                      placeholder="Select columns..."
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={idx.type}
                      onValueChange={(v) => updateIndex(idx.id, 'type', v)}
                      disabled={isExecuting}
                    >
                      <SelectTrigger size="sm" className="w-full border-transparent bg-transparent text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INDEX_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={idx.isUnique}
                      onCheckedChange={(checked) => updateIndex(idx.id, 'isUnique', checked === true)}
                      disabled={isExecuting}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={idx.comment}
                      onChange={(e) => updateIndex(idx.id, 'comment', e.target.value)}
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
                        onClick={() => saveIndex(idx)}
                        disabled={isExecuting}
                        className="text-primary hover:text-primary/80 hover:bg-primary/5"
                        title="Save Index"
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
                        onClick={() => removeIndex(idx)}
                        disabled={isExecuting}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        title="Delete Index"
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
