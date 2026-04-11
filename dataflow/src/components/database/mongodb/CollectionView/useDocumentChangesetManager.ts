import { useCallback, useReducer } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { useI18n } from '@/i18n/useI18n'
import type { StagedSessionState } from '@/components/database/shared/staged-session/types'
import {
  createStagedSessionState,
  stagedSessionReducer,
} from '@/components/database/shared/staged-session/reducer'
import {
  useDeleteRowMutation,
  useUpdateStorageUnitMutation,
  useRawExecuteLazyQuery,
} from '@graphql'
import { resolveSchemaParam } from '@/utils/database-features'
import { buildMongoInsertOneCommand, parseMongoDocumentInput } from '@/utils/mongodb-shell'
import type { Alert } from '@/components/database/shared/types'
import type {
  DocumentChangesetRowKey,
  DocumentChange,
  DocumentChangesetAction,
  DocumentChangesetEditorState,
  DocumentUndoEntry,
} from './types'

// ---- State ----

export interface DocumentChangesetManagerState {
  session: StagedSessionState<DocumentChange, DocumentUndoEntry>
  editor: DocumentChangesetEditorState
}

export function createInitialChangesetState(): DocumentChangesetManagerState {
  return {
    session: createStagedSessionState<DocumentChange, DocumentUndoEntry>(),
    editor: {
      showAddModal: false,
      addContent: '{\n  \n}',
      editingRowKey: null,
      editContent: '',
      newRowCounter: 0,
    },
  }
}

// ---- Reducer ----

const sortedStringify = (obj: Record<string, unknown>) =>
  JSON.stringify(obj, Object.keys(obj).sort())

