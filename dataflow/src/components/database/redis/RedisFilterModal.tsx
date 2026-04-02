import { Search } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import { RedisFilterProvider, useRedisFilterCtx } from './RedisFilterProvider'

interface RedisFilterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (pattern: string, types: string[]) => void
  initialPattern: string
  initialTypes: string[]
}

export function RedisFilterModal({
  open,
  onOpenChange,
  onApply,
  initialPattern,
  initialTypes,
}: RedisFilterModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <RedisFilterProvider
          open={open}
          onApply={onApply}
          initialPattern={initialPattern}
          initialTypes={initialTypes}
        >
          <ModalForm.Header />
          <RedisFilterFields />
          <RedisFilterFooter onOpenChange={onOpenChange} />
        </RedisFilterProvider>
      </DialogContent>
    </Dialog>
  )
}

function RedisFilterFields() {
  const { t } = useI18n()
  const { pattern, setPattern, selectedTypes, availableTypes, toggleType } = useRedisFilterCtx()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">{t('redis.filter.pattern')}</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder={t('redis.filter.patternPlaceholder')}
            className="pl-9"
            autoFocus
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t('redis.filter.patternHint')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          {t('redis.filter.types')}
          <span className="text-xs font-normal text-muted-foreground">
            {selectedTypes.length === 0
              ? t('redis.filter.allTypes')
              : t('redis.filter.selectedCount', { count: selectedTypes.length })}
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={[
                'flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                selectedTypes.includes(type)
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-input bg-background text-foreground hover:bg-muted/30',
              ].join(' ')}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RedisFilterFooter({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const { reset } = useRedisFilterCtx()
  const { actions } = useModalForm()

  return (
    <ModalForm.Footer className="justify-between gap-2 sm:justify-between">
      <Button type="button" variant="outline" onClick={reset}>
        {t('redis.filter.reset')}
      </Button>
      <div className="flex items-center gap-3">
        <ModalForm.CancelButton />
        <Button
          type="button"
          onClick={async () => {
            await actions.submit?.()
            onOpenChange(false)
          }}
          className="gap-2"
        >
          <Search className="h-4 w-4" />
          {t('redis.filter.apply')}
        </Button>
      </div>
    </ModalForm.Footer>
  )
}
