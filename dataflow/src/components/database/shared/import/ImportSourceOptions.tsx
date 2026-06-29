import type { ReactNode } from 'react'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Sentinel for the "auto detect" delimiter, since Radix Select forbids an empty-string item value. */
const AUTO_DELIMITER = '__auto__'

interface ImportDelimiterOption {
  value: string
  label: string
}

interface ImportSourceOptionsProps {
  showDelimiter: boolean
  showSheet: boolean
  delimiterLabel: string
  delimiterOptions: ImportDelimiterOption[]
  delimiter: string
  onDelimiterChange: (value: string) => void
  sheetLabel: string
  sheetPlaceholder: string
  sheet: string
  onSheetChange: (value: string) => void
  disabled?: boolean
  /** Slot rendered after the inputs, e.g. a "refresh preview" button. */
  trailing?: ReactNode
}

/** CSV delimiter and Excel sheet inputs, shown per detected file format. Shared by import dialogs. */
export function ImportSourceOptions({
  showDelimiter,
  showSheet,
  delimiterLabel,
  delimiterOptions,
  delimiter,
  onDelimiterChange,
  sheetLabel,
  sheetPlaceholder,
  sheet,
  onSheetChange,
  disabled,
  trailing,
}: ImportSourceOptionsProps) {
  if (!showDelimiter && !showSheet && !trailing) return null

  return (
    <div className="flex flex-wrap items-end gap-3">
      {showDelimiter && (
        <div className="flex w-full flex-col gap-2 sm:w-52">
          <label className="text-sm font-medium text-foreground">{delimiterLabel}</label>
          <Select
            value={delimiter === '' ? AUTO_DELIMITER : delimiter}
            onValueChange={(next) => onDelimiterChange(next === AUTO_DELIMITER ? '' : next)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {delimiterOptions.map((option) => (
                <SelectItem key={option.label} value={option.value === '' ? AUTO_DELIMITER : option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showSheet && (
        <div className="flex w-full flex-col gap-2 sm:w-52">
          <label className="text-sm font-medium text-foreground">{sheetLabel}</label>
          <Input value={sheet} onChange={(event) => onSheetChange(event.target.value)} placeholder={sheetPlaceholder} disabled={disabled} />
        </div>
      )}
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  )
}
