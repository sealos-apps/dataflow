import type { LucideIcon } from 'lucide-react'

/** Base state shared by all modal providers. Per-modal Providers extend this with domain-specific fields. */
export interface ModalState {
  isSubmitting: boolean
  alert: ModalAlert | null
}

/** Alert data displayed inline within a modal. */
export interface ModalAlert {
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

/** Base actions shared by all modal providers. Per-modal Providers must supply `submit`. */
export interface ModalActions {
  submit: () => Promise<void>
  reset: () => void
  setSubmitting: (v: boolean) => void
  setAlert: (alert: ModalAlert | null) => void
  closeAlert: () => void
}

/** Display metadata for a modal — title, icon, destructive flag. */
export interface ModalMeta {
  title: string
  description?: string
  icon?: LucideIcon
  isDestructive?: boolean
}

/** Combined context value consumed by ModalForm compound components. */
export interface ModalContextValue<
  S extends ModalState = ModalState,
  A extends ModalActions = ModalActions,
> {
  state: S
  actions: A
  meta: ModalMeta
}
