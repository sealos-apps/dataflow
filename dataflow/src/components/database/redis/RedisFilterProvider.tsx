import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { Filter } from 'lucide-react'
import { ModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

const REDIS_FILTER_TYPES = ['string', 'hash', 'list', 'set', 'zset', 'stream'] as const

type RedisFilterType = (typeof REDIS_FILTER_TYPES)[number]

interface RedisFilterCtxValue {
  pattern: string
  selectedTypes: RedisFilterType[]
  availableTypes: readonly RedisFilterType[]
  setPattern: (value: string) => void
  toggleType: (value: RedisFilterType) => void
  reset: () => void
}

const RedisFilterCtx = createContext<RedisFilterCtxValue | null>(null)

/** Accessor for Redis filter modal domain state. Throws outside the provider. */
export function useRedisFilterCtx(): RedisFilterCtxValue {
  const ctx = use(RedisFilterCtx)
  if (!ctx) throw new Error('useRedisFilterCtx must be used within RedisFilterProvider')
  return ctx
}

interface RedisFilterProviderProps {
  open: boolean
  onApply: (pattern: string, types: string[]) => void
  initialPattern: string
  initialTypes: string[]
  children: ReactNode
}

/** Owns Redis key filter draft state and bridges submit into ModalForm. */
export function RedisFilterProvider({
  open,
  onApply,
  initialPattern,
  initialTypes,
  children,
}: RedisFilterProviderProps) {
  const { t } = useI18n()
  const [pattern, setPattern] = useState(initialPattern)
  const [selectedTypes, setSelectedTypes] = useState<RedisFilterType[]>(
    initialTypes.filter((value): value is RedisFilterType =>
      REDIS_FILTER_TYPES.includes(value as RedisFilterType),
    ),
  )

  useEffect(() => {
    if (!open) return
    setPattern(initialPattern)
    setSelectedTypes(
      initialTypes.filter((value): value is RedisFilterType =>
        REDIS_FILTER_TYPES.includes(value as RedisFilterType),
      ),
    )
  }, [initialPattern, initialTypes, open])

  const toggleType = useCallback((value: RedisFilterType) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((type) => type !== value) : [...prev, value],
    )
  }, [])

  const reset = useCallback(() => {
    setPattern('*')
    setSelectedTypes([])
  }, [])

  const handleSubmit = useCallback(async () => {
    onApply(pattern || '*', selectedTypes)
  }, [onApply, pattern, selectedTypes])

  return (
    <RedisFilterCtx
      value={{
        pattern,
        selectedTypes,
        availableTypes: REDIS_FILTER_TYPES,
        setPattern,
        toggleType,
        reset,
      }}
    >
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{
          title: t('redis.filter.title'),
          icon: Filter,
        }}
      >
        {children}
      </ModalForm.Provider>
    </RedisFilterCtx>
  )
}
