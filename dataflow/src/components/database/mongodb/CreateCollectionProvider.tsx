import { createContext, use, useCallback, useState, type ReactNode, type JSX } from 'react'
import { Database } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { ModalForm } from '@/components/database/modals/ModalForm'
import { useModalState } from '@/components/database/modals/useModalState'
import { resolveSchemaParam } from '@/utils/database-features'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** Domain state for CreateCollection modal. */
export interface CreateCollectionCtxValue {
  collectionName: string
  setCollectionName: (value: string) => void
}

const CreateCollectionCtx = createContext<CreateCollectionCtxValue | null>(null)

/** Accessor for CreateCollection domain context. Throws outside provider. */
export function useCreateCollectionCtx(): CreateCollectionCtxValue {
  const ctx = use(CreateCollectionCtx)
  if (!ctx) throw new Error('useCreateCollectionCtx must be used within CreateCollectionProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for creating a MongoDB collection. */
export function CreateCollectionProvider({
  connectionId,
  databaseName,
  onSuccess,
  children,
}: {
  connectionId: string
  databaseName: string
  onSuccess?: () => void
  children: ReactNode
}): JSX.Element {
  const { createTable, connections } = useConnectionStore()
  const [collectionName, setCollectionName] = useState('')
  const { state, actions: baseActions } = useModalState()

  const submit = useCallback(async () => {
    if (!collectionName) return
    baseActions.setSubmitting(true)
    let didSucceed = false

    try {
      const conn = connections.find(c => c.id === connectionId)
      const schemaParam = resolveSchemaParam(conn?.type, databaseName)
      const result = await createTable(databaseName, schemaParam, collectionName, [])

      if (result.success) {
        didSucceed = true
      } else {
        baseActions.setAlert({
          type: 'error',
          title: 'Failed to create collection',
          message: result.message ?? 'Unknown error',
        })
      }
    } catch (error) {
      baseActions.setAlert({
        type: 'error',
        title: 'Failed to create collection',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      baseActions.setSubmitting(false)
    }

    if (didSucceed) {
      onSuccess?.()
    }
  }, [collectionName, connections, connectionId, databaseName, createTable, onSuccess, baseActions])

  const actions = {
    ...baseActions,
    submit,
  }

  return (
    <CreateCollectionCtx value={{ collectionName, setCollectionName }}>
      <ModalForm.Provider
        state={state}
        actions={actions}
        meta={{ title: 'Create Collection', icon: Database }}
      >
        {children}
      </ModalForm.Provider>
    </CreateCollectionCtx>
  )
}
