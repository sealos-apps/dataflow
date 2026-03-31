import type { LucideIcon } from 'lucide-react'
import { useI18n } from '@/i18n/useI18n'

/** Props for the toolbar layout shell. */
export interface DataViewHeaderProps {
  icon: LucideIcon
  /** CSS class applied to the icon wrapper (e.g., "bg-primary/10"). */
  iconClassName?: string
  /** CSS class applied to the icon itself (e.g., "text-primary"). */
  iconColor?: string
  title: string
  subtitle: string
  /** Optional count displayed next to title (e.g., total rows). */
  count?: number
  /** Action buttons rendered on the right side. */
  children?: React.ReactNode
}

/** Shared header layout for detail views. */
export function DataViewHeader({
  icon: Icon, iconClassName, iconColor, title, subtitle, count, children,
}: DataViewHeaderProps) {
  const { t } = useI18n()

  return (
    <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-card">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconClassName ?? 'bg-primary/10'}`}>
          <Icon className={`h-5 w-5 ${iconColor ?? 'text-primary'}`} />
        </div>
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
            {title}
            {count !== undefined && (
              <span className="text-muted-foreground font-normal text-sm ml-2">
                ({t('common.dataView.items', { count })})
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  )
}
