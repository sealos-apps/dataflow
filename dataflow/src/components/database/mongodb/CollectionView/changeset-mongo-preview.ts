import { buildMongoCollectionAccessor } from '@/utils/mongodb-shell'
import type { DocumentChange, DocumentChangesetRowKey } from './types'

export interface ChangesetSummary {
  updates: number
  inserts: number
  deletes: number
}

export function summarizeChanges(changes: Map<DocumentChangesetRowKey, DocumentChange>): ChangesetSummary {
  let updates = 0
  let inserts = 0
  let deletes = 0

  for (const change of changes.values()) {
    if (change.type === 'update') updates += 1
    if (change.type === 'insert') inserts += 1
    if (change.type === 'delete') deletes += 1
  }

  return { updates, inserts, deletes }
}

export function buildPreviewCommands(
  collectionName: string,
  changes: Map<DocumentChangesetRowKey, DocumentChange>,
): string[] {
  const accessor = buildMongoCollectionAccessor(collectionName)

  return [...changes.values()].map((change) => {
    if (change.type === 'insert') {
      return `${accessor}.insertOne(${JSON.stringify(change.document, null, 2)});`
    }

    if (change.type === 'delete') {
      return `${accessor}.deleteOne({ _id: ${JSON.stringify(change.originalDocument._id)} });`
    }

    // update
    const updateFields = { ...change.document }
    delete updateFields._id
    return `${accessor}.updateOne(\n  { _id: ${JSON.stringify(change.originalDocument._id)} },\n  { $set: ${JSON.stringify(updateFields, null, 2)} }\n);`
  })
}