export function changesetReducer(
  state: DocumentChangesetManagerState,
  action: DocumentChangesetAction,
): DocumentChangesetManagerState {
  switch (action.type) {
    case 'stage-add': {
      const nextChanges = new Map(state.session.changes)
      nextChanges.set(action.rowKey, {
        type: 'insert',
        originalDocument: {},
        document: action.document,
      })

      return {
        ...state,
        session: {
          ...state.session,
          changes: nextChanges,
          newRowOrder: [...state.session.newRowOrder, action.rowKey],
          undoStack: [...state.session.undoStack, { kind: 'add', rowKey: action.rowKey }],
        },
        editor: {
          ...state.editor,
          newRowCounter: state.editor.newRowCounter + 1,
          showAddModal: false,
        },
      }
    }

    case 'stage-edit': {
      const nextChanges = new Map(state.session.changes)
      const previousDocument = action.isInsert
        ? (nextChanges.get(action.rowKey)!.document)
        : action.originalDocument

      if (action.isInsert) {
        nextChanges.set(action.rowKey, {
          type: 'insert',
          originalDocument: {},
          document: action.document,
        })
      } else {
        nextChanges.set(action.rowKey, {
          type: 'update',
          originalDocument: action.originalDocument,
          document: action.document,
        })
      }

      return {
        ...state,
        session: {
          ...state.session,
          changes: nextChanges,
          undoStack: [
            ...state.session.undoStack,
            { kind: 'edit', rowKey: action.rowKey, previousDocument },
          ],
        },
        editor: {
          ...state.editor,
          editingRowKey: null,
          editContent: '',
        },
      }
    }

    case 'delete-selected': {
      if (action.rows.length === 0) return state

      const nextChanges = new Map(state.session.changes)
      const rowKeys = action.rows.map((r) => r.rowKey)
      const previousChanges = action.rows.map(
        (r) => [r.rowKey, nextChanges.get(r.rowKey)] as [DocumentChangesetRowKey, DocumentChange | undefined],
      )
      const nextNewRowOrder = [...state.session.newRowOrder]

      for (const row of action.rows) {
        if (row.isInserted) {
          nextChanges.delete(row.rowKey)
          const idx = nextNewRowOrder.indexOf(row.rowKey)
          if (idx >= 0) nextNewRowOrder.splice(idx, 1)
          continue
        }

        nextChanges.set(row.rowKey, {
          type: 'delete',
          originalDocument: row.originalDocument,
          document: row.originalDocument,
        })
      }

      return {
        ...state,
        session: {
          ...state.session,
          changes: nextChanges,
          newRowOrder: nextNewRowOrder,
          selectedRowKeys: new Set(),
          undoStack: [
            ...state.session.undoStack.filter((entry) => {
              if (entry.kind !== 'edit') return true
              return !rowKeys.includes(entry.rowKey)
            }),
            { kind: 'delete', rowKeys, previousChanges },
          ],
        },
      }
    }

    case 'undo': {
      const lastEntry = state.session.undoStack.at(-1)
      if (!lastEntry) return state

      const nextUndoStack = state.session.undoStack.slice(0, -1)
      const nextChanges = new Map(state.session.changes)

      if (lastEntry.kind === 'edit') {
        const current = nextChanges.get(lastEntry.rowKey)
        if (current?.type === 'insert') {
          nextChanges.set(lastEntry.rowKey, {
            ...current,
            document: lastEntry.previousDocument,
          })
        } else if (current) {
          if (sortedStringify(lastEntry.previousDocument) === sortedStringify(current.originalDocument)) {
            nextChanges.delete(lastEntry.rowKey)
          } else {
            nextChanges.set(lastEntry.rowKey, {
              ...current,
              document: lastEntry.previousDocument,
            })
          }
        }

        return {
          ...state,
          session: {
            ...state.session,
            changes: nextChanges,
            undoStack: nextUndoStack,
          },
        }
      }

      if (lastEntry.kind === 'add') {
        nextChanges.delete(lastEntry.rowKey)
        return {
          ...state,
          session: {
            ...state.session,
            changes: nextChanges,
            undoStack: nextUndoStack,
            newRowOrder: state.session.newRowOrder.filter((k) => k !== lastEntry.rowKey),
            selectedRowKeys: new Set(
              [...state.session.selectedRowKeys].filter((rowKey) => rowKey !== lastEntry.rowKey),
            ),
          },
        }
      }

      // kind === 'delete'
      for (const [rowKey, previousChange] of lastEntry.previousChanges) {
        if (previousChange) nextChanges.set(rowKey, previousChange)
        else nextChanges.delete(rowKey)
      }

      const nextNewRowOrder = [...state.session.newRowOrder]
      for (const [rowKey, previousChange] of lastEntry.previousChanges) {
        if (previousChange?.type === 'insert' && !nextNewRowOrder.includes(rowKey)) {
          nextNewRowOrder.push(rowKey)
        }
      }

      return {
        ...state,
        session: {
          ...state.session,
          changes: nextChanges,
          newRowOrder: nextNewRowOrder,
          undoStack: nextUndoStack,
        },
      }
    }

    case 'discard-all':
      return createInitialChangesetState()

    case 'open-add-modal':
      return { ...state, editor: { ...state.editor, showAddModal: true, addContent: action.content } }

    case 'set-add-content':
      return { ...state, editor: { ...state.editor, addContent: action.content } }

    case 'close-add-modal':
      return { ...state, editor: { ...state.editor, showAddModal: false } }

    case 'open-edit-modal':
      return {
        ...state,
        editor: { ...state.editor, editingRowKey: action.rowKey, editContent: action.content },
      }

    case 'set-edit-content':
      return { ...state, editor: { ...state.editor, editContent: action.content } }

    case 'close-edit-modal':
      return { ...state, editor: { ...state.editor, editingRowKey: null, editContent: '' } }

    case 'toggle-selection':
    case 'prune-successes':
    case 'set-show-preview-modal':
    case 'set-show-submit-modal':
    case 'set-show-discard-modal':
      return {
        ...state,
        session: stagedSessionReducer(state.session, action),
      }
  }
}

// ---- Helpers ----

export function buildExistingRowKey(pageOffset: number, index: number): DocumentChangesetRowKey {
  return `existing-${pageOffset + index}`
}

function buildInsertedRowKey(counter: number): DocumentChangesetRowKey {
  return `new-${counter + 1}`
}

// ---- Hook ----

interface UseDocumentChangesetManagerParams {
  connectionId: string
  databaseName: string
  collectionName: string
  documents: any[]
  pageOffset: number
  refresh: () => void
  showAlert: (title: string, message: string, type: Alert['type']) => void
}

