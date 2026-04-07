import type { Alert } from '@/components/database/shared/types'
import type { RedisKeyDraft } from '@/components/database/redis/redis-key.types'

/** A single Redis key entry. */
export interface RedisKey {
  key: string
  type: string
  size: string
}

/** Context value exposed by RedisViewProvider. */
export interface RedisViewContextValue {
  state: RedisViewState
  actions: RedisViewActions
}

/** All state managed by the RedisView provider. */
export interface RedisViewState {
  keys: RedisKey[]
  filteredKeys: RedisKey[]
  loading: boolean
  total: number
  currentPage: number
  pageSize: number
  totalPages: number
  pattern: string
  filterTypes: string[]
  isFilterModalOpen: boolean
  isAddModalOpen: boolean
  editingKey: RedisKeyDraft | undefined
  deletingKey: RedisKey | undefined
  showExportModal: boolean
  alert: Alert | null
}

/** All actions exposed by the RedisView provider. */
export interface RedisViewActions {
  refresh: () => Promise<void>
  handlePageChange: (page: number) => void
  handlePageSizeChange: (size: number) => void
  handleApplyFilter: (newPattern: string, newTypes: string[]) => void
  setIsFilterModalOpen: (open: boolean) => void
  handleEditKey: (key: RedisKey) => Promise<void>
  handleSaveKey: (draft: RedisKeyDraft) => Promise<void>
  handleConfirmDelete: () => Promise<void>
  openAddModal: () => void
  setIsAddModalOpen: (open: boolean) => void
  setEditingKey: (key: RedisViewState['editingKey']) => void
  setDeletingKey: (key: RedisKey | undefined) => void
  setShowExportModal: (open: boolean) => void
  closeAlert: () => void
}
