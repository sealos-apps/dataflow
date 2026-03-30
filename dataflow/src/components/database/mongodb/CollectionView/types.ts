import type { AlertState } from '@/components/database/shared/types'
import type { FlatMongoFilter } from '@/components/database/mongodb/filter-collection.types'

/** Context value exposed by CollectionViewProvider. */
export interface CollectionViewContextValue {
  state: CollectionViewState
  actions: CollectionViewActions
}

/** All state managed by the CollectionView provider. */
export interface CollectionViewState {
  loading: boolean
  documents: any[]
  error: string | null
  currentPage: number
  pageSize: number
  totalDocuments: number
  totalPages: number
  searchTerm: string
  activeFilter: FlatMongoFilter
  availableFields: string[]
  selectedDocIndex: number | null
  showAddModal: boolean
  showExportModal: boolean
  showFilterModal: boolean
  showDeleteModal: boolean
  editingDoc: any | null
  editContent: string
  addContent: string
  deletingDocId: string | null
  alertState: AlertState
}

/** All actions exposed by the CollectionView provider. */
export interface CollectionViewActions {
  refresh: () => void
  handlePageChange: (page: number) => void
  handlePageSizeChange: (size: number) => void
  setSearchTerm: (term: string) => void
  handleAddClick: () => void
  setShowAddModal: (open: boolean) => void
  setAddContent: (content: string) => void
  handleAddSave: () => Promise<void>
  handleEditClick: (doc: any) => void
  setEditingDoc: (doc: any | null) => void
  setEditContent: (content: string) => void
  handleSave: () => Promise<void>
  handleDeleteClick: (docId: string) => void
  handleConfirmDelete: () => Promise<void>
  setShowDeleteModal: (open: boolean) => void
  setShowFilterModal: (open: boolean) => void
  handleFilterApply: (filter: FlatMongoFilter) => void
  setShowExportModal: (open: boolean) => void
  setSelectedDocIndex: (index: number | null) => void
  showAlert: (title: string, message: string, type: AlertState['type']) => void
  closeAlert: () => void
}
