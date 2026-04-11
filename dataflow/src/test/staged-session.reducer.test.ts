import { describe, expect, it } from 'vitest'

import {
  createStagedSessionState,
  stagedSessionReducer,
} from '@/components/database/shared/staged-session/reducer'
import type { StagedSessionState } from '@/components/database/shared/staged-session/types'
import {
  changesetReducer,
  createInitialChangesetState,
  type ChangesetManagerState,
} from '@/components/database/sql/TableView/useChangesetManager'
import {
  changesetReducer as mongoChangesetReducer,
  createInitialChangesetState as createInitialMongoChangesetState,
  type DocumentChangesetManagerState,
} from '@/components/database/mongodb/CollectionView/useDocumentChangesetManager'

type MockChange = { type: 'insert' | 'delete'; payload: { id: number } }

type MockUndoEntry =
  | { kind: 'cell'; rowKey: string }
  | { kind: 'add-row'; rowKey: string }
  | {
      kind: 'delete-rows'
      rowKeys: string[]
      previousChanges: Array<[string, MockChange | undefined]>
    }

describe('stagedSessionReducer', () => {
  it('prunes successful row keys from changes, selection, new row order, and undo stack', () => {
    const initial = createStagedSessionState<MockChange, MockUndoEntry>()
    const stateWithRows: StagedSessionState<MockChange, MockUndoEntry> = {
      ...initial,
      changes: new Map([
        ['new-1', { type: 'insert', payload: { id: 1 } }],
        ['existing-3', { type: 'delete', payload: { id: 3 } }],
      ]),
      selectedRowKeys: new Set(['new-1', 'existing-3']),
      newRowOrder: ['new-1'],
      undoStack: [
        { kind: 'add-row', rowKey: 'new-1' },
        {
          kind: 'delete-rows',
          rowKeys: ['existing-3'],
          previousChanges: [['existing-3', undefined] as [string, MockChange | undefined]],
        },
      ],
    }

    const next = stagedSessionReducer(stateWithRows, {
      type: 'prune-successes',
      rowKeys: ['new-1'],
    })

    expect(next.changes.has('new-1')).toBe(false)
    expect(next.selectedRowKeys.has('new-1')).toBe(false)
    expect(next.newRowOrder).toEqual([])
    expect(next.undoStack).toEqual([
      {
        kind: 'delete-rows',
        rowKeys: ['existing-3'],
        previousChanges: [['existing-3', undefined]],
      },
    ])
  })

  it('trims multi-row undo entries and removes them when emptied', () => {
    const deleteChangeA: MockChange = { type: 'delete', payload: { id: 100 } }
    const deleteChangeB: MockChange = { type: 'delete', payload: { id: 200 } }
    const initial = createStagedSessionState<MockChange, MockUndoEntry>()
    const stateWithBulk: StagedSessionState<MockChange, MockUndoEntry> = {
      ...initial,
      undoStack: [
        {
          kind: 'delete-rows',
          rowKeys: ['bulk-1', 'bulk-2'],
          previousChanges: [
            ['bulk-1', deleteChangeA] as [string, MockChange | undefined],
            ['bulk-2', deleteChangeB] as [string, MockChange | undefined],
          ],
        },
      ],
    }

    const partial = stagedSessionReducer(stateWithBulk, {
      type: 'prune-successes',
      rowKeys: ['bulk-1'],
    })

    expect(partial.undoStack).toEqual([
      {
        kind: 'delete-rows',
        rowKeys: ['bulk-2'],
        previousChanges: [['bulk-2', deleteChangeB]],
      },
    ])

    const emptied = stagedSessionReducer(partial, {
      type: 'prune-successes',
      rowKeys: ['bulk-2'],
    })

    expect(emptied.undoStack).toEqual([])
  })
})

