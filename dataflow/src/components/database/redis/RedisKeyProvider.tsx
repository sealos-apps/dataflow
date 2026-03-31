import { createContext, use, useCallback, useEffect, useState, type JSX, type ReactNode } from 'react'
import { List } from 'lucide-react'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
import type {
  RedisHashPairDraft,
  RedisKeyDraft,
  RedisKeyType,
  RedisListItemDraft,
  RedisZSetItemDraft,
} from './redis-key.types'

/**
 * Domain context for Redis key create/edit draft state.
 *
 * The modal shell consumes this context to render identity fields and one
 * explicit editor variant for the current draft type.
 */
export interface RedisKeyCtxValue {
  draft: RedisKeyDraft
  setKey: (value: string) => void
  setType: (value: RedisKeyType) => void
  setStringValue: (value: string) => void
  setHashPairs: (value: RedisHashPairDraft[]) => void
  setListItems: (value: RedisListItemDraft[]) => void
  setSetItems: (value: RedisListItemDraft[]) => void
  setZsetItems: (value: RedisZSetItemDraft[]) => void
  isEditMode: boolean
  isStringEdit: boolean
  canEditType: boolean
  canEditKeyName: boolean
}

const RedisKeyCtx = createContext<RedisKeyCtxValue | null>(null)

/** Accessor for Redis key modal draft context. Throws outside the provider. */
export function useRedisKeyCtx(): RedisKeyCtxValue {
  const ctx = use(RedisKeyCtx)
  if (!ctx) throw new Error('useRedisKeyCtx must be used within RedisKeyProvider')
  return ctx
}

interface RedisKeyProviderProps {
  open: boolean
  onSave: (draft: RedisKeyDraft) => Promise<void>
  initialData?: RedisKeyDraft | null
  children: ReactNode
}

const DEFAULT_HASH_PAIRS: RedisHashPairDraft[] = [{ field: '', value: '' }]
const DEFAULT_LIST_ITEMS: RedisListItemDraft[] = [{ value: '' }]
const DEFAULT_ZSET_ITEMS: RedisZSetItemDraft[] = [{ member: '', score: '0' }]

function cloneHashPairs(pairs: RedisHashPairDraft[]): RedisHashPairDraft[] {
  return pairs.map((pair) => ({ ...pair }))
}

function cloneListItems(items: RedisListItemDraft[]): RedisListItemDraft[] {
  return items.map((item) => ({ ...item }))
}

function cloneZsetItems(items: RedisZSetItemDraft[]): RedisZSetItemDraft[] {
  return items.map((item) => ({ ...item }))
}

function createEmptyDraft(): RedisKeyDraft {
  return {
    mode: 'create',
    key: '',
    type: 'string',
    stringValue: '',
    hashPairs: cloneHashPairs(DEFAULT_HASH_PAIRS),
    listItems: cloneListItems(DEFAULT_LIST_ITEMS),
    setItems: cloneListItems(DEFAULT_LIST_ITEMS),
    zsetItems: cloneZsetItems(DEFAULT_ZSET_ITEMS),
  }
}

function normalizeHashPairs(pairs: RedisHashPairDraft[] | undefined): RedisHashPairDraft[] {
  return pairs && pairs.length > 0 ? cloneHashPairs(pairs) : cloneHashPairs(DEFAULT_HASH_PAIRS)
}

function normalizeListItems(items: RedisListItemDraft[] | undefined): RedisListItemDraft[] {
  return items && items.length > 0 ? cloneListItems(items) : cloneListItems(DEFAULT_LIST_ITEMS)
}

function normalizeZsetItems(items: RedisZSetItemDraft[] | undefined): RedisZSetItemDraft[] {
  return items && items.length > 0 ? cloneZsetItems(items) : cloneZsetItems(DEFAULT_ZSET_ITEMS)
}

function normalizeDraft(initialData?: RedisKeyDraft | null): RedisKeyDraft {
  if (!initialData) return createEmptyDraft()

  return {
    mode: initialData.mode,
    key: initialData.key,
    type: initialData.type,
    stringValue: initialData.stringValue,
    hashPairs: normalizeHashPairs(initialData.hashPairs),
    listItems: normalizeListItems(initialData.listItems),
    setItems: normalizeListItems(initialData.setItems),
    zsetItems: normalizeZsetItems(initialData.zsetItems),
  }
}

/** Resets ModalForm state when the dialog opens. Must be rendered inside ModalForm.Provider. */
function ResetOnOpen({ open, children }: { open: boolean; children: ReactNode }) {
  const { actions } = useModalForm()

  useEffect(() => {
    if (open) actions.reset()
  }, [open, actions])

  return children
}

/** Owns Redis key draft state and delegates save behavior to the caller. */
export function RedisKeyProvider({
  open,
  onSave,
  initialData,
  children,
}: RedisKeyProviderProps): JSX.Element {
  const { t } = useI18n()
  const [draft, setDraft] = useState<RedisKeyDraft>(() => normalizeDraft(initialData))

  useEffect(() => {
    if (!open) return
    setDraft(normalizeDraft(initialData))
  }, [open, initialData])

  const setKey = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, key: value }))
  }, [])

  const setType = useCallback((value: RedisKeyType) => {
    setDraft((prev) => {
      if (prev.mode === 'edit') return prev

      return {
        ...prev,
        type: value,
        stringValue: '',
        hashPairs: cloneHashPairs(DEFAULT_HASH_PAIRS),
        listItems: cloneListItems(DEFAULT_LIST_ITEMS),
        setItems: cloneListItems(DEFAULT_LIST_ITEMS),
        zsetItems: cloneZsetItems(DEFAULT_ZSET_ITEMS),
      }
    })
  }, [])

  const setStringValue = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, stringValue: value }))
  }, [])

  const setHashPairs = useCallback((value: RedisHashPairDraft[]) => {
    setDraft((prev) => ({ ...prev, hashPairs: normalizeHashPairs(value) }))
  }, [])

  const setListItems = useCallback((value: RedisListItemDraft[]) => {
    setDraft((prev) => ({ ...prev, listItems: normalizeListItems(value) }))
  }, [])

  const setSetItems = useCallback((value: RedisListItemDraft[]) => {
    setDraft((prev) => ({ ...prev, setItems: normalizeListItems(value) }))
  }, [])

  const setZsetItems = useCallback((value: RedisZSetItemDraft[]) => {
    setDraft((prev) => ({ ...prev, zsetItems: normalizeZsetItems(value) }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!draft.key.trim()) return
    if (draft.mode === 'edit' && draft.type !== 'string') {
      throw new Error(t('redis.alert.unsupportedEditMode'))
    }
    await onSave(draft)
  }, [draft, onSave, t])

  const isEditMode = draft.mode === 'edit'
  const isStringEdit = isEditMode && draft.type === 'string'
  const canEditType = !isEditMode
  const canEditKeyName = !isEditMode

  return (
    <RedisKeyCtx
      value={{
        draft,
        setKey,
        setType,
        setStringValue,
        setHashPairs,
        setListItems,
        setSetItems,
        setZsetItems,
        isEditMode,
        isStringEdit,
        canEditType,
        canEditKeyName,
      }}
    >
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{
          title: isEditMode ? t('redis.keyModal.titleEdit') : t('redis.keyModal.titleCreate'),
          description: isEditMode ? t('redis.keyModal.editDescription') : undefined,
          icon: List,
        }}
      >
        <ResetOnOpen open={open}>
          {children}
        </ResetOnOpen>
      </ModalForm.Provider>
    </RedisKeyCtx>
  )
}
