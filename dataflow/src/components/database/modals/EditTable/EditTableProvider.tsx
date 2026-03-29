import {
  createContext,
  use,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { Table } from 'lucide-react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
  useRawExecuteLazyQuery,
  useExecuteConfirmedSqlMutation,
} from '@graphql'
import type { SqlDialect } from '@/utils/ddl-sql'
import {
  columnsQuery,
  indexesQuery,
  foreignKeysQuery,
  addColumnSQL,
  dropColumnSQL,
  modifyColumnSQL,
  createIndexSQL,
  dropIndexSQL,
  addForeignKeySQL,
  dropForeignKeySQL,
} from '@/utils/ddl-sql'
import { ModalForm } from '@/components/database/modals/ModalForm'
import { useModalState } from '@/components/database/modals/useModalState'
import type { ModalMeta } from '@/components/database/modals/types'
import type {
  ColumnDefinition,
  IndexDefinition,
  ForeignKeyDefinition,
  EditTableTab,
  EditTableActions,
  EditTableContextValue,
} from './types'

const EditTableCtx = createContext<EditTableContextValue | null>(null)

/** Hook to access EditTable domain context. Throws outside provider. */
export function useEditTable(): EditTableContextValue {
  const ctx = use(EditTableCtx)
  if (!ctx) throw new Error('useEditTable must be used within EditTableProvider')
  return ctx
}

interface EditTableProviderProps {
  connectionId: string
  databaseName: string
  tableName: string
  schema?: string
  children: ReactNode
}

interface OperationResult {
  success: boolean
  message: string
  executedSql?: string
}

