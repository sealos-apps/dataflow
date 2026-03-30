import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ModalForm, useModalForm } from '@/components/database/modals/ModalForm'
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
      <DialogContent className="sm:max-w-md">
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
  const { pattern, setPattern, selectedTypes, availableTypes, toggleType } = useRedisFilterCtx()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Key Pattern</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder="e.g. user:*, *cache*"
            className="pl-9"
            autoFocus
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Supports glob patterns: <code>*</code> matches any sequence and <code>?</code> matches a single character.
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center justify-between text-sm font-medium text-foreground">
          Data Types
          <span className="text-xs font-normal text-muted-foreground">
            {selectedTypes.length === 0 ? 'All types' : `${selectedTypes.length} selected`}
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
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground',
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
  const { reset } = useRedisFilterCtx()
  const { actions } = useModalForm()

  return (
    <DialogFooter className="justify-between gap-2 sm:justify-between">
      <Button type="button" variant="outline" onClick={reset}>
        Reset
      </Button>
      <div className="flex items-center gap-3">
        <ModalForm.CancelButton />
        <Button
          type="button"
          onClick={async () => {
            await actions.submit()
            onOpenChange(false)
          }}
          className="gap-2"
        >
          <Search className="h-4 w-4" />
          Apply Filter
        </Button>
      </div>
    </DialogFooter>
  )
}
