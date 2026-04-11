import { pruneChanges, pruneNewRowOrder, pruneSelectedRowKeys } from './helpers'
import type { StagedSessionState } from './types'

type InternalStagedSessionUndoEntry<TChange> = {
  kind: string
  rowKey?: string
  rowKeys?: string[]
  previousChanges?: Array<[string, TChange | undefined]>
}

function pruneUndoStack<TChange, TUndo extends InternalStagedSessionUndoEntry<TChange>>(
  undoStack: TUndo[],
  rowKeys: Set<string>,
): TUndo[] {
  if (rowKeys.size === 0) return [...undoStack]

  const nextUndoStack: TUndo[] = []
  for (const entry of undoStack) {
    if (entry.rowKey && rowKeys.has(entry.rowKey)) {
      continue
    }

    if (entry.rowKeys && entry.rowKeys.some((rowKey) => rowKeys.has(rowKey))) {
      const nextRowKeys = entry.rowKeys.filter((rowKey) => !rowKeys.has(rowKey))
      const nextPreviousChanges = entry.previousChanges
        ? entry.previousChanges.filter(([rowKey]) => !rowKeys.has(rowKey))
        : undefined

      if (nextRowKeys.length === 0) {
        continue
      }

      nextUndoStack.push({
        ...entry,
        rowKeys: nextRowKeys,
        previousChanges: nextPreviousChanges,
      })
      continue
    }

    nextUndoStack.push(entry)
  }

  return nextUndoStack
}

export type StagedSessionAction<TChange, TUndo> =
  | { type: 'toggle-selection'; rowKey: string }
  | { type: 'discard-all' }
  | { type: 'prune-successes'; rowKeys: string[] }
  | { type: 'set-show-preview-modal'; open: boolean }
  | { type: 'set-show-submit-modal'; open: boolean }
  | { type: 'set-show-discard-modal'; open: boolean }

export function createStagedSessionState<
  TChange,
  TUndo,
>(): StagedSessionState<TChange, TUndo> {
  return {
    changes: new Map(),
    selectedRowKeys: new Set(),
    newRowOrder: [],
    showPreviewModal: false,
    showSubmitModal: false,
    showDiscardModal: false,
    undoStack: [],
  }
}

export function stagedSessionReducer<TChange, TUndo extends InternalStagedSessionUndoEntry<TChange>>(
  state: StagedSessionState<TChange, TUndo>,
  action: StagedSessionAction<TChange, TUndo>,
): StagedSessionState<TChange, TUndo> {
  switch (action.type) {
    case 'toggle-selection': {
      const nextSelected = new Set(state.selectedRowKeys)
      if (nextSelected.has(action.rowKey)) {
        nextSelected.delete(action.rowKey)
      } else {
        nextSelected.add(action.rowKey)
      }
      return { ...state, selectedRowKeys: nextSelected }
    }

    case 'discard-all':
      return createStagedSessionState<TChange, TUndo>()

    case 'prune-successes': {
      const prunedKeys = new Set(action.rowKeys)
      if (prunedKeys.size === 0) return state

      return {
        ...state,
        changes: pruneChanges(state.changes, prunedKeys),
        selectedRowKeys: pruneSelectedRowKeys(state.selectedRowKeys, prunedKeys),
        newRowOrder: pruneNewRowOrder(state.newRowOrder, prunedKeys),
        undoStack: pruneUndoStack(state.undoStack, prunedKeys),
      }
    }

    case 'set-show-preview-modal':
      return { ...state, showPreviewModal: action.open }

    case 'set-show-submit-modal':
      return { ...state, showSubmitModal: action.open }

    case 'set-show-discard-modal':
      return { ...state, showDiscardModal: action.open }

    default:
      return state
  }
}