export function useDocumentChangesetManager({
  connectionId,
  databaseName,
  collectionName,
  documents,
  pageOffset,
  refresh,
  showAlert,
}: UseDocumentChangesetManagerParams) {
  const { t } = useI18n()
  const { connections } = useConnectionStore()
  const [deleteRowMutation] = useDeleteRowMutation()
  const [updateStorageUnitMutation] = useUpdateStorageUnitMutation()
  const [rawExecute] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' })
  const [state, dispatch] = useReducer(changesetReducer, undefined, createInitialChangesetState)

  // ---- Selection ----

  const toggleRowSelection = useCallback((rowKey: DocumentChangesetRowKey) => {
    dispatch({ type: 'toggle-selection', rowKey })
  }, [])

  // ---- Add document ----

  const handleAddClick = useCallback(() => {
    let content = '{\n  \n}'
    if (documents.length > 0 && typeof documents[0] === 'object' && documents[0] !== null) {
      const template: Record<string, string> = {}
      for (const key of Object.keys(documents[0])) {
        if (key !== '_id') template[key] = ''
      }
      content = JSON.stringify(template, null, 2)
    }
    dispatch({ type: 'open-add-modal', content })
  }, [documents])

  const setAddContent = useCallback((content: string) => {
    dispatch({ type: 'set-add-content', content })
  }, [])

  const handleAddSave = useCallback(async () => {
    try {
      const newDoc = parseMongoDocumentInput(state.editor.addContent)
      if (Object.keys(newDoc).length === 0) {
        showAlert(t('common.alert.error'), t('mongodb.error.emptyDocument'), 'error')
        return
      }

      const rowKey = buildInsertedRowKey(state.editor.newRowCounter)
      dispatch({ type: 'stage-add', rowKey, document: newDoc })
    } catch (e: any) {
      showAlert(t('common.alert.error'), t('mongodb.alert.invalidJsonAdd', { error: e.message }), 'error')
    }
  }, [showAlert, state.editor.addContent, state.editor.newRowCounter, t])

  const setShowAddModal = useCallback((open: boolean) => {
    if (open) dispatch({ type: 'open-add-modal', content: state.editor.addContent })
    else dispatch({ type: 'close-add-modal' })
  }, [state.editor.addContent])

  // ---- Edit document ----

  const handleEditClick = useCallback((rowKey: DocumentChangesetRowKey) => {
    const change = state.session.changes.get(rowKey)
    let doc: Record<string, unknown> | undefined

    if (change) {
      doc = change.type === 'delete' ? change.originalDocument : change.document
    } else {
      const match = rowKey.match(/^existing-(\d+)$/)
      if (match) {
        const globalIndex = parseInt(match[1], 10)
        const localIndex = globalIndex - pageOffset
        if (localIndex >= 0 && localIndex < documents.length) {
          doc = documents[localIndex]
        }
      }
    }

    if (!doc) return

    const { _id: _, ...rest } = doc
    dispatch({ type: 'open-edit-modal', rowKey, content: JSON.stringify(rest, null, 2) })
  }, [documents, pageOffset, state.session.changes])

  const setEditContent = useCallback((content: string) => {
    dispatch({ type: 'set-edit-content', content })
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!state.editor.editingRowKey) return

    try {
      const parsed = parseMongoDocumentInput(state.editor.editContent)
      const change = state.session.changes.get(state.editor.editingRowKey)
      const isInsert = change?.type === 'insert'

      let originalDocument: Record<string, unknown>
      if (isInsert) {
        originalDocument = {}
      } else if (change) {
        originalDocument = change.originalDocument
      } else {
        const match = state.editor.editingRowKey.match(/^existing-(\d+)$/)
        if (!match) return
        const localIndex = parseInt(match[1], 10) - pageOffset
        originalDocument = documents[localIndex]
      }

      // Preserve _id from original document
      const { _id } = isInsert ? change!.document : originalDocument
      const document = _id !== undefined ? { ...parsed, _id } : parsed

      dispatch({
        type: 'stage-edit',
        rowKey: state.editor.editingRowKey,
        originalDocument,
        document,
        isInsert,
      })
    } catch (e: any) {
      showAlert(t('common.alert.error'), t('mongodb.alert.invalidJsonUpdate', { error: e.message }), 'error')
    }
  }, [
    documents,
    pageOffset,
    showAlert,
    state.editor.editContent,
    state.editor.editingRowKey,
    state.session.changes,
    t,
  ])

  const cancelEdit = useCallback(() => {
    dispatch({ type: 'close-edit-modal' })
  }, [])

  // ---- Delete ----

  const markSelectedForDelete = useCallback(() => {
    const rows = [...state.session.selectedRowKeys].map((rowKey) => {
      const change = state.session.changes.get(rowKey)
      const isInserted = change?.type === 'insert'

      let originalDocument: Record<string, unknown>
      if (change) {
        originalDocument = change.originalDocument
      } else {
        const match = rowKey.match(/^existing-(\d+)$/)
        const localIndex = match ? parseInt(match[1], 10) - pageOffset : -1
        originalDocument = documents[localIndex]
      }

      return { rowKey, originalDocument, isInserted: !!isInserted }
    })

    dispatch({ type: 'delete-selected', rows })
  }, [documents, pageOffset, state.session.changes, state.session.selectedRowKeys])

  // ---- Undo / Discard ----

  const undoLastChange = useCallback(() => {
    dispatch({ type: 'undo' })
  }, [])

  const discardChanges = useCallback(() => {
    dispatch({ type: 'discard-all' })
  }, [])

  // ---- Modals ----

  const setShowPreviewModal = useCallback((open: boolean) => {
    dispatch({ type: 'set-show-preview-modal', open })
  }, [])

  const setShowSubmitModal = useCallback((open: boolean) => {
    dispatch({ type: 'set-show-submit-modal', open })
  }, [])

  const setShowDiscardModal = useCallback((open: boolean) => {
    dispatch({ type: 'set-show-discard-modal', open })
  }, [])

  // ---- Submit ----

  const submitChanges = useCallback(async () => {
    const conn = connections.find((c) => c.id === connectionId)
    if (!conn || state.session.changes.size === 0) return

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
    const successfulRowKeys: DocumentChangesetRowKey[] = []
    const failedMessages: string[] = []

    const orderedEntries = [...state.session.changes.entries()].sort(([, left], [, right]) => {
      const rank = { delete: 0, update: 1, insert: 2 } as const
      return rank[left.type] - rank[right.type]
    })

    for (const [rowKey, change] of orderedEntries) {
      try {
        if (change.type === 'delete') {
          const { data: result, errors } = await deleteRowMutation({
            variables: {
              schema: graphqlSchema,
              storageUnit: collectionName,
              values: [{ Key: 'document', Value: JSON.stringify({ _id: change.originalDocument._id }) }],
            },
            context: { database: databaseName },
          })

          if (errors?.length || !result?.DeleteRow.Status) {
            throw new Error(errors?.[0]?.message ?? t('mongodb.alert.deleteFailed'))
          }
        } else if (change.type === 'update') {
          const { data: result, errors } = await updateStorageUnitMutation({
            variables: {
              schema: graphqlSchema,
              storageUnit: collectionName,
              values: [{ Key: 'document', Value: JSON.stringify({ ...change.document, _id: change.originalDocument._id }) }],
              updatedColumns: Object.keys(change.document).filter((k) => k !== '_id'),
            },
            context: { database: databaseName },
          })

          if (errors?.length || !result?.UpdateStorageUnit.Status) {
            throw new Error(errors?.[0]?.message ?? t('mongodb.alert.updateFailed'))
          }
        } else {
          const { data: result, error } = await rawExecute({
            variables: {
              query: buildMongoInsertOneCommand(collectionName, change.document),
            },
            context: { database: databaseName },
          })

          if (error || !result?.RawExecute) {
            throw new Error(error?.message ?? t('mongodb.alert.addFailed'))
          }
        }

        successfulRowKeys.push(rowKey)
      } catch (error) {
        failedMessages.push(error instanceof Error ? error.message : String(error))
      }
    }

    if (failedMessages.length === 0) {
      dispatch({ type: 'discard-all' })
      refresh()
      showAlert(t('common.alert.success'), t('mongodb.changes.submitSuccess'), 'success')
      return
    }

    dispatch({ type: 'prune-successes', rowKeys: successfulRowKeys })
    refresh()
    const summary = t('mongodb.changes.submitPartialFailure', { count: failedMessages.length })
    const details = failedMessages.join('\n')
    showAlert(t('common.alert.error'), `${summary}\n\n${details}`, 'error')
  }, [
    collectionName,
    connectionId,
    connections,
    databaseName,
    deleteRowMutation,
    rawExecute,
    refresh,
    showAlert,
    state.session.changes,
    t,
    updateStorageUnitMutation,
  ])

  return {
    state: {
      changes: state.session.changes,
      undoStack: state.session.undoStack,
      selectedRowKeys: state.session.selectedRowKeys,
      newRowOrder: state.session.newRowOrder,
      pendingChangeCount: state.session.changes.size,
      hasPendingChanges: state.session.changes.size > 0,
      showPreviewModal: state.session.showPreviewModal,
      showSubmitModal: state.session.showSubmitModal,
      showDiscardModal: state.session.showDiscardModal,
      showAddModal: state.editor.showAddModal,
      addContent: state.editor.addContent,
      editingRowKey: state.editor.editingRowKey,
      editContent: state.editor.editContent,
    },
    actions: {
      toggleRowSelection,
      handleAddClick,
      setAddContent,
      handleAddSave,
      setShowAddModal,
      handleEditClick,
      setEditContent,
      handleEditSave,
      cancelEdit,
      markSelectedForDelete,
      undoLastChange,
      discardChanges,
      submitChanges,
      setShowPreviewModal,
      setShowSubmitModal,
      setShowDiscardModal,
    },
  }
}
