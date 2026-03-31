import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useModalForm } from '@/components/ui/ModalForm'
import { useRedisKeyCtx } from './RedisKeyProvider'

/** Create-only editor for Redis sorted-set member/score pairs. */
export function RedisKeyZSetEditor() {
  const { draft, setZsetItems } = useRedisKeyCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">Value</label>
      <div className="space-y-2">
        {draft.zsetItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              type="number"
              placeholder="Score"
              value={item.score}
              onChange={(event) => {
                const next = [...draft.zsetItems]
                next[index] = { ...next[index], score: event.target.value }
                setZsetItems(next)
              }}
              className="w-[120px] font-mono"
              disabled={state.isSubmitting}
            />
            <Input
              placeholder="Member value"
              value={item.member}
              onChange={(event) => {
                const next = [...draft.zsetItems]
                next[index] = { ...next[index], member: event.target.value }
                setZsetItems(next)
              }}
              className="flex-1 font-mono"
              disabled={state.isSubmitting}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setZsetItems(draft.zsetItems.filter((_, itemIndex) => itemIndex !== index))}
              disabled={state.isSubmitting || draft.zsetItems.length === 1}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setZsetItems([...draft.zsetItems, { member: '', score: '0' }])}
          disabled={state.isSubmitting}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>
    </div>
  )
}
