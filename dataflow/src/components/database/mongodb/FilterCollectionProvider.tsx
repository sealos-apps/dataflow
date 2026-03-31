import { createContext, use, useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { Filter } from 'lucide-react'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import type { ModalAlert } from '@/components/ui/types'
import type {
  FilterConditionDraft,
  FlatMongoFilter,
  MongoFilterOperator,
} from './filter-collection.types'

const SUPPORTED_OPERATORS: MongoFilterOperator[] = [
  '$eq',
  '$ne',
  '$regex',
  '$gt',
  '$lt',
  '$gte',
  '$lte',
  '$in',
]

interface ParsedFilterResult {
  conditions: FilterConditionDraft[]
  hasUnsupported: boolean
}

/**
 * Domain context for FilterCollection modal.
 *
 * This context only exposes flat-condition draft state and draft manipulation
 * actions. Submission and alert state are handled by ModalForm context.
 */
export interface FilterCollectionCtxValue {
  conditions: FilterConditionDraft[]
  fields: string[]
  addCondition: () => void
  removeCondition: (id: string) => void
  updateCondition: (id: string, updates: Partial<FilterConditionDraft>) => void
  clearConditions: () => void
  clearAndClose: () => void
}

const FilterCollectionCtx = createContext<FilterCollectionCtxValue | null>(null)

/** Accessor for FilterCollection domain context. Throws outside provider. */
export function useFilterCollectionCtx(): FilterCollectionCtxValue {
  const ctx = use(FilterCollectionCtx)
  if (!ctx) throw new Error('useFilterCollectionCtx must be used within FilterCollectionProvider')
  return ctx
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function draftValueFromPrimitive(value: string | number | boolean | null): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function parseDraftToken(token: string): string | number | boolean | null {
  const trimmed = token.trim()
  if (!trimmed) return ''

  const lowered = trimmed.toLowerCase()
  if (lowered === 'true') return true
  if (lowered === 'false') return false
  if (lowered === 'null') return null

  const asNumber = Number(trimmed)
  if (!Number.isNaN(asNumber)) return asNumber

  return token
}

function parseInDraftValue(value: string): Array<string | number | boolean | null> {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => parseDraftToken(part))
}

function createEmptyCondition(fields: string[]): FilterConditionDraft {
  return {
    id: Math.random().toString(36).slice(2, 11),
    field: fields[0] ?? '',
    operator: '$eq',
    value: '',
  }
}

function createConditionForField(field: string): FilterConditionDraft {
  return {
    id: Math.random().toString(36).slice(2, 11),
    field,
    operator: '$eq',
    value: '',
  }
}

function getNormalizedField(value: string): string {
  return value.trim()
}

function findFirstUnusedField(fields: string[], conditions: FilterConditionDraft[]): string | null {
  const usedFields = new Set(
    conditions
      .map((condition) => getNormalizedField(condition.field))
      .filter((field) => field.length > 0),
  )

  for (const field of fields) {
    if (!usedFields.has(field)) return field
  }

  return null
}

function getDuplicateFields(conditions: FilterConditionDraft[]): string[] {
  const counts = new Map<string, number>()
  for (const condition of conditions) {
    const field = getNormalizedField(condition.field)
    if (!field) continue
    counts.set(field, (counts.get(field) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([field]) => field)
}

function parseInitialFilter(initialFilter: FlatMongoFilter | undefined): ParsedFilterResult {
  if (!initialFilter || Object.keys(initialFilter).length === 0) {
    return { conditions: [], hasUnsupported: false }
  }

  const parsed: FilterConditionDraft[] = []
  let hasUnsupported = false

  for (const [field, rawValue] of Object.entries(initialFilter)) {
    if (isPrimitive(rawValue)) {
      parsed.push({
        id: Math.random().toString(36).slice(2, 11),
        field,
        operator: '$eq',
        value: draftValueFromPrimitive(rawValue),
      })
      continue
    }

    if (!isPlainObject(rawValue)) {
      hasUnsupported = true
      continue
    }

    const entries = Object.entries(rawValue)
    if (entries.length === 0) {
      hasUnsupported = true
      continue
    }

    const regexValue = rawValue.$regex
    const regexOptions = rawValue.$options
    if (regexValue !== undefined || regexOptions !== undefined) {
      const onlyRegexKeys =
        entries.length === 2 &&
        Object.prototype.hasOwnProperty.call(rawValue, '$regex') &&
        Object.prototype.hasOwnProperty.call(rawValue, '$options')

      if (!onlyRegexKeys || regexOptions !== 'i') {
        hasUnsupported = true
        continue
      }

      if (typeof regexValue !== 'string') {
        hasUnsupported = true
        continue
      }

      parsed.push({
        id: Math.random().toString(36).slice(2, 11),
        field,
        operator: '$regex',
        value: regexValue,
      })
      continue
    }

    if (entries.length !== 1) {
      hasUnsupported = true
      continue
    }

    const [operatorKey, operatorValue] = entries[0]
    const operator = operatorKey as MongoFilterOperator
    if (!SUPPORTED_OPERATORS.includes(operator) || operator === '$regex') {
      hasUnsupported = true
      continue
    }

    if (operator === '$in') {
      if (!Array.isArray(operatorValue) || !operatorValue.every((entry) => isPrimitive(entry))) {
        hasUnsupported = true
        continue
      }

      parsed.push({
        id: Math.random().toString(36).slice(2, 11),
        field,
        operator,
        value: operatorValue.map((entry) => draftValueFromPrimitive(entry)).join(', '),
      })
      continue
    }

    if (!isPrimitive(operatorValue)) {
      hasUnsupported = true
      continue
    }

    parsed.push({
      id: Math.random().toString(36).slice(2, 11),
      field,
      operator,
      value: draftValueFromPrimitive(operatorValue),
    })
  }

  return { conditions: parsed, hasUnsupported }
}

function buildFlatFilter(conditions: FilterConditionDraft[]): FlatMongoFilter {
  const filter: FlatMongoFilter = {}

  for (const condition of conditions) {
    const field = condition.field.trim()
    if (!field) continue

    if (condition.operator === '$eq') {
      filter[field] = parseDraftToken(condition.value)
      continue
    }

    if (condition.operator === '$regex') {
      filter[field] = { $regex: condition.value, $options: 'i' }
      continue
    }

    const operatorValue =
      condition.operator === '$in' ? parseInDraftValue(condition.value) : parseDraftToken(condition.value)

    filter[field] = {
      [condition.operator]: operatorValue,
    }
  }

  return filter
}

interface FilterCollectionProviderProps {
  open: boolean
  fields: string[]
  initialFilter?: FlatMongoFilter
  onApply: (filter: FlatMongoFilter) => void
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

/**
 * Bridges pending alerts from the outer provider into the ModalForm context.
 *
 * The outer provider cannot call `setAlert` directly because it sits above
 * `ModalForm.Provider` in the tree. Instead it writes to `pendingAlertRef`
 * and this inner component syncs the value into ModalForm on each render
 * triggered by the `alertVersion` counter.
 */
function AlertBridge({
  pendingAlertRef,
  alertVersion,
  children,
}: {
  pendingAlertRef: React.RefObject<ModalAlert | null>
  alertVersion: number
  children: ReactNode
}) {
  const { actions } = useModalForm()

  useEffect(() => {
    const pending = pendingAlertRef.current
    if (pending) {
      pendingAlertRef.current = null
      actions.setAlert(pending)
    }
  }, [alertVersion, pendingAlertRef, actions])

  return children
}

/**
 * Provider for MongoDB filter modal draft state and submit behavior.
 *
 * Responsibilities:
 * - Owns flat condition draft state.
 * - Rehydrates draft from `initialFilter` only when dialog opens.
 * - Parses only supported flat Mongo filter forms.
 * - Emits only flat filter contract on submit.
 */
export function FilterCollectionProvider({
  open,
  fields,
  initialFilter,
  onApply,
  onOpenChange,
  children,
}: FilterCollectionProviderProps): JSX.Element {
  const { t } = useI18n()
  const [conditions, setConditions] = useState<FilterConditionDraft[]>(() => [createEmptyCondition(fields)])
  const wasOpenRef = useRef(false)
  const pendingAlertRef = useRef<ModalAlert | null>(null)
  const [alertVersion, setAlertVersion] = useState(0)

  const pushAlert = useCallback((alert: ModalAlert) => {
    pendingAlertRef.current = alert
    setAlertVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    const wasOpen = wasOpenRef.current

    if (open && !wasOpen) {
      const parsed = parseInitialFilter(initialFilter)
      if (parsed.conditions.length > 0) {
        setConditions(parsed.conditions)
      } else {
        setConditions([createEmptyCondition(fields)])
      }

      if (parsed.hasUnsupported) {
        pushAlert({
          type: 'info',
          title: t('mongodb.alert.filtersNotLoadedTitle'),
          message: t('mongodb.alert.filtersNotLoadedMessage'),
        })
      }
    }

    wasOpenRef.current = open
  }, [open, initialFilter, fields, pushAlert, t])

  const addCondition = useCallback(() => {
    const nextField = findFirstUnusedField(fields, conditions)
    if (!nextField) {
      pushAlert({
        type: 'info',
        title: t('mongodb.alert.noAdditionalFieldsTitle'),
        message: t('mongodb.alert.noAdditionalFieldsMessage'),
      })
      return
    }

    setConditions((prev) => [...prev, createConditionForField(nextField)])
  }, [fields, conditions, pushAlert, t])

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter((condition) => condition.id !== id))
  }, [])

  const updateCondition = useCallback((id: string, updates: Partial<FilterConditionDraft>) => {
    setConditions((prev) => {
      const target = prev.find((condition) => condition.id === id)
      if (!target) return prev

      const requestedField =
        typeof updates.field === 'string' ? getNormalizedField(updates.field) : getNormalizedField(target.field)
      if (requestedField) {
        const isTakenByAnother = prev.some(
          (condition) =>
            condition.id !== id && getNormalizedField(condition.field) === requestedField,
        )
        if (isTakenByAnother) {
          pushAlert({
            type: 'error',
            title: t('mongodb.alert.duplicateFieldTitle'),
            message: t('mongodb.alert.duplicateFieldMessage', { field: requestedField }),
          })
          return prev
        }
      }

      return prev.map((condition) => (condition.id === id ? { ...condition, ...updates } : condition))
    })
  }, [pushAlert, t])

  const clearConditions = useCallback(() => {
    setConditions([])
  }, [])

  const clearAndClose = useCallback(() => {
    onApply({})
    onOpenChange(false)
  }, [onApply, onOpenChange])

  const handleSubmit = useCallback(async () => {
    const duplicates = getDuplicateFields(conditions)
    if (duplicates.length > 0) {
      throw new Error(t('mongodb.error.uniqueFieldsOnly'))
    }

    onApply(buildFlatFilter(conditions))
    onOpenChange(false)
  }, [conditions, onApply, onOpenChange, t])

  return (
    <FilterCollectionCtx
      value={{
        conditions,
        fields,
        addCondition,
        removeCondition,
        updateCondition,
        clearConditions,
        clearAndClose,
      }}
    >
      <ModalForm.Provider onSubmit={handleSubmit} meta={{ title: t('mongodb.filter.title'), icon: Filter }}>
        <AlertBridge pendingAlertRef={pendingAlertRef} alertVersion={alertVersion}>
          {children}
        </AlertBridge>
      </ModalForm.Provider>
    </FilterCollectionCtx>
  )
}
