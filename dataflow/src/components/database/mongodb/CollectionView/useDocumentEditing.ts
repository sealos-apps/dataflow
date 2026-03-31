import { useCallback, useState } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
  useAddRowMutation,
  useDeleteRowMutation,
  useUpdateStorageUnitMutation,
} from '@graphql'
import { resolveSchemaParam } from '@/utils/database-features'
import { useI18n } from '@/i18n/useI18n'
import type { Alert } from '@/components/database/shared/types'

interface UseDocumentEditingParams {
  connectionId: string
  databaseName: string
  collectionName: string
  documents: any[]
  refresh: () => void
  showAlert: (title: string, message: string, type: Alert['type']) => void
}

/** State for document editing, adding, and deleting. */
export interface DocumentEditingState {
  editingDoc: any | null
  editContent: string
  selectedDocIndex: number | null
  deletingDocId: string | null
  showDeleteModal: boolean
  showAddModal: boolean
  addContent: string
}

/** Actions for document editing, adding, and deleting. */
export interface DocumentEditingActions {
  handleAddClick: () => void
  setAddContent: (content: string) => void
  handleAddSave: () => Promise<void>
  setShowAddModal: (open: boolean) => void
  handleEditClick: (doc: any) => void
  setEditContent: (content: string) => void
  handleSave: () => Promise<void>
  setEditingDoc: (doc: any | null) => void
  handleDeleteClick: (docId: string) => void
  handleConfirmDelete: () => Promise<void>
  setShowDeleteModal: (open: boolean) => void
  setSelectedDocIndex: (index: number | null) => void
}

