import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useModalForm } from '@/components/ui/ModalForm'
import { useRedisKeyCtx } from './RedisKeyProvider'

/** Create-only editor for Redis set values. */
export function RedisKeySetEditor() {
  const { draft, setSetItems } = useRedisKeyCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">Value</label>
      <div className="space-y-2">
        {draft.setItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder="Member value"
              value={item.value}
              onChange={(event) => {
                const next = [...draft.setItems]
                next[index] = { value: event.target.value }
                setSetItems(next)
              }}
              className="flex-1 font-mono"
              disabled={state.isSubmitting}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSetItems(draft.setItems.filter((_, itemIndex) => itemIndex !== index))}
              disabled={state.isSubmitting || draft.setItems.length === 1}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSetItems([...draft.setItems, { value: '' }])}
          disabled={state.isSubmitting}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>
    </div>
  )
}
