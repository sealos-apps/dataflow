import type { SqlDialect } from '@/utils/ddl-sql'

/** Column definition for the Edit Table columns tab. */
export interface ColumnDefinition {
  id: string
  name: string
  type: string
  isPrimaryKey: boolean
  isNullable: boolean
  isNew?: boolean
  isMarkedForDeletion?: boolean
}

/** Index definition for the Edit Table indexes tab. */
export interface IndexDefinition {
  id: string
  name: string
  columns: string[]
  type: string
  isUnique: boolean
  isNew?: boolean
  isMarkedForDeletion?: boolean
}

/** Foreign key definition for the Edit Table foreign keys tab. */
export interface ForeignKeyDefinition {
  id: string
  name: string
  column: string
  referencedTable: string
  referencedColumn: string
  onDelete: string
  onUpdate: string
  isNew?: boolean
  isMarkedForDeletion?: boolean
}

export type EditTableTab = 'fields' | 'indexes' | 'foreignKeys'

/** Result of a single DDL operation within a batch apply. */
export interface OperationResult {
  label: string
  success: boolean
  message: string
  sql?: string
}

/** State exposed by EditTableProvider. */
export interface EditTableState {
  columns: ColumnDefinition[]
  indexes: IndexDefinition[]
  foreignKeys: ForeignKeyDefinition[]
  activeTab: EditTableTab
  isLoading: boolean
  isExecuting: boolean
  dialect: SqlDialect
  /** Column names derived from current columns, used by index column selectors and FK column selectors. */
  columnNames: string[]
  /** Number of pending changes across all tabs. */
  pendingChangeCount: number
}

/** Actions exposed by EditTableProvider. */
export interface EditTableActions {
  setActiveTab: (tab: EditTableTab) => void
  // Column operations
  addColumn: () => void
  updateColumn: (id: string, field: keyof ColumnDefinition, value: string | boolean) => void
  /** Remove a new (unsaved) column from the list, or toggle deletion mark on an existing column. */
  toggleColumnDeletion: (col: ColumnDefinition) => void
  // Index operations
  addIndex: () => void
  updateIndex: (id: string, field: keyof IndexDefinition, value: string | boolean | string[]) => void
  /** Remove a new (unsaved) index from the list, or toggle deletion mark on an existing index. */
  toggleIndexDeletion: (idx: IndexDefinition) => void
  // Foreign key operations
  addForeignKey: () => void
  updateForeignKey: (id: string, field: keyof ForeignKeyDefinition, value: string) => void
  /** Remove a new (unsaved) FK from the list, or toggle deletion mark on an existing FK. */
  toggleForeignKeyDeletion: (fk: ForeignKeyDefinition) => void
  /** Apply all pending changes (additions, modifications, deletions) as a batch. */
  applyAllChanges: () => Promise<void>
}

/** Combined context value for EditTable. */
export interface EditTableContextValue {
  state: EditTableState
  actions: EditTableActions
}
