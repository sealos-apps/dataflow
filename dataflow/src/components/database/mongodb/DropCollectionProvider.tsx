import { createContext, use, useCallback, useState, type ReactNode, type JSX } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { ModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** Domain state for DropCollection modal. */
export interface DropCollectionCtxValue {
  confirmName: string
  setConfirmName: (v: string) => void
  collectionName: string
  canDrop: boolean
}

const DropCollectionCtx = createContext<DropCollectionCtxValue | null>(null)

/** Accessor for DropCollection domain context. Throws outside provider. */
export function useDropCollectionCtx(): DropCollectionCtxValue {
  const ctx = use(DropCollectionCtx)
  if (!ctx) throw new Error('useDropCollectionCtx must be used within DropCollectionProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for dropping a MongoDB collection with name confirmation. */
export function DropCollectionProvider({
  databaseName,
  collectionName,
  onSuccess,
  children,
}: {
  databaseName: string
  collectionName: string
  onSuccess?: () => void
  children: ReactNode
}): JSX.Element {
  const { t } = useI18n()
  const { dropCollection } = useConnectionStore()
  const [confirmName, setConfirmName] = useState('')
  const canDrop = confirmName === collectionName

  const handleSubmit = useCallback(async () => {
    if (!canDrop) return
    const result = await dropCollection(databaseName, collectionName)
    if (result.success) {
      onSuccess?.()
    } else {
      throw new Error(result.message ?? t('common.unknownError'))
    }
  }, [canDrop, dropCollection, databaseName, collectionName, onSuccess, t])

  return (
    <DropCollectionCtx value={{ confirmName, setConfirmName, collectionName, canDrop }}>
      <ModalForm.Provider
        onSubmit={handleSubmit}
        meta={{ title: t('mongodb.collection.drop'), icon: AlertTriangle, isDestructive: true }}
      >
        {children}
      </ModalForm.Provider>
    </DropCollectionCtx>
  )
}
