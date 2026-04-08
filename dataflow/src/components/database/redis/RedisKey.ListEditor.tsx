import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{t('redis.key.value')}</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setListItems([...draft.listItems, { value: '' }])}
          disabled={state.isSubmitting}
          className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          {t('redis.key.addItem')}
        </Button>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">{t('redis.key.listItemPlaceholder')}</th>
              <th className="px-4 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {draft.listItems.map((item, index) => (
              <tr key={index} className="group hover:bg-muted/30">
                <td className="p-2">
                  <input
                    type="text"
                    placeholder={t('redis.key.listItemPlaceholder')}
                    value={item.value}
                    onChange={(e) => {
                      const next = [...draft.listItems]
                      next[index] = { value: e.target.value }
                      setListItems(next)
                    }}
                    disabled={state.isSubmitting}
                    className="w-full rounded border-transparent bg-transparent px-2 py-1 text-sm font-mono focus:border-primary focus:bg-background outline-none disabled:opacity-50"
                  />
                </td>
                <td className="p-2 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setListItems(draft.listItems.filter((_, i) => i !== index))}
                        disabled={state.isSubmitting}
                        className={`text-muted-foreground hover:text-destructive transition-opacity ${draft.listItems.length > 1 ? 'opacity-0 group-hover:opacity-100' : 'invisible'}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('redis.key.removeItem')}</TooltipContent>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
