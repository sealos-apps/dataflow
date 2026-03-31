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

/** Unified alert type. `null` = no alert active. Replaces both ModalAlert and AlertState. */
export type Alert = ModalAlert

/** Base actions shared by all modal providers. */
export interface ModalActions {
  /** Only present when onSubmit was provided to ModalForm.Provider. */
  submit?: () => Promise<void>
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
export interface ModalContextValue {
  state: ModalState
  actions: ModalActions
  meta: ModalMeta
}
