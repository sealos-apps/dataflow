import type { LucideIcon } from 'lucide-react'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'

/** Describes a single format option for the selector grid. */
export interface FormatOption<T extends string = string> {
  id: T
  label: string
  icon: LucideIcon
}

interface FormatSelectorProps<T extends string = string> {
  /** Available format choices. */
  options: FormatOption<T>[]
  /** Currently selected format. */
  value: T
  /** Called when user picks a different format. */
  onChange: (value: T) => void
  /** Disables all options (e.g., during export). */
  disabled?: boolean
}

/** Grid of selectable format cards. Columns auto-adjust: 2 for ≤2 options, 4 otherwise. */
export function FormatSelector<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: FormatSelectorProps<T>) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">{t('common.export.format')}</label>
      <div
        className={cn(
          'grid gap-3',
          options.length <= 2 ? 'grid-cols-2' : 'grid-cols-4',
        )}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-center justify-center p-3 rounded-md border transition-all',
              value === option.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'hover:border-primary/50 hover:bg-muted/50',
            )}
          >
            <option.icon
              className={cn(
                'h-6 w-6 mb-2',
                value === option.id ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <span className="text-xs font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
