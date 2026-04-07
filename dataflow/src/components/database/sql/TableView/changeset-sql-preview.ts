import type { ChangesetRowKey, ChangesetCellValue, RowChange } from './types'

export interface ChangesetSummary {
  updates: number
  inserts: number
  deletes: number
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function quoteLiteral(value: ChangesetCellValue) {
  if (value == null) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function buildWhereClause(row: Record<string, ChangesetCellValue>) {
  return Object.entries(row)
    .map(([column, value]) => `${quoteIdentifier(column)} = ${quoteLiteral(value)}`)
    .join(' AND ')
}

export function summarizeChanges(changes: Map<ChangesetRowKey, RowChange>): ChangesetSummary {
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

export function buildPreviewSql(tableName: string, changes: Map<ChangesetRowKey, RowChange>) {
  return [...changes.values()].map((change) => {
    if (change.type === 'insert') {
      const entries = Object.entries(change.values).filter(([, value]) => value !== null && value !== '')
      const columns = entries.map(([column]) => quoteIdentifier(column)).join(', ')
      const values = entries.map(([, value]) => quoteLiteral(value)).join(', ')
      return `INSERT INTO ${quoteIdentifier(tableName)} (${columns}) VALUES (${values});`
    }

    if (change.type === 'delete') {
      return `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${buildWhereClause(change.originalRow)};`
    }

    const setClause = Object.entries(change.cells)
      .map(([column, delta]) => `${quoteIdentifier(column)} = ${quoteLiteral(delta.new)}`)
      .join(', ')

    return `UPDATE ${quoteIdentifier(tableName)} SET ${setClause} WHERE ${buildWhereClause(change.originalRow)};`
  })
}
