import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Multi-select dropdown using Popover + Checkbox list. */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs cursor-pointer outline-none h-8',
            disabled && 'pointer-events-none opacity-50',
            className,
          )}
        >
          <span className="truncate">
            {selected.length === 0
              ? <span className="text-muted-foreground">{placeholder}</span>
              : selected.join(', ')}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-2">
        {options.length === 0 ? (
          <div className="p-2 text-center text-sm text-muted-foreground">No options available</div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {options.map(opt => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-sm py-1.5 px-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox
                  className="h-3.5 w-3.5"
                  checked={selected.includes(opt)}
                  onCheckedChange={() => toggle(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
