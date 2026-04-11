import { useCallback, useMemo, useReducer } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { useI18n } from '@/i18n/useI18n'
import type { StagedSessionState } from '@/components/database/shared/staged-session/types'
import {
  createStagedSessionState,
  stagedSessionReducer,
} from '@/components/database/shared/staged-session/reducer'
import {
  useAddRowMutation,
  useDeleteRowMutation,
  useUpdateStorageUnitMutation,
} from '@graphql'
import { resolveSchemaParam } from '@/utils/database-features'
import type { TableData } from '@/utils/graphql-transforms'
import type { Alert } from '@/components/database/shared/types'
import type {
  ChangesetAction,
  ChangesetCellValue,
  ChangesetRowKey,
  RenderedTableRow,
  RowChange,
  SqlChangesetEditorState,
  UndoEntry,
} from './types'

interface UseChangesetManagerParams {
  connectionId: string
  databaseName: string
  schema?: string
  tableName: string
  primaryKey: string | null
  data: TableData | null
  pageOffset: number
  visibleColumns: string[]
  refresh: () => void
  showAlert: (title: string, message: string, type: Alert['type']) => void
}

export interface ChangesetManagerState {
  session: StagedSessionState<RowChange, UndoEntry>
  editor: SqlChangesetEditorState
}

export function buildExistingRowKey(pageOffset: number, sourceRowIndex: number) {
  return `existing-${pageOffset + sourceRowIndex}`
}

export function normalizeCellValue(value: unknown): ChangesetCellValue {
  return value == null ? null : String(value)
}

export function createInitialChangesetState(): ChangesetManagerState {
  return {
    session: createStagedSessionState<RowChange, UndoEntry>(),
    editor: {
      activeCell: null,
      activeDraftValue: '',
      newRowCounter: 0,
    },
  }
}

function upsertCellChange(
  current: RowChange | undefined,
  originalRow: Record<string, ChangesetCellValue>,
  column: string,
  nextValue: ChangesetCellValue,
): RowChange | undefined {
  const base = current ?? {
    type: 'update' as const,
    originalRow,
    cells: {},
    values: { ...originalRow },
  }

  const oldValue = originalRow[column] ?? null
  const nextCells = { ...base.cells }
  const nextValues = { ...base.values, [column]: nextValue }

  if (nextValue === oldValue) {
    delete nextCells[column]
  } else {
    nextCells[column] = { old: oldValue, new: nextValue }
  }

  if (Object.keys(nextCells).length === 0) {
    return undefined
  }

  return {
    type: 'update',
    originalRow,
    cells: nextCells,
    values: nextValues,
  }
}

function revertCellUndo(
  current: RowChange | undefined,
  entry: Extract<UndoEntry, { kind: 'cell' }>,
): RowChange | undefined {
  if (current?.type === 'insert') {
    return {
      ...current,
      values: { ...current.values, [entry.column]: entry.oldValue },
    }
  }

  if (!current || current.type !== 'update') {
    return undefined
  }

  return upsertCellChange(current, current.originalRow, entry.column, entry.oldValue)
}