/** Provider that owns all state, schema fetching, DDL execution, and per-row CRUD handlers for editing a table. */
export function EditTableProvider({
  connectionId,
  databaseName,
  tableName,
  schema,
  children,
}: EditTableProviderProps) {
  const { connections } = useConnectionStore()
  const conn = connections.find(c => c.id === connectionId)

  const dialect: SqlDialect = (() => {
    const dbType = conn?.type
    const map: Record<string, SqlDialect> = {
      MYSQL: 'MYSQL', POSTGRES: 'POSTGRES', MARIADB: 'MARIADB',
      SQLITE3: 'SQLITE3', CLICKHOUSE: 'CLICKHOUSE',
    }
    return map[dbType ?? ''] ?? 'POSTGRES'
  })()

  const [columns, setColumns] = useState<ColumnDefinition[]>([])
  const [originalColumns, setOriginalColumns] = useState<ColumnDefinition[]>([])
  const [indexes, setIndexes] = useState<IndexDefinition[]>([])
  const [originalIndexes, setOriginalIndexes] = useState<IndexDefinition[]>([])
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyDefinition[]>([])
  const [originalForeignKeys, setOriginalForeignKeys] = useState<ForeignKeyDefinition[]>([])
  const [activeTab, setActiveTab] = useState<EditTableTab>('fields')
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)

  const { state: modalState, actions: baseActions } = useModalState()

  const [rawExecute] = useRawExecuteLazyQuery({ fetchPolicy: 'no-cache' })
  const [executeConfirmedSql] = useExecuteConfirmedSqlMutation()

  // ---------------------------------------------------------------------------
  // Schema fetch
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchTableSchema()
  }, [])

  const fetchTableSchema = async () => {
    setIsLoading(true)
    if (!conn) { setIsLoading(false); return }

    try {
      // Fetch columns
      const { data: colData } = await rawExecute({
        variables: { query: columnsQuery(dialect, databaseName, tableName, schema) },
        context: { database: databaseName },
      })
      if (colData?.RawExecute) {
        const colNames = colData.RawExecute.Columns.map(c => c.Name.toLowerCase())
        const cols: ColumnDefinition[] = colData.RawExecute.Rows.map((row, i) => {
          const get = (name: string) => row[colNames.indexOf(name)] ?? ''
          return {
            id: `col_${i}`,
            name: get('column_name') || get('name'),
            type: get('column_type') || get('data_type') || get('type'),
            isPrimaryKey: (get('column_key') || get('pk')) === 'PRI' || get('pk') === '1',
            isNullable: (get('is_nullable') || get('notnull')) !== 'NO' && get('notnull') !== '1',
            comment: get('column_comment') || '',
            isNew: false,
          }
        })
        setColumns(cols)
        setOriginalColumns(structuredClone(cols))
      }

      // Fetch indexes
      const { data: idxData } = await rawExecute({
        variables: { query: indexesQuery(dialect, databaseName, tableName, schema) },
        context: { database: databaseName },
      })
      if (idxData?.RawExecute) {
        const idxNames = idxData.RawExecute.Columns.map(c => c.Name.toLowerCase())
        const idxs: IndexDefinition[] = idxData.RawExecute.Rows.map((row, i) => {
          const get = (name: string) => row[idxNames.indexOf(name)] ?? ''
          return {
            id: `idx_${i}`,
            name: get('index_name') || get('name'),
            columns: (get('columns') || get('column_name') || '').split(',').filter(Boolean),
            type: get('index_type') || 'BTREE',
            isUnique: get('is_unique') === 'true' || get('is_unique') === 't' || get('non_unique') === '0',
            comment: '',
            isNew: false,
          }
        })
        setIndexes(idxs)
        setOriginalIndexes(structuredClone(idxs))
      }

      // Fetch foreign keys
      const { data: fkData } = await rawExecute({
        variables: { query: foreignKeysQuery(dialect, databaseName, tableName, schema) },
        context: { database: databaseName },
      })
      if (fkData?.RawExecute) {
        const fkNames = fkData.RawExecute.Columns.map(c => c.Name.toLowerCase())
        const fks: ForeignKeyDefinition[] = fkData.RawExecute.Rows.map((row, i) => {
          const get = (name: string) => row[fkNames.indexOf(name)] ?? ''
          return {
            id: `fk_${i}`,
            name: get('constraint_name'),
            column: get('column_name'),
            referencedTable: get('referenced_table_name'),
            referencedColumn: get('referenced_column_name'),
            onDelete: get('delete_rule') || 'RESTRICT',
            onUpdate: get('update_rule') || 'RESTRICT',
            isNew: false,
          }
        })
        setForeignKeys(fks)
        setOriginalForeignKeys(structuredClone(fks))
      }
    } catch (error) {
      baseActions.setAlert({
        type: 'error',
        title: 'Failed to load schema',
        message: String(error),
      })
      setColumns([])
      setIndexes([])
      setForeignKeys([])
    }
    setIsLoading(false)
  }

  // ---------------------------------------------------------------------------
  // DDL execution helper
  // ---------------------------------------------------------------------------

  const executeOperation = async (sql: string): Promise<OperationResult> => {
    const statements = sql.split(';\n').map(s => s.trim()).filter(Boolean)
    const allSql = sql

    for (const stmt of statements) {
      try {
        const { data, errors } = await executeConfirmedSql({
          variables: { query: stmt, operationType: 'DDL' },
          context: { database: databaseName },
        })
        if (errors?.length) {
          return { success: false, message: errors[0].message, executedSql: allSql }
        }
        const msg = data?.ExecuteConfirmedSQL
        if (msg?.Type === 'error') {
          return { success: false, message: msg.Text, executedSql: allSql }
        }
      } catch (err: unknown) {
        return { success: false, message: (err as Error).message, executedSql: allSql }
      }
    }
    return { success: true, message: 'Operation completed', executedSql: allSql }
  }

  // ---------------------------------------------------------------------------
  // Alert display helper
  // ---------------------------------------------------------------------------

  const showResult = (result: OperationResult) => {
    if (result.success) {
      baseActions.setAlert({
        type: 'success',
        title: 'Operation completed',
        message: result.executedSql ?? '',
      })
    } else {
      baseActions.setAlert({
        type: 'error',
        title: 'Operation failed',
        message: result.message + (result.executedSql ? `\n\nSQL: ${result.executedSql}` : ''),
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Column handlers
  // ---------------------------------------------------------------------------

  const addColumn = () => {
    setColumns(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 11),
        name: '',
        type: 'VARCHAR(255)',
        isPrimaryKey: false,
        isNullable: true,
        comment: '',
        isNew: true,
      },
    ])
  }

  const removeColumn = async (col: ColumnDefinition) => {
    if (col.isNew) {
      setColumns(prev => prev.filter(c => c.id !== col.id))
      return
    }

    setIsExecuting(true)
    const sql = dropColumnSQL(dialect, tableName, col.name, schema)
    const result = await executeOperation(sql)
    showResult(result)
    setIsExecuting(false)

    if (result.success) {
      setColumns(prev => prev.filter(c => c.id !== col.id))
      setOriginalColumns(prev => prev.filter(c => c.name !== col.name))
    }
  }

  const updateColumn = (id: string, field: keyof ColumnDefinition, value: string | boolean) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const saveColumn = async (col: ColumnDefinition) => {
    if (!col.name.trim()) {
      showResult({ success: false, message: 'Column name is required' })
      return
    }

    setIsExecuting(true)

    const sql = col.isNew
      ? addColumnSQL(dialect, tableName, col.name, col.type, col.isNullable, schema)
      : modifyColumnSQL(dialect, tableName, col.name, col.type, col.isNullable, schema)
    const result = await executeOperation(sql)

    showResult(result)
    setIsExecuting(false)

    if (result.success) {
      setColumns(prev => prev.map(c => c.id === col.id ? { ...c, isNew: false } : c))
      if (col.isNew) {
        setOriginalColumns(prev => [...prev, { ...col, isNew: false }])
      } else {
        setOriginalColumns(prev =>
          prev.map(c => c.name === col.name ? { ...col, isNew: false } : c),
        )
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Index handlers
  // ---------------------------------------------------------------------------

  const addIndex = () => {
    setIndexes(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 11),
        name: `idx_${tableName}_${Math.random().toString(36).substring(2, 7)}`,
        columns: [],
        type: 'BTREE',
        isUnique: false,
        comment: '',
        isNew: true,
      },
    ])
  }

  const removeIndex = async (idx: IndexDefinition) => {
    if (idx.isNew) {
      setIndexes(prev => prev.filter(i => i.id !== idx.id))
      return
    }

    setIsExecuting(true)
    const sql = dropIndexSQL(dialect, tableName, idx.name, schema)
    const result = await executeOperation(sql)
    showResult(result)
    setIsExecuting(false)

    if (result.success) {
      setIndexes(prev => prev.filter(i => i.id !== idx.id))
      setOriginalIndexes(prev => prev.filter(i => i.name !== idx.name))
    }
  }

  const updateIndex = (id: string, field: keyof IndexDefinition, value: string | boolean | string[]) => {
    setIndexes(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const saveIndex = async (idx: IndexDefinition) => {
    if (!idx.name.trim()) {
      showResult({ success: false, message: 'Index name is required' })
      return
    }
    if (idx.columns.length === 0) {
      showResult({ success: false, message: 'Please select at least one column for the index' })
      return
    }

    setIsExecuting(true)

    // For existing indexes, drop and recreate
    if (!idx.isNew) {
      const originalIdx = originalIndexes.find(oi => oi.id === idx.id)
      const nameToDrop = originalIdx ? originalIdx.name : idx.name

      const dropSql = dropIndexSQL(dialect, tableName, nameToDrop, schema)
      const dropResult = await executeOperation(dropSql)
      if (!dropResult.success) {
        showResult(dropResult)
        setIsExecuting(false)
        return
      }
    }

    const createSql = createIndexSQL(dialect, tableName, idx.name, idx.columns, idx.isUnique, schema)
    const result = await executeOperation(createSql)

    showResult(result)
    setIsExecuting(false)

    if (result.success) {
      setIndexes(prev => prev.map(i => i.id === idx.id ? { ...i, isNew: false } : i))
      if (idx.isNew) {
        setOriginalIndexes(prev => [...prev, { ...idx, isNew: false }])
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Foreign key handlers
  // ---------------------------------------------------------------------------

  const addForeignKey = () => {
    setForeignKeys(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 11),
        name: `fk_${tableName}_${Math.random().toString(36).substring(2, 7)}`,
        column: '',
        referencedTable: '',
        referencedColumn: '',
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
        isNew: true,
      },
    ])
  }

  const removeForeignKey = async (fk: ForeignKeyDefinition) => {
    if (fk.isNew) {
      setForeignKeys(prev => prev.filter(f => f.id !== fk.id))
      return
    }

    setIsExecuting(true)
    const sql = dropForeignKeySQL(dialect, tableName, fk.name, schema)
    const result = await executeOperation(sql)
    showResult(result)
    setIsExecuting(false)

    if (result.success) {
      setForeignKeys(prev => prev.filter(f => f.id !== fk.id))
      setOriginalForeignKeys(prev => prev.filter(f => f.name !== fk.name))
    }
  }

  const updateForeignKey = (id: string, field: keyof ForeignKeyDefinition, value: string) => {
    setForeignKeys(prev => prev.map(fk => fk.id === id ? { ...fk, [field]: value } : fk))
  }

  const saveForeignKey = async (fk: ForeignKeyDefinition) => {
    if (!fk.name.trim() || !fk.column.trim() || !fk.referencedTable.trim() || !fk.referencedColumn.trim()) {
      showResult({ success: false, message: 'All foreign key fields are required' })
      return
    }

    setIsExecuting(true)

    // For existing FKs, drop first
    if (!fk.isNew) {
      const dropSql = dropForeignKeySQL(dialect, tableName, fk.name, schema)
      const dropResult = await executeOperation(dropSql)
      if (!dropResult.success) {
        showResult(dropResult)
        setIsExecuting(false)
        return
      }
    }

    const sql = addForeignKeySQL(
      dialect, tableName, fk.name, fk.column,
      fk.referencedTable, fk.referencedColumn,
      fk.onDelete, fk.onUpdate, schema,
    )
    const result = await executeOperation(sql)

    showResult(result)
    setIsExecuting(false)

    if (result.success) {
      setForeignKeys(prev => prev.map(f => f.id === fk.id ? { ...f, isNew: false } : f))
      if (fk.isNew) {
        setOriginalForeignKeys(prev => [...prev, { ...fk, isNew: false }])
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const columnNames = useMemo(
    () => columns.filter(c => c.name.trim()).map(c => c.name),
    [columns],
  )

  // ---------------------------------------------------------------------------
  // Context assembly
  // ---------------------------------------------------------------------------

  const actions: EditTableActions = {
    setActiveTab,
    addColumn,
    removeColumn,
    updateColumn,
    saveColumn,
    addIndex,
    removeIndex,
    updateIndex,
    saveIndex,
    addForeignKey,
    removeForeignKey,
    updateForeignKey,
    saveForeignKey,
  }

  const modalActions = { ...baseActions, submit: async () => {} }
  const meta: ModalMeta = { title: `Edit Table: ${tableName}`, icon: Table }

  return (
    <EditTableCtx value={{
      state: { columns, indexes, foreignKeys, activeTab, isLoading, isExecuting, dialect, columnNames },
      actions,
    }}>
      <ModalForm.Provider state={modalState} actions={modalActions} meta={meta}>
        {children}
      </ModalForm.Provider>
    </EditTableCtx>
  )
}
