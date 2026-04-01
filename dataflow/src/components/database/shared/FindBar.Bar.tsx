import { Search, ArrowUp, ArrowDown, X } from 'lucide-react'
import { useFindBar } from './FindBar.Provider'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'

/** Always-visible find-in-page search bar matching the Figma toolbar design. */
export function FindBarBar({ className }: { className?: string }) {
  const { t } = useI18n()
  const { state, actions, meta } = useFindBar()

  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const shortcutLabel = isMac ? '⌘F' : 'Ctrl+F'

  return (
    <div className={cn('border-b border-t border-border/50 flex items-center justify-between', className)}>
      {/* Left: search icon + input */}
      <div className="flex items-center gap-2 h-9 flex-1 px-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={meta.inputRef}
          type="text"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder={t('common.findBar.placeholder')}
          value={state.searchTerm}
          onChange={(e) => actions.setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (e.shiftKey) {
                actions.goToPrevious()
              } else {
                actions.goToNext()
              }
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              actions.clear()
              meta.inputRef.current?.blur()
            }
          }}
        />
      </div>

      {/* Right: shortcut hint + match count + navigation + close */}
      <div className="flex items-center shrink-0">
        {/* Shortcut hint — hidden when actively searching */}
        {!state.searchTerm && (
          <span className="text-sm text-foreground/20 px-4 select-none">
            {shortcutLabel}
          </span>
        )}

        {/* Match count */}
        {state.searchTerm && (
          <span className="text-xs text-muted-foreground px-2 tabular-nums whitespace-nowrap">
            {state.total > 0
              ? `${state.currentMatchIndex + 1}/${state.total}`
              : t('common.findBar.noResults')}
          </span>
        )}

        {/* Previous match */}
        <button
          type="button"
          onClick={actions.goToPrevious}
          disabled={state.total === 0}
          className="flex items-center justify-center size-9 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          title={t('common.findBar.previousMatch')}
        >
          <ArrowUp className="h-4 w-4" />
        </button>

        {/* Next match */}
        <button
          type="button"
          onClick={actions.goToNext}
          disabled={state.total === 0}
          className="flex items-center justify-center size-9 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          title={t('common.findBar.nextMatch')}
        >
          <ArrowDown className="h-4 w-4" />
        </button>

        {/* Clear / close */}
        <button
          type="button"
          onClick={actions.clear}
          disabled={!state.searchTerm}
          className="flex items-center justify-center size-9 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          title={t('common.findBar.clear')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
