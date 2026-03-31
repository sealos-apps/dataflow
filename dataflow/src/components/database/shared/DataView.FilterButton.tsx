import { Filter } from 'lucide-react'
import { ActionButton } from '@/components/ui/ActionButton'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'

/** Filter button with optional active count badge. */
export function DataViewFilterButton({ onClick, count }: { onClick: () => void; count?: number }) {
  const { t } = useI18n()

  return (
    <ActionButton
      variant="outline"
      className={cn(count && 'bg-primary/10 text-primary border-primary/50')}
      onClick={onClick}
    >
      <div className="relative flex items-center gap-2">
        <Filter className="h-3.5 w-3.5" />
        {t('common.actions.filter')}
        {count ? (
          <span className="absolute -top-2 -right-2 flex items-center justify-center w-3 h-3 text-[8px] font-bold rounded-full bg-primary text-primary-foreground">
            {count}
          </span>
        ) : null}
      </div>
    </ActionButton>
  )
}