export function changesetReducer(
  state: ChangesetManagerState,
  action: ChangesetAction,
): ChangesetManagerState {
  switch (action.type) {
    case 'activate-cell':
      return {
        ...state,
        editor: {
          ...state.editor,
          activeCell: { rowKey: action.rowKey, column: action.column },
          activeDraftValue: action.initialValue ?? '',
        },
      }

    case 'deactivate-cell':
      return {
        ...state,
        editor: {
          ...state.editor,
          activeCell: null,
          activeDraftValue: '',
        },
      }

    case 'update-active-draft':
      return {
        ...state,
        editor: {
          ...state.editor,
          activeDraftValue: action.value,
        },
      }

    case 'commit-active-cell': {
      if (action.value === action.previousValue) {
        return state
      }

      const nextChanges = new Map(state.session.changes)
      const current = nextChanges.get(action.rowKey)

      if (current?.type === 'insert') {
        nextChanges.set(action.rowKey, {
          ...current,
          values: { ...current.values, [action.column]: action.value },
        })
      } else {
        const nextChange = upsertCellChange(current, action.originalRow, action.column, action.value)
        if (nextChange) nextChanges.set(action.rowKey, nextChange)
        else nextChanges.delete(action.rowKey)
      }

      return {
        ...state,
        session: {
          ...state.session,
          changes: nextChanges,
          undoStack: [
            ...state.session.undoStack,
            {
              kind: 'cell',
              rowKey: action.rowKey,
              column: action.column,
              oldValue: action.previousValue,
              newValue: action.value,
            },
          ],
        },
      }
    }

    case 'add-row': {
      const nextChanges = new Map(state.session.changes)
      nextChanges.set(action.rowKey, {
        type: 'insert',
        originalRow: {},
        cells: {},
        values: { ...action.initialValues },
      })

      return {
        ...state,
        session: {
          ...state.session,
          changes: nextChanges,
          newRowOrder: [...state.session.newRowOrder, action.rowKey],
          undoStack: [...state.session.undoStack, { kind: 'add-row', rowKey: action.rowKey }],
        },
        editor: {
          ...state.editor,
          newRowCounter: state.editor.newRowCounter + 1,
        },
      }
    }

    case 'delete-selected': {
      if (action.rows.length === 0) return state

      const nextChanges = new Map(state.session.changes)
      const rowKeys = action.rows.map((row) => row.rowKey)
      const previousChanges = action.rows.map((row) => [row.rowKey, nextChanges.get(row.rowKey)] as const)
      const nextNewRowOrder = [...state.session.newRowOrder]

      for (const row of action.rows) {
        if (row.isInserted) {
          nextChanges.delete(row.rowKey)
          const index = nextNewRowOrder.indexOf(row.rowKey)
          if (index >= 0) nextNewRowOrder.splice(index, 1)
          continue
        }

        nextChanges.set(row.rowKey, {
          type: 'delete',
          originalRow: row.originalRow,
          cells: {},
          values: { ...row.originalRow },
        })
      }

      return {
        ...state,
        session: {
          ...state.session,
          changes: nextChanges,
          newRowOrder: nextNewRowOrder,
          selectedRowKeys: new Set(),
          undoStack: [
            ...state.session.undoStack.filter((entry) => {
              if (entry.kind !== 'cell') return true
              return !rowKeys.includes(entry.rowKey)
            }),
            {
              kind: 'delete-rows',
              rowKeys,
              previousChanges: previousChanges.map((entry) => [entry[0], entry[1]]),
            },
          ],
        },
      }
    }

    case 'undo': {
      const lastEntry = state.session.undoStack.at(-1)
      if (!lastEntry) return state

      const nextUndoStack = state.session.undoStack.slice(0, -1)
      const nextChanges = new Map(state.session.changes)

      if (lastEntry.kind === 'cell') {
        const reverted = revertCellUndo(nextChanges.get(lastEntry.rowKey), lastEntry)
        if (reverted) nextChanges.set(lastEntry.rowKey, reverted)
        else nextChanges.delete(lastEntry.rowKey)

        return {
          ...state,
          session: {
            ...state.session,
            changes: nextChanges,
            undoStack: nextUndoStack,
          },
        }
      }

      if (lastEntry.kind === 'add-row') {
        nextChanges.delete(lastEntry.rowKey)

        return {
          ...state,
          session: {
            ...state.session,
            changes: nextChanges,
            undoStack: nextUndoStack,
            newRowOrder: state.session.newRowOrder.filter((rowKey) => rowKey !== lastEntry.rowKey),
            selectedRowKeys: new Set(
              [...state.session.selectedRowKeys].filter((rowKey) => rowKey !== lastEntry.rowKey),
            ),
          },
        }
      }

      for (const [rowKey, previousChange] of lastEntry.previousChanges) {
        if (previousChange) nextChanges.set(rowKey, previousChange)
        else nextChanges.delete(rowKey)
      }

      const nextNewRowOrder = [...state.session.newRowOrder]
      for (const [rowKey, previousChange] of lastEntry.previousChanges) {
        if (previousChange?.type === 'insert' && !nextNewRowOrder.includes(rowKey)) {
          nextNewRowOrder.push(rowKey)
        }
      }

      return {
        ...state,
        session: {
          ...state.session,
          changes: nextChanges,
          newRowOrder: nextNewRowOrder,
          undoStack: nextUndoStack,
        },
      }
    }

    case 'discard-all':
      return createInitialChangesetState()

    case 'toggle-selection':
    case 'prune-successes':
    case 'set-show-preview-modal':
    case 'set-show-submit-modal':
    case 'set-show-discard-modal':
      return {
        ...state,
        session: stagedSessionReducer(state.session, action),
      }

    default:
      return state
  }
}

