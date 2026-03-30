import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { FilterChip } from './types'

/** Shared filter bar with dismissible chips. */
export function DataViewFilterBar({
  filters, onClearAll,
}: {
  filters: FilterChip[]
  onClearAll: () => void
}) {
  if (filters.length === 0) return null

  return (
    <div className="px-6 py-2 bg-muted/30 border-b border-border/50 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground mr-2">Filtered by:</span>
      {filters.map((chip) => (
        <div key={chip.id} className="flex items-center gap-1 bg-background border border-border rounded-full px-3 py-1 text-xs shadow-sm">
          <span className="text-muted-foreground">{chip.label}</span>
          <span className="font-medium">{chip.value}</span>
          <button onClick={chip.onRemove} className="ml-1 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive ml-auto" onClick={onClearAll}>
        Clear All
      </Button>
    </div>
  )
}
