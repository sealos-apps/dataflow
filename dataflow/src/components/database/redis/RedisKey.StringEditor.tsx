import { useRedisKeyCtx } from './RedisKeyProvider'
import { useModalForm } from '@/components/ui/ModalForm'
import { Textarea } from '@/components/ui/Textarea'
import { useI18n } from '@/i18n/useI18n'

/** Editor for Redis string values in create mode and supported string-only edit mode. */
export function RedisKeyStringEditor() {
  const { t } = useI18n()
  const { draft, setStringValue } = useRedisKeyCtx()
  const { state } = useModalForm()

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">{t('redis.key.value')}</label>
      <Textarea
        className="min-h-[220px] font-mono"
        value={draft.stringValue}
        onChange={(event) => setStringValue(event.target.value)}
        placeholder={t('redis.key.stringPlaceholder')}
        disabled={state.isSubmitting}
      />
    </div>
  )
}
