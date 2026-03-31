import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import { useRedisKeyCtx } from './RedisKeyProvider'

/** Create-only editor for Redis hash field/value pairs. */
export function RedisKeyHashEditor() {
  const { t } = useI18n()
  const { draft, setHashPairs } = useRedisKeyCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">{t('redis.key.value')}</label>
      <div className="space-y-2">
        {draft.hashPairs.map((pair, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder={t('redis.key.hashFieldPlaceholder')}
              value={pair.field}
              onChange={(event) => {
                const next = [...draft.hashPairs]
                next[index] = { ...next[index], field: event.target.value }
                setHashPairs(next)
              }}
              className="flex-1 font-mono"
              disabled={state.isSubmitting}
            />
            <Input
              placeholder={t('redis.key.hashValuePlaceholder')}
              value={pair.value}
              onChange={(event) => {
                const next = [...draft.hashPairs]
                next[index] = { ...next[index], value: event.target.value }
                setHashPairs(next)
              }}
              className="flex-1 font-mono"
              disabled={state.isSubmitting}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setHashPairs(draft.hashPairs.filter((_, pairIndex) => pairIndex !== index))}
              disabled={state.isSubmitting || draft.hashPairs.length === 1}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setHashPairs([...draft.hashPairs, { field: '', value: '' }])}
          disabled={state.isSubmitting}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          {t('redis.key.addField')}
        </Button>
      </div>
    </div>
  )
}
