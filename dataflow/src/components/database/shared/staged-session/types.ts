/**
 * Public boundary "slices" for providers that implement staged editing flows.
 *
 * These types intentionally avoid exposing the internal reducer state object
 * (for example `session: StagedSessionState<...>`) from provider APIs.
 * Providers should remain domain-first, but can source common fields from here.
 */

export interface StagedSessionPendingChangesState {
  pendingChangeCount: number
  hasPendingChanges: boolean
}

export interface StagedSessionModalState {
  showPreviewModal: boolean
  showSubmitModal: boolean
  showDiscardModal: boolean
}

export interface StagedSessionRowSelectionState<TRowKey extends string = string> {
  selectedRowKeys: Set<TRowKey>
}

export interface StagedSessionUndoState<TUndo> {
  undoStack: TUndo[]
}

export interface StagedSessionChangesState<TRowKey extends string = string, TChange = unknown> {
  changes: Map<TRowKey, TChange>
}

export interface StagedSessionNewRowOrderState<TRowKey extends string = string> {
  newRowOrder: TRowKey[]
}

export interface StagedSessionState<TChange, TUndo> extends
  StagedSessionChangesState<string, TChange>,
  StagedSessionRowSelectionState<string>,
  StagedSessionNewRowOrderState<string>,
  StagedSessionModalState,
  StagedSessionUndoState<TUndo> {}

export type StagedSessionPublicState<TRowKey extends string, TChange, TUndo> =
  & StagedSessionChangesState<TRowKey, TChange>
  & StagedSessionRowSelectionState<TRowKey>
  & StagedSessionUndoState<TUndo>
  & StagedSessionPendingChangesState
  & StagedSessionModalState
