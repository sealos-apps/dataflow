import {
  createContext,
  use,
  useState,
  useEffect,
  useMemo,
  useCallback,
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
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import type { ModalMeta } from '@/components/ui/types'
import { useI18n } from '@/i18n/useI18n'
import type {
  ColumnDefinition,
  IndexDefinition,
  ForeignKeyDefinition,
  EditTableTab,
  EditTableActions,
  EditTableContextValue,
  OperationResult,
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

/** Wraps ModalForm.Provider (complex mode, no onSubmit) and domain context for editing table schema. */
export function EditTableProvider({
  connectionId,
  databaseName,
  tableName,
  schema,
  children,
}: EditTableProviderProps) {
  const { t } = useI18n()
  const meta: ModalMeta = { title: t('sql.editTable.title', { tableName }), icon: Table }

  return (
    <ModalForm.Provider meta={meta}>
      <EditTableBridge
        connectionId={connectionId}
        databaseName={databaseName}
        tableName={tableName}
        schema={schema}
      >
        {children}
      </EditTableBridge>
    </ModalForm.Provider>
  )
}

export function resolveForeignKeyDropName(
  foreignKey: ForeignKeyDefinition,
  originalForeignKeys: ForeignKeyDefinition[],
) {
  return originalForeignKeys.find((originalForeignKey) => originalForeignKey.id === foreignKey.id)?.name ?? foreignKey.name
}

/** Inner bridge that owns all state, schema fetching, DDL execution, and batch CRUD handlers. */
function EditTableBridge({
  connectionId,
  databaseName,
  tableName,
  schema,
  children,
}: {
  connectionId: string
  databaseName: string
  tableName: string
  schema?: string
  children: ReactNode
}) {
  const { t } = useI18n()
  const { connections } = useConnectionStore()
  const conn = connections.find(c => c.id === connectionId)
  const { actions: modalActions } = useModalForm()

  const dialect: SqlDialect = (() => {
    const dbType = conn?.type
    const map: Record<string, SqlDialect> = {
      MYSQL: 'MYSQL', POSTGRES: 'POSTGRES',
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
      modalActions.setAlert({
        type: 'error',
        title: t('sql.editTable.loadSchemaFailed'),
        message: String(error),
      })
      setColumns([])
      setIndexes([])
      setForeignKeys([])
    }
    setIsLoading(false)
  }

  // ---------------------------------------------------------------------------
  // DDL execution helper (single statement)
  // ---------------------------------------------------------------------------

  const executeSingleStatement = async (sql: string): Promise<{ success: boolean; message: string }> => {
    const statements = sql.split(';\n').map(s => s.trim()).filter(Boolean)

    for (const stmt of statements) {
      try {
        const { data, errors } = await executeConfirmedSql({
          variables: { query: stmt, operationType: 'DDL' },
          context: { database: databaseName },
        })
        if (errors?.length) {
          return { success: false, message: errors[0].message }
        }
        const msg = data?.ExecuteConfirmedSQL
        if (msg?.Type === 'error') {
          return { success: false, message: msg.Text }
        }
      } catch (err: unknown) {
        return { success: false, message: (err as Error).message }
      }
    }
    return { success: true, message: '' }
  }

  // ---------------------------------------------------------------------------
  // Change detection
  // ---------------------------------------------------------------------------

  const isColumnModified = useCallback((col: ColumnDefinition): boolean => {
    const original = originalColumns.find(c => c.id === col.id)
    if (!original) return false
    return col.type !== original.type || col.isNullable !== original.isNullable
  }, [originalColumns])

  const isIndexModified = useCallback((idx: IndexDefinition): boolean => {
    const original = originalIndexes.find(i => i.id === idx.id)
    if (!original) return false
    return idx.name !== original.name
      || idx.isUnique !== original.isUnique
      || JSON.stringify(idx.columns) !== JSON.stringify(original.columns)
  }, [originalIndexes])

  const isForeignKeyModified = useCallback((fk: ForeignKeyDefinition): boolean => {
    const original = originalForeignKeys.find(f => f.id === fk.id)
    if (!original) return false
    return fk.name !== original.name
      || fk.column !== original.column
      || fk.referencedTable !== original.referencedTable
      || fk.referencedColumn !== original.referencedColumn
      || fk.onDelete !== original.onDelete
      || fk.onUpdate !== original.onUpdate
  }, [originalForeignKeys])

  const pendingChangeCount = useMemo(() => {
    const colChanges =
      columns.filter(c => c.isNew && !c.isMarkedForDeletion).length
      + columns.filter(c => !c.isNew && c.isMarkedForDeletion).length
      + columns.filter(c => !c.isNew && !c.isMarkedForDeletion && isColumnModified(c)).length

    const idxChanges =
      indexes.filter(i => i.isNew && !i.isMarkedForDeletion).length
      + indexes.filter(i => !i.isNew && i.isMarkedForDeletion).length
      + indexes.filter(i => !i.isNew && !i.isMarkedForDeletion && isIndexModified(i)).length

    const fkChanges =
      foreignKeys.filter(f => f.isNew && !f.isMarkedForDeletion).length
      + foreignKeys.filter(f => !f.isNew && f.isMarkedForDeletion).length
      + foreignKeys.filter(f => !f.isNew && !f.isMarkedForDeletion && isForeignKeyModified(f)).length

    return colChanges + idxChanges + fkChanges
  }, [columns, indexes, foreignKeys, isColumnModified, isIndexModified, isForeignKeyModified])

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
        isNew: true,
      },
    ])
  }

  const updateColumn = (id: string, field: keyof ColumnDefinition, value: string | boolean) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const toggleColumnDeletion = (col: ColumnDefinition) => {
    if (col.isNew) {
      setColumns(prev => prev.filter(c => c.id !== col.id))
    } else {
      setColumns(prev => prev.map(c =>
        c.id === col.id ? { ...c, isMarkedForDeletion: !c.isMarkedForDeletion } : c,
      ))
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
        isNew: true,
      },
    ])
  }

  const updateIndex = (id: string, field: keyof IndexDefinition, value: string | boolean | string[]) => {
    setIndexes(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const toggleIndexDeletion = (idx: IndexDefinition) => {
    if (idx.isNew) {
      setIndexes(prev => prev.filter(i => i.id !== idx.id))
    } else {
      setIndexes(prev => prev.map(i =>
        i.id === idx.id ? { ...i, isMarkedForDeletion: !i.isMarkedForDeletion } : i,
      ))
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

  const updateForeignKey = (id: string, field: keyof ForeignKeyDefinition, value: string) => {
    setForeignKeys(prev => prev.map(fk => fk.id === id ? { ...fk, [field]: value } : fk))
  }

  const toggleForeignKeyDeletion = (fk: ForeignKeyDefinition) => {
    if (fk.isNew) {
      setForeignKeys(prev => prev.filter(f => f.id !== fk.id))
    } else {
      setForeignKeys(prev => prev.map(f =>
        f.id === fk.id ? { ...f, isMarkedForDeletion: !f.isMarkedForDeletion } : f,
      ))
    }
  }

  // ---------------------------------------------------------------------------
  // Batch apply
  // ---------------------------------------------------------------------------

  const applyAllChanges = async () => {
    const results: OperationResult[] = []

    // Validate new columns
    const newColumns = columns.filter(c => c.isNew && !c.isMarkedForDeletion)
    for (const col of newColumns) {
      if (!col.name.trim()) {
        modalActions.setAlert({
          type: 'error',
          title: t('sql.editTable.validationFailed'),
          message: t('sql.editTable.columnNameRequired'),
        })
        return
      }
    }

    // Validate new indexes
    const newIndexes = indexes.filter(i => i.isNew && !i.isMarkedForDeletion)
    for (const idx of newIndexes) {
      if (!idx.name.trim()) {
        modalActions.setAlert({
          type: 'error',
          title: t('sql.editTable.validationFailed'),
          message: t('sql.editTable.indexNameRequired'),
        })
        return
      }
      if (idx.columns.length === 0) {
        modalActions.setAlert({
          type: 'error',
          title: t('sql.editTable.validationFailed'),
          message: t('sql.editTable.indexColumnsRequired'),
        })
        return
      }
    }

    // Validate new foreign keys
    const newForeignKeys = foreignKeys.filter(f => f.isNew && !f.isMarkedForDeletion)
    for (const fk of newForeignKeys) {
      if (!fk.name.trim() || !fk.column.trim() || !fk.referencedTable.trim() || !fk.referencedColumn.trim()) {
        modalActions.setAlert({
          type: 'error',
          title: t('sql.editTable.validationFailed'),
          message: t('sql.editTable.foreignKeyFieldsRequired'),
        })
        return
      }
    }

    setIsExecuting(true)

    // --- Phase 1: Drop foreign keys ---
    const fksToDelete = foreignKeys.filter(f => !f.isNew && f.isMarkedForDeletion)
    for (const fk of fksToDelete) {
      const dropName = resolveForeignKeyDropName(fk, originalForeignKeys)
      const sql = dropForeignKeySQL(dialect, tableName, dropName, schema)
      const result = await executeSingleStatement(sql)
      results.push({
        label: t('sql.editTable.result.dropForeignKey', { name: dropName }),
        success: result.success,
        message: result.message,
        sql,
      })
    }

    // --- Phase 2: Drop indexes ---
    const idxsToDelete = indexes.filter(i => !i.isNew && i.isMarkedForDeletion)
    for (const idx of idxsToDelete) {
      const sql = dropIndexSQL(dialect, tableName, idx.name, schema)
      const result = await executeSingleStatement(sql)
      results.push({
        label: t('sql.editTable.result.dropIndex', { name: idx.name }),
        success: result.success,
        message: result.message,
        sql,
      })
    }

    // --- Phase 3: Drop columns ---
    const colsToDelete = columns.filter(c => !c.isNew && c.isMarkedForDeletion)
    for (const col of colsToDelete) {
      const sql = dropColumnSQL(dialect, tableName, col.name, schema)
      const result = await executeSingleStatement(sql)
      results.push({
        label: t('sql.editTable.result.dropColumn', { name: col.name }),
        success: result.success,
        message: result.message,
        sql,
      })
    }

    // --- Phase 4: Add new columns ---
    for (const col of newColumns) {
      const sql = addColumnSQL(dialect, tableName, col.name, col.type, col.isNullable, schema)
      const result = await executeSingleStatement(sql)
      results.push({
        label: t('sql.editTable.result.addColumn', { name: col.name }),
        success: result.success,
        message: result.message,
        sql,
      })
    }

    // --- Phase 5: Modify existing columns ---
    const colsToModify = columns.filter(c => !c.isNew && !c.isMarkedForDeletion && isColumnModified(c))
    for (const col of colsToModify) {
      const sql = modifyColumnSQL(dialect, tableName, col.name, col.type, col.isNullable, schema)
      const result = await executeSingleStatement(sql)
      results.push({
        label: t('sql.editTable.result.modifyColumn', { name: col.name }),
        success: result.success,
        message: result.message,
        sql,
      })
    }

    // --- Phase 6: Modify existing indexes (drop + recreate) ---
    const idxsToModify = indexes.filter(i => !i.isNew && !i.isMarkedForDeletion && isIndexModified(i))
    for (const idx of idxsToModify) {
      const originalIdx = originalIndexes.find(oi => oi.id === idx.id)
      const nameToDrop = originalIdx ? originalIdx.name : idx.name

      const dropSql = dropIndexSQL(dialect, tableName, nameToDrop, schema)
      const dropResult = await executeSingleStatement(dropSql)
      if (!dropResult.success) {
        results.push({
          label: t('sql.editTable.result.modifyIndex', { name: idx.name }),
          success: false,
          message: dropResult.message,
          sql: dropSql,
        })
        continue
      }

      const createSql = createIndexSQL(dialect, tableName, idx.name, idx.columns, idx.isUnique, schema)
      const createResult = await executeSingleStatement(createSql)
      results.push({
        label: t('sql.editTable.result.modifyIndex', { name: idx.name }),
        success: createResult.success,
        message: createResult.message,
        sql: createSql,
      })
    }

    // --- Phase 7: Add new indexes ---
    for (const idx of newIndexes) {
      const sql = createIndexSQL(dialect, tableName, idx.name, idx.columns, idx.isUnique, schema)
      const result = await executeSingleStatement(sql)
      results.push({
        label: t('sql.editTable.result.addIndex', { name: idx.name }),
        success: result.success,
        message: result.message,
        sql,
      })
    }

    // --- Phase 8: Modify existing foreign keys (drop + recreate) ---
    const fksToModify = foreignKeys.filter(f => !f.isNew && !f.isMarkedForDeletion && isForeignKeyModified(f))
    for (const fk of fksToModify) {
      const dropName = resolveForeignKeyDropName(fk, originalForeignKeys)
      const dropSql = dropForeignKeySQL(dialect, tableName, dropName, schema)
      const dropResult = await executeSingleStatement(dropSql)
      if (!dropResult.success) {
        results.push({
          label: t('sql.editTable.result.modifyForeignKey', { name: fk.name }),
          success: false,
          message: dropResult.message,
          sql: dropSql,
        })
        continue
      }

      const addSql = addForeignKeySQL(
        dialect, tableName, fk.name, fk.column,
        fk.referencedTable, fk.referencedColumn,
        fk.onDelete, fk.onUpdate, schema,
      )
      const addResult = await executeSingleStatement(addSql)
      results.push({
        label: t('sql.editTable.result.modifyForeignKey', { name: fk.name }),
        success: addResult.success,
        message: addResult.message,
        sql: addSql,
      })
    }

    // --- Phase 9: Add new foreign keys ---
    for (const fk of newForeignKeys) {
      const sql = addForeignKeySQL(
        dialect, tableName, fk.name, fk.column,
        fk.referencedTable, fk.referencedColumn,
        fk.onDelete, fk.onUpdate, schema,
      )
      const result = await executeSingleStatement(sql)
      results.push({
        label: t('sql.editTable.result.addForeignKey', { name: fk.name }),
        success: result.success,
        message: result.message,
        sql,
      })
    }

    setIsExecuting(false)

    // --- Show results ---
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    const details = results.map(r => {
      if (r.success) return `  ${r.label}`
      return `  ${r.label}\n    ${r.message}`
    }).join('\n')

    if (failCount === 0) {
      modalActions.setAlert({
        type: 'success',
        title: t('sql.editTable.applySuccess', { count: String(successCount) }),
        message: details,
      })
      // Re-fetch schema to get clean state
      await fetchTableSchema()
    } else {
      modalActions.setAlert({
        type: 'error',
        title: t('sql.editTable.applyPartial', { success: String(successCount), failed: String(failCount) }),
        message: details,
      })
      // Re-fetch to sync with actual DB state, preserving failed new items
      const failedNewColumns = newColumns.filter((_, i) => {
        const resultIdx = results.findIndex(r => r.label === t('sql.editTable.result.addColumn', { name: newColumns[i].name }))
        return resultIdx !== -1 && !results[resultIdx].success
      })
      const failedNewIndexes = newIndexes.filter((_, i) => {
        const resultIdx = results.findIndex(r => r.label === t('sql.editTable.result.addIndex', { name: newIndexes[i].name }))
        return resultIdx !== -1 && !results[resultIdx].success
      })
      const failedNewForeignKeys = newForeignKeys.filter((_, i) => {
        const resultIdx = results.findIndex(r => r.label === t('sql.editTable.result.addForeignKey', { name: newForeignKeys[i].name }))
        return resultIdx !== -1 && !results[resultIdx].success
      })

      await fetchTableSchema()

      // Re-add failed new items so user can fix and retry
      if (failedNewColumns.length > 0) {
        setColumns(prev => [...prev, ...failedNewColumns])
      }
      if (failedNewIndexes.length > 0) {
        setIndexes(prev => [...prev, ...failedNewIndexes])
      }
      if (failedNewForeignKeys.length > 0) {
        setForeignKeys(prev => [...prev, ...failedNewForeignKeys])
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const columnNames = useMemo(
    () => columns.filter(c => c.name.trim() && !c.isMarkedForDeletion).map(c => c.name),
    [columns],
  )

  // ---------------------------------------------------------------------------
  // Context assembly
  // ---------------------------------------------------------------------------

  const actions: EditTableActions = {
    setActiveTab,
    addColumn,
    updateColumn,
    toggleColumnDeletion,
    addIndex,
    updateIndex,
    toggleIndexDeletion,
    addForeignKey,
    updateForeignKey,
    toggleForeignKeyDeletion,
    applyAllChanges,
  }

  return (
    <EditTableCtx value={{
      state: { columns, indexes, foreignKeys, activeTab, isLoading, isExecuting, dialect, columnNames, pendingChangeCount },
      actions,
    }}>
      {children}
    </EditTableCtx>
  )
}
