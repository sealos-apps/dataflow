import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/Input'
import { useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import { useRedisKeyCtx } from './RedisKeyProvider'

/** Create-only editor for Redis list values. */
export function RedisKeyListEditor() {
  const { t } = useI18n()
  const { draft, setListItems } = useRedisKeyCtx()
  const { state } = useModalForm()

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">{t('redis.key.value')}</label>
      <div className="flex flex-col gap-2">
        {draft.listItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder={t('redis.key.listItemPlaceholder')}
              value={item.value}
              onChange={(event) => {
                const next = [...draft.listItems]
                next[index] = { value: event.target.value }
                setListItems(next)
              }}
              className="flex-1 font-mono"
              disabled={state.isSubmitting}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setListItems(draft.listItems.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={state.isSubmitting || draft.listItems.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('redis.key.removeItem')}</TooltipContent>
            </Tooltip>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setListItems([...draft.listItems, { value: '' }])}
          disabled={state.isSubmitting}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          {t('redis.key.addItem')}
        </Button>
      </div>
    </div>
  )
}
