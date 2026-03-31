import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  className?: string
}

/** Input with Search icon overlay. Used in toolbar search bars. */
export function SearchInput({ value, onChange, onSubmit, placeholder, className }: SearchInputProps) {
  const { t } = useI18n()

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        className="h-8 w-[200px] pl-8 text-sm"
        placeholder={placeholder ?? t('common.search.placeholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onSubmit ? (e) => { if (e.key === 'Enter') onSubmit() } : undefined}
      />
    </div>
  )
}
