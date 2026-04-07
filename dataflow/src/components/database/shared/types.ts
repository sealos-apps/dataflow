import type { Alert } from '@/components/ui/types'

export type { Alert }

/** Props for the shared pagination controls. */
export interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  loading?: boolean
  /** Label for items (e.g., "keys", "documents"). Defaults to empty string. */
  itemLabel?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

/** A single dismissible filter chip. */
export interface FilterChip {
  id: string
  label: string
  value: string
  onRemove: () => void
}