describe('SQL changesetReducer session/editor split', () => {
  it('routes shared session actions to state.session without mutating state.editor', () => {
    const base = createInitialChangesetState()
    const state = {
      ...base,
      editor: {
        ...base.editor,
        activeCell: { rowKey: 'existing-1', column: 'name' },
        activeDraftValue: 'draft',
        newRowCounter: 7,
      },
    }

    const next = changesetReducer(state, { type: 'set-show-preview-modal', open: true })

    // Shared session slice updated.
    expect(next.session.showPreviewModal).toBe(true)
    // Editor slice remains untouched (same reference + same values).
    expect(next.editor).toBe(state.editor)
    expect(next.editor).toEqual(state.editor)
  })

  it('discard-all resets both session and editor slices', () => {
    const base = createInitialChangesetState()
    const dirty: ChangesetManagerState = {
      ...base,
      session: {
        ...base.session,
        showSubmitModal: true,
        selectedRowKeys: new Set(['existing-3']),
        newRowOrder: ['new-1'],
        changes: new Map([
          ['existing-3', { type: 'delete' as const, originalRow: {}, cells: {}, values: {} }],
        ]),
        undoStack: [{ kind: 'add-row' as const, rowKey: 'new-1' }],
      },
      editor: {
        ...base.editor,
        activeCell: { rowKey: 'existing-3', column: 'id' },
        activeDraftValue: '123',
        newRowCounter: 99,
      },
    }

    const next = changesetReducer(dirty, { type: 'discard-all' })

    expect(next.session.changes.size).toBe(0)
    expect(next.session.selectedRowKeys.size).toBe(0)
    expect(next.session.newRowOrder).toEqual([])
    expect(next.session.undoStack).toEqual([])
    expect(next.session.showPreviewModal).toBe(false)
    expect(next.session.showSubmitModal).toBe(false)
    expect(next.session.showDiscardModal).toBe(false)

    expect(next.editor.activeCell).toBe(null)
    expect(next.editor.activeDraftValue).toBe('')
    expect(next.editor.newRowCounter).toBe(0)
  })
})

describe('Mongo changesetReducer session/editor split', () => {
  it('routes shared session actions to state.session without mutating state.editor', () => {
    const base = createInitialMongoChangesetState()
    const state = {
      ...base,
      editor: {
        ...base.editor,
        editingRowKey: 'existing-1',
        editContent: '{ "name": "draft" }',
        newRowCounter: 7,
      },
    }

    const next = mongoChangesetReducer(state, { type: 'set-show-preview-modal', open: true })

    // Shared session slice updated.
    expect(next.session.showPreviewModal).toBe(true)
    // Editor slice remains untouched (same reference + same values).
    expect(next.editor).toBe(state.editor)
    expect(next.editor).toEqual(state.editor)
  })

  it('undo of a staged insert clears that rowKey from selectedRowKeys', () => {
    const base = createInitialMongoChangesetState()
    const rowKey = 'new-1'

    const added = mongoChangesetReducer(base, {
      type: 'stage-add',
      rowKey,
      document: { a: 1 },
    })

    expect(added.session.changes.has(rowKey)).toBe(true)
    expect(added.session.newRowOrder).toEqual([rowKey])
    expect(added.session.selectedRowKeys.has(rowKey)).toBe(false)

    const selected = mongoChangesetReducer(added, { type: 'toggle-selection', rowKey })
    expect(selected.session.selectedRowKeys.has(rowKey)).toBe(true)

    const undone = mongoChangesetReducer(selected, { type: 'undo' })
    expect(undone.session.changes.has(rowKey)).toBe(false)
    expect(undone.session.newRowOrder).toEqual([])
    expect(undone.session.undoStack).toEqual([])
    expect(undone.session.selectedRowKeys.has(rowKey)).toBe(false)
    expect(undone.session.selectedRowKeys.size).toBe(0)
  })

  it('discard-all resets both session and editor slices', () => {
    const base = createInitialMongoChangesetState()
    const dirty: DocumentChangesetManagerState = {
      ...base,
      session: {
        ...base.session,
        showSubmitModal: true,
        selectedRowKeys: new Set(['existing-3']),
        newRowOrder: ['new-1'],
        changes: new Map([
          [
            'existing-3',
            { type: 'delete' as const, originalDocument: { _id: 1 }, document: { _id: 1 } },
          ],
        ]),
        undoStack: [{ kind: 'add' as const, rowKey: 'new-1' }],
      },
      editor: {
        ...base.editor,
        showAddModal: true,
        addContent: '{ "a": 1 }',
        editingRowKey: 'existing-3',
        editContent: '{ "b": 2 }',
        newRowCounter: 99,
      },
    }

    const next = mongoChangesetReducer(dirty, { type: 'discard-all' })

    expect(next.session.changes.size).toBe(0)
    expect(next.session.selectedRowKeys.size).toBe(0)
    expect(next.session.newRowOrder).toEqual([])
    expect(next.session.undoStack).toEqual([])
    expect(next.session.showPreviewModal).toBe(false)
    expect(next.session.showSubmitModal).toBe(false)
    expect(next.session.showDiscardModal).toBe(false)

    expect(next.editor.showAddModal).toBe(false)
    expect(next.editor.addContent).toBe('{\n  \n}')
    expect(next.editor.editingRowKey).toBe(null)
    expect(next.editor.editContent).toBe('')
    expect(next.editor.newRowCounter).toBe(0)
  })
})
