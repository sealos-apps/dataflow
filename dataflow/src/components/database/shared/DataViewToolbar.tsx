import type { ToolbarProps } from './types'

/** Shared toolbar layout for detail views. */
export function DataViewToolbar({
  icon: Icon, iconClassName, iconColor, title, subtitle, count, children,
}: ToolbarProps) {
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
              <span className="text-muted-foreground font-normal text-sm ml-2">({count} items)</span>
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
