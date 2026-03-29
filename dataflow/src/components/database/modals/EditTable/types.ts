import type { SqlDialect } from '@/utils/ddl-sql'

/** Column definition for the Edit Table columns tab. */
export interface ColumnDefinition {
  id: string
  name: string
  type: string
  isPrimaryKey: boolean
  isNullable: boolean
  comment: string
  isNew?: boolean
}

/** Index definition for the Edit Table indexes tab. */
export interface IndexDefinition {
  id: string
  name: string
  columns: string[]
  type: string
  isUnique: boolean
  comment: string
  isNew?: boolean
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
}

export type EditTableTab = 'fields' | 'indexes' | 'foreignKeys'

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
}

/** Actions exposed by EditTableProvider. */
export interface EditTableActions {
  setActiveTab: (tab: EditTableTab) => void
  // Column operations
  addColumn: () => void
  removeColumn: (col: ColumnDefinition) => Promise<void>
  updateColumn: (id: string, field: keyof ColumnDefinition, value: string | boolean) => void
  saveColumn: (col: ColumnDefinition) => Promise<void>
  // Index operations
  addIndex: () => void
  removeIndex: (idx: IndexDefinition) => Promise<void>
  updateIndex: (id: string, field: keyof IndexDefinition, value: string | boolean | string[]) => void
  saveIndex: (idx: IndexDefinition) => Promise<void>
  // Foreign key operations
  addForeignKey: () => void
  removeForeignKey: (fk: ForeignKeyDefinition) => Promise<void>
  updateForeignKey: (id: string, field: keyof ForeignKeyDefinition, value: string) => void
  saveForeignKey: (fk: ForeignKeyDefinition) => Promise<void>
}

/** Combined context value for EditTable. */
export interface EditTableContextValue {
  state: EditTableState
  actions: EditTableActions
}
