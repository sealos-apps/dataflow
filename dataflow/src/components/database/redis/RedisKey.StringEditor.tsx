import { useRedisKeyCtx } from './RedisKeyProvider'
import { useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

/** Editor for Redis string values in create mode and supported string-only edit mode. */
export function RedisKeyStringEditor() {
  const { t } = useI18n()
  const { draft, setStringValue } = useRedisKeyCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">{t('redis.key.value')}</label>
      <textarea
        className="min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={draft.stringValue}
        onChange={(event) => setStringValue(event.target.value)}
        placeholder={t('redis.key.stringPlaceholder')}
        disabled={state.isSubmitting}
      />
    </div>
  )
}