/** Hook that encapsulates all document editing, adding, and deleting logic. */
export function useDocumentEditing({
  connectionId,
  databaseName,
  collectionName,
  documents,
  refresh,
  showAlert,
}: UseDocumentEditingParams): { state: DocumentEditingState; actions: DocumentEditingActions } {
  const { t } = useI18n()
  const { connections } = useConnectionStore()

  // ---- GraphQL mutations ----
  const [addRowMutation] = useAddRowMutation()
  const [deleteRowMutation] = useDeleteRowMutation()
  const [updateStorageUnitMutation] = useUpdateStorageUnitMutation()

  // ---- Document editing state ----
  const [editingDoc, setEditingDoc] = useState<any>(null)
  const [editContent, setEditContent] = useState('')
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ---- Add document state ----
  const [showAddModal, setShowAddModal] = useState(false)
  const [addContent, setAddContent] = useState('{\n  \n}')

  // ---- Add handlers ----
  const handleAddClick = useCallback(() => {
    if (documents.length > 0 && typeof documents[0] === 'object' && documents[0] !== null) {
      const template: Record<string, string> = {}
      Object.keys(documents[0]).filter(k => k !== '_id').forEach(k => { template[k] = '' })
      setAddContent(JSON.stringify(template, null, 2))
    } else {
      setAddContent('{\n  \n}')
    }
    setShowAddModal(true)
  }, [documents])

  const handleAddSave = useCallback(async () => {
    try {
      const newDoc = JSON.parse(addContent)

      const conn = connections.find(c => c.id === connectionId)
      if (!conn) return

      const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
      const values = Object.entries(newDoc).map(([key, value]) => ({
        Key: key,
        Value: typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value ?? ''),
      }))

      if (values.length === 0) {
        showAlert(t('common.alert.error'), t('mongodb.error.emptyDocument'), 'error')
        return
      }

      const { data: result, errors } = await addRowMutation({
        variables: {
          schema: graphqlSchema,
          storageUnit: collectionName,
          values,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert(
          t('common.alert.error'),
          t('mongodb.alert.addFailedWithError', { error: errors[0].message }),
          'error',
        )
        return
      }

      if (result?.AddRow.Status) {
        showAlert(t('common.alert.success'), t('mongodb.alert.addSuccess'), 'success')
        setShowAddModal(false)
        refresh()
      } else {
        showAlert(t('common.alert.error'), t('mongodb.alert.addFailed'), 'error')
      }
    } catch (e: any) {
      showAlert(t('common.alert.error'), t('mongodb.alert.invalidJsonAdd', { error: e.message }), 'error')
    }
  }, [addContent, connections, connectionId, databaseName, collectionName, addRowMutation, showAlert, refresh, t])

  // ---- Edit handlers ----
  const handleEditClick = useCallback((doc: any) => {
    setEditingDoc(doc)
    setEditContent(JSON.stringify(doc, null, 2))
  }, [])

  const handleSave = useCallback(async () => {
    if (!editingDoc) return

    try {
      const updatedDoc = JSON.parse(editContent)
      const docId = editingDoc._id

      const conn = connections.find(c => c.id === connectionId)
      if (!conn) return

      const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
      const values = [{ Key: 'document', Value: JSON.stringify({ ...updatedDoc, _id: docId }) }]
      const updatedColumns = Object.keys(updatedDoc).filter(k => k !== '_id')

      const { data: result, errors } = await updateStorageUnitMutation({
        variables: {
          schema: graphqlSchema,
          storageUnit: collectionName,
          values,
          updatedColumns,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert(
          t('common.alert.error'),
          t('mongodb.alert.updateFailedWithError', { error: errors[0].message }),
          'error',
        )
        return
      }

      if (result?.UpdateStorageUnit.Status) {
        showAlert(t('common.alert.success'), t('mongodb.alert.updateSuccess'), 'success')
        setEditingDoc(null)
        refresh()
      } else {
        showAlert(t('common.alert.error'), t('mongodb.alert.updateFailed'), 'error')
      }
    } catch (e: any) {
      showAlert(t('common.alert.error'), t('mongodb.alert.invalidJsonUpdate', { error: e.message }), 'error')
    }
  }, [editingDoc, editContent, connections, connectionId, databaseName, collectionName, updateStorageUnitMutation, showAlert, refresh, t])

  // ---- Delete handlers ----
  const handleDeleteClick = useCallback((docId: string) => {
    setDeletingDocId(docId)
    setShowDeleteModal(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingDocId) return

    const conn = connections.find(c => c.id === connectionId)
    if (!conn) return

    const graphqlSchema = resolveSchemaParam(conn.type, databaseName)
    const values = [{ Key: 'document', Value: JSON.stringify({ _id: deletingDocId }) }]

    try {
      const { data: result, errors } = await deleteRowMutation({
        variables: {
          schema: graphqlSchema,
          storageUnit: collectionName,
          values,
        },
        context: { database: databaseName },
      })

      if (errors?.length) {
        showAlert(
          t('common.alert.error'),
          t('mongodb.alert.deleteFailedWithError', { error: errors[0].message }),
          'error',
        )
        return
      }

      if (result?.DeleteRow.Status) {
        showAlert(t('common.alert.success'), t('mongodb.alert.deleteSuccess'), 'success')
        refresh()
      } else {
        showAlert(t('common.alert.error'), t('mongodb.alert.deleteFailed'), 'error')
      }
    } catch (e: any) {
      showAlert(t('common.alert.error'), t('mongodb.alert.deleteError', { error: e.message }), 'error')
    } finally {
      setDeletingDocId(null)
      setShowDeleteModal(false)
    }
  }, [deletingDocId, connections, connectionId, databaseName, collectionName, deleteRowMutation, showAlert, refresh, t])

  const state: DocumentEditingState = {
    editingDoc,
    editContent,
    selectedDocIndex,
    deletingDocId,
    showDeleteModal,
    showAddModal,
    addContent,
  }

  const actions: DocumentEditingActions = {
    handleAddClick,
    setAddContent,
    handleAddSave,
    setShowAddModal,
    handleEditClick,
    setEditContent,
    handleSave,
    setEditingDoc,
    handleDeleteClick,
    handleConfirmDelete,
    setShowDeleteModal,
    setSelectedDocIndex,
  }

  return { state, actions }
}