function buildInsertedRowKey(newRowCounter: number) {
  return `new-${newRowCounter + 1}`
}

function buildEmptyRowValues(columns: string[]) {
  return Object.fromEntries(columns.map((column) => [column, null] satisfies [string, ChangesetCellValue]))
}

function isEditableCell(
  row: RenderedTableRow | null,
  column: string,
  primaryKey: string | null,
  canEdit: boolean,
) {
  if (!row || !canEdit) return false
  if (row.isDeleted) return false
  if (!row.isInserted && primaryKey && column === primaryKey) return false
  return true
}

function toRecordInputs(values: Record<string, ChangesetCellValue>) {
  return Object.entries(values).map(([key, value]) => ({
    Key: key,
    Value: String(value ?? ''),
  }))
}

export function useChangesetManager({
  connectionId,
  databaseName,
  schema,
  tableName,
  primaryKey,
  data,
  pageOffset,
  visibleColumns,
  refresh,
  showAlert,
}: UseChangesetManagerParams) {
  const { t } = useI18n()
  const { connections } = useConnectionStore()
  const [addRowMutation] = useAddRowMutation()
  const [deleteRowMutation] = useDeleteRowMutation()
  const [updateStorageUnitMutation] = useUpdateStorageUnitMutation()
  const [state, dispatch] = useReducer(changesetReducer, undefined, createInitialChangesetState)

  const renderedRows = useMemo<RenderedTableRow[]>(() => {
    const existingRows = (data?.rows ?? []).map((row, sourceRowIndex) => {
      const rowKey = buildExistingRowKey(pageOffset, sourceRowIndex)
      const originalRow = Object.fromEntries(
        Object.entries(row).map(([column, value]) => [column, normalizeCellValue(value)]),
      ) as Record<string, ChangesetCellValue>
      const change = state.session.changes.get(rowKey)

      return {
        rowKey,
        sourceRowIndex,
        rowNumber: pageOffset + sourceRowIndex + 1,
        originalRow,
        values: change?.values ?? originalRow,
        changeType: change?.type ?? null,
        isDeleted: change?.type === 'delete',
        isInserted: false,
      }
    })

    const insertedRows: RenderedTableRow[] = []
    for (const rowKey of state.session.newRowOrder) {
      const change = state.session.changes.get(rowKey)
      if (!change) continue

      insertedRows.push({
        rowKey,
        sourceRowIndex: null,
        rowNumber: null,
        originalRow: change.originalRow,
        values: change.values,
        changeType: 'insert',
        isDeleted: false,
        isInserted: true,
      })
    }

    return [...insertedRows, ...existingRows]
  }, [data?.rows, pageOffset, state.session.changes, state.session.newRowOrder])

  const getRowByKey = useCallback((rowKey: ChangesetRowKey) => {
    return renderedRows.find((row) => row.rowKey === rowKey) ?? null
  }, [renderedRows])

  const commitCellValue = useCallback((rowKey: ChangesetRowKey, column: string, value: string) => {
    const row = getRowByKey(rowKey)
    if (!row) return

    dispatch({
      type: 'commit-active-cell',
      rowKey,
      column,
      originalRow: row.originalRow,
      previousValue: row.values[column] ?? null,
      value: normalizeCellValue(value),
    })
  }, [getRowByKey])

  const activateCell = useCallback((rowKey: ChangesetRowKey, column: string) => {
    if (
      state.editor.activeCell &&
      (state.editor.activeCell.rowKey !== rowKey || state.editor.activeCell.column !== column)
    ) {
      commitCellValue(
        state.editor.activeCell.rowKey,
        state.editor.activeCell.column,
        state.editor.activeDraftValue,
      )
    }

    const row = getRowByKey(rowKey)
    dispatch({
      type: 'activate-cell',
      rowKey,
      column,
      initialValue: row?.values[column] ?? '',
    })
  }, [commitCellValue, getRowByKey, state.editor.activeCell, state.editor.activeDraftValue])

  const deactivateCell = useCallback(() => {
    if (state.editor.activeCell) {
      commitCellValue(
        state.editor.activeCell.rowKey,
        state.editor.activeCell.column,
        state.editor.activeDraftValue,
      )
    }
    dispatch({ type: 'deactivate-cell' })
  }, [commitCellValue, state.editor.activeCell, state.editor.activeDraftValue])

  const updateActiveCellValue = useCallback((value: string) => {
    dispatch({ type: 'update-active-draft', value })
  }, [])

  const toggleRowSelection = useCallback((rowKey: ChangesetRowKey) => {
    dispatch({ type: 'toggle-selection', rowKey })
  }, [])

  const addPendingRow = useCallback(() => {
    const rowKey = buildInsertedRowKey(state.editor.newRowCounter)
    const columns = data?.columns ?? visibleColumns

    dispatch({
      type: 'add-row',
      rowKey,
      initialValues: buildEmptyRowValues(columns),
    })

    const firstColumn = visibleColumns[0]
    if (firstColumn) {
      dispatch({
        type: 'activate-cell',
        rowKey,
        column: firstColumn,
        initialValue: '',
      })
    }
  }, [data?.columns, state.editor.newRowCounter, visibleColumns])

  const markSelectedRowsForDelete = useCallback(() => {
    const rows = renderedRows
      .filter((row) => state.session.selectedRowKeys.has(row.rowKey))
      .map((row) => ({
        rowKey: row.rowKey,
        originalRow: row.originalRow,
        isInserted: row.isInserted,
      }))

    dispatch({ type: 'delete-selected', rows })
  }, [renderedRows, state.session.selectedRowKeys])

  const undoLastChange = useCallback(() => {
    dispatch({ type: 'undo' })
  }, [])

  const discardChanges = useCallback(() => {
    dispatch({ type: 'discard-all' })
  }, [])

  const moveActiveCell = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (!state.editor.activeCell) return

    const currentRowIndex = renderedRows.findIndex(
      (row) => row.rowKey === state.editor.activeCell?.rowKey,
    )
    const currentColumnIndex = visibleColumns.indexOf(state.editor.activeCell.column)

    if (currentRowIndex < 0 || currentColumnIndex < 0) {
      deactivateCell()
      return
    }

    let nextRowIndex = currentRowIndex
    let nextColumnIndex = currentColumnIndex

    while (true) {
      if (direction === 'left') nextColumnIndex -= 1
      if (direction === 'right') nextColumnIndex += 1
      if (direction === 'up') nextRowIndex -= 1
      if (direction === 'down') nextRowIndex += 1

      if (nextColumnIndex < 0 || nextColumnIndex >= visibleColumns.length) {
        deactivateCell()
        return
      }

      if (nextRowIndex < 0 || nextRowIndex >= renderedRows.length) {
        deactivateCell()
        return
      }

      const nextRow = renderedRows[nextRowIndex]
      const nextColumn = visibleColumns[nextColumnIndex]
      if (isEditableCell(nextRow, nextColumn, primaryKey, true)) {
        commitCellValue(
          state.editor.activeCell.rowKey,
          state.editor.activeCell.column,
          state.editor.activeDraftValue,
        )
        dispatch({
          type: 'activate-cell',
          rowKey: nextRow.rowKey,
          column: nextColumn,
          initialValue: nextRow.values[nextColumn] ?? '',
        })
        return
      }

      if (direction === 'up' || direction === 'down') {
        nextColumnIndex = currentColumnIndex
      } else {
        nextRowIndex = currentRowIndex
      }
    }
  }, [
    commitCellValue,
    deactivateCell,
    primaryKey,
    renderedRows,
    state.editor.activeCell,
    state.editor.activeDraftValue,
    visibleColumns,
  ])

  const setShowPreviewModal = useCallback((open: boolean) => {
    dispatch({ type: 'set-show-preview-modal', open })
  }, [])

  const setShowSubmitModal = useCallback((open: boolean) => {
    dispatch({ type: 'set-show-submit-modal', open })
  }, [])

  const setShowDiscardModal = useCallback((open: boolean) => {
    dispatch({ type: 'set-show-discard-modal', open })
  }, [])

  const submitChanges = useCallback(async () => {
    const conn = connections.find((connection) => connection.id === connectionId)
    if (!conn || state.session.changes.size === 0) return

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName, schema)
    const successfulRowKeys: ChangesetRowKey[] = []
    const failedMessages: string[] = []
    const orderedEntries = [...state.session.changes.entries()].sort(([, left], [, right]) => {
      const rank = { delete: 0, update: 1, insert: 2 } as const
      return rank[left.type] - rank[right.type]
    })

    for (const [rowKey, change] of orderedEntries) {
      try {
        if (change.type === 'delete') {
          const { data: result, errors } = await deleteRowMutation({
            variables: {
              schema: graphqlSchema,
              storageUnit: tableName,
              values: toRecordInputs(change.originalRow),
            },
            context: { database: databaseName },
          })

          if (errors?.length || !result?.DeleteRow.Status) {
            throw new Error(errors?.[0]?.message ?? t('sql.inline.failedToDeleteRowGeneric'))
          }
        } else if (change.type === 'update') {
          const { data: result, errors } = await updateStorageUnitMutation({
            variables: {
              schema: graphqlSchema,
              storageUnit: tableName,
              values: toRecordInputs(change.values),
              updatedColumns: Object.keys(change.cells),
            },
            context: { database: databaseName },
          })

          if (errors?.length || !result?.UpdateStorageUnit.Status) {
            throw new Error(errors?.[0]?.message ?? t('sql.inline.failedToUpdateRowGeneric'))
          }
        } else {
          const insertValues = toRecordInputs(change.values).filter((entry) => entry.Value !== '')
          const { data: result, errors } = await addRowMutation({
            variables: {
              schema: graphqlSchema,
              storageUnit: tableName,
              values: insertValues,
            },
            context: { database: databaseName },
          })

          if (errors?.length || !result?.AddRow.Status) {
            throw new Error(errors?.[0]?.message ?? t('sql.inline.failedToAddRowGeneric'))
          }
        }

        successfulRowKeys.push(rowKey)
      } catch (error) {
        failedMessages.push(error instanceof Error ? error.message : String(error))
      }
    }

    if (failedMessages.length === 0) {
      dispatch({ type: 'discard-all' })
      refresh()
      showAlert(t('common.alert.success'), t('sql.changes.submitSuccess'), 'success')
      return
    }

    dispatch({ type: 'prune-successes', rowKeys: successfulRowKeys })
    refresh()
    const summary = t('sql.changes.submitPartialFailure', { count: failedMessages.length })
    const details = failedMessages.join('\n')
    showAlert(t('common.alert.error'), `${summary}\n\n${details}`, 'error')
  }, [
    addRowMutation,
    connectionId,
    connections,
    databaseName,
    deleteRowMutation,
    refresh,
    schema,
    showAlert,
    state.session.changes,
    t,
    tableName,
    updateStorageUnitMutation,
  ])

  return {
    state: {
      activeCell: state.editor.activeCell,
      activeDraftValue: state.editor.activeDraftValue,
      selectedRowKeys: state.session.selectedRowKeys,
      changes: state.session.changes,
      undoStack: state.session.undoStack,
      renderedRows,
      pendingChangeCount: state.session.changes.size,
      hasPendingChanges: state.session.changes.size > 0,
      showPreviewModal: state.session.showPreviewModal,
      showSubmitModal: state.session.showSubmitModal,
      showDiscardModal: state.session.showDiscardModal,
    },
    actions: {
      activateCell,
      deactivateCell,
      updateActiveCellValue,
      moveActiveCell,
      toggleRowSelection,
      addPendingRow,
      markSelectedRowsForDelete,
      undoLastChange,
      discardChanges,
      setShowPreviewModal,
      setShowSubmitModal,
      setShowDiscardModal,
      submitChanges,
      commitCellValue,
    },
  }
}
