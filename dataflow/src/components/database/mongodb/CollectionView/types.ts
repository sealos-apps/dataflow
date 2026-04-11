import type { Alert } from '@/components/database/shared/types'
import type { FlatMongoFilter } from '@/components/database/mongodb/filter-collection.types'
import type { StagedSessionAction } from '@/components/database/shared/staged-session/reducer'
import type {
  StagedSessionNewRowOrderState,
  StagedSessionPublicState,
} from '@/components/database/shared/staged-session/types'

// ---- Document changeset types ----

export type DocumentChangesetRowKey = string

export interface DocumentChange {
  type: 'update' | 'insert' | 'delete'
  originalDocument: Record<string, unknown>
  document: Record<string, unknown>
}

export interface DocumentUndoEntryEdit {
  kind: 'edit'
  rowKey: DocumentChangesetRowKey
  previousDocument: Record<string, unknown>
}

export interface DocumentUndoEntryAdd {
  kind: 'add'
  rowKey: DocumentChangesetRowKey
}

export interface DocumentUndoEntryDelete {
  kind: 'delete'
  rowKeys: DocumentChangesetRowKey[]
  previousChanges: Array<[DocumentChangesetRowKey, DocumentChange | undefined]>
}

export type DocumentUndoEntry = DocumentUndoEntryEdit | DocumentUndoEntryAdd | DocumentUndoEntryDelete

export interface DocumentChangesetEditorState {
  showAddModal: boolean
  addContent: string
  editingRowKey: DocumentChangesetRowKey | null
  editContent: string
  /**
   * Local monotonic counter used to generate stable "new-*" row keys for inserted documents.
   * This stays Mongo-local because it is an editor implementation detail.
   */
  newRowCounter: number
}

export type DocumentChangesetSessionAction = StagedSessionAction<DocumentChange, DocumentUndoEntry>

export type DocumentChangesetAction =
  | {
      type: 'stage-add'
      rowKey: DocumentChangesetRowKey
      document: Record<string, unknown>
    }
  | {
      type: 'stage-edit'
      rowKey: DocumentChangesetRowKey
      originalDocument: Record<string, unknown>
      document: Record<string, unknown>
      isInsert: boolean
    }
  | {
      type: 'delete-selected'
      rows: Array<{
        rowKey: DocumentChangesetRowKey
        originalDocument: Record<string, unknown>
        isInserted: boolean
      }>
    }
  | { type: 'undo' }
  | { type: 'open-add-modal'; content: string }
  | { type: 'set-add-content'; content: string }
  | { type: 'close-add-modal' }
  | { type: 'open-edit-modal'; rowKey: DocumentChangesetRowKey; content: string }
  | { type: 'set-edit-content'; content: string }
  | { type: 'close-edit-modal' }
  | DocumentChangesetSessionAction

export type DocumentChangesetSessionPublicState =
  & StagedSessionPublicState<DocumentChangesetRowKey, DocumentChange, DocumentUndoEntry>
  & StagedSessionNewRowOrderState<DocumentChangesetRowKey>

export type DocumentChangesetEditorPublicState = Pick<
  DocumentChangesetEditorState,
  'showAddModal' | 'addContent' | 'editingRowKey' | 'editContent'
>

/** Context value exposed by CollectionViewProvider. */
export interface CollectionViewContextValue {
  state: CollectionViewState
  actions: CollectionViewActions
}

/** All state managed by the CollectionView provider. */
export interface CollectionViewState extends DocumentChangesetSessionPublicState, DocumentChangesetEditorPublicState {
  loading: boolean
  documents: any[]
  error: string | null
  currentPage: number
  pageSize: number
  total: number
  totalPages: number
  searchTerm: string
  activeFilter: FlatMongoFilter
  availableFields: string[]
  showExportModal: boolean
  isFilterModalOpen: boolean
  alert: Alert | null
}

/** All actions exposed by the CollectionView provider. */
export interface CollectionViewActions {
  refresh: () => void
  handlePageChange: (page: number) => void
  handlePageSizeChange: (size: number) => void
  setSearchTerm: (term: string) => void
  setIsFilterModalOpen: (open: boolean) => void
  handleFilterApply: (filter: FlatMongoFilter) => void
  setShowExportModal: (open: boolean) => void
  showAlert: (title: string, message: string, type: Alert['type']) => void
  closeAlert: () => void

  // Changeset actions
  toggleRowSelection: (rowKey: DocumentChangesetRowKey) => void
  markSelectedForDelete: () => void
  undoLastChange: () => void
  discardChanges: () => void
  submitChanges: () => Promise<void>
  setShowPreviewModal: (open: boolean) => void
  setShowSubmitModal: (open: boolean) => void
  setShowDiscardModal: (open: boolean) => void
  confirmDiscardAndContinue: () => void

  // Document editing (modal-based add/edit)
  handleAddClick: () => void
  setAddContent: (content: string) => void
  handleAddSave: () => Promise<void>
  setShowAddModal: (open: boolean) => void
  handleEditClick: (rowKey: DocumentChangesetRowKey) => void
  setEditContent: (content: string) => void
  handleEditSave: () => Promise<void>
  cancelEdit: () => void
}
