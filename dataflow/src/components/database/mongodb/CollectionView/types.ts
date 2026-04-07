import type { Alert } from '@/components/database/shared/types'
import type { FlatMongoFilter } from '@/components/database/mongodb/filter-collection.types'
import type { DocumentEditingState, DocumentEditingActions } from './useDocumentEditing'

/** Context value exposed by CollectionViewProvider. */
export interface CollectionViewContextValue {
  state: CollectionViewState
  actions: CollectionViewActions
}

/** All state managed by the CollectionView provider. */
export interface CollectionViewState extends DocumentEditingState {
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
export interface CollectionViewActions extends DocumentEditingActions {
  refresh: () => void
  handlePageChange: (page: number) => void
  handlePageSizeChange: (size: number) => void
  setSearchTerm: (term: string) => void
  setIsFilterModalOpen: (open: boolean) => void
  handleFilterApply: (filter: FlatMongoFilter) => void
  setShowExportModal: (open: boolean) => void
  showAlert: (title: string, message: string, type: Alert['type']) => void
  closeAlert: () => void
}
