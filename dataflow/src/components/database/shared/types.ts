import type { LucideIcon } from 'lucide-react'
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

/** Props for the toolbar layout shell. */
export interface ToolbarProps {
  icon: LucideIcon
  /** CSS class applied to the icon wrapper (e.g., "bg-primary/10"). */
  iconClassName?: string
  /** CSS class applied to the icon itself (e.g., "text-primary"). */
  iconColor?: string
  title: string
  subtitle: string
  /** Optional count displayed next to title (e.g., total rows). */
  count?: number
  /** Action buttons rendered on the right side. */
  children?: React.ReactNode
}

/** A single dismissible filter chip. */
export interface FilterChip {
  id: string
  label: string
  value: string
  onRemove: () => void
}

