import type { RedisKey } from './RedisView/types'

export interface RedisExportRecord {
  key: string
  type: string
  size: string
  field: string
  index: string
  member: string
  score: string
  value: string
}

export interface RedisExportDetail {
  redisKey: RedisKey
  columns: Array<{ Name: string }>
  rows: string[][]
}

export const REDIS_EXPORT_COLUMNS: Array<{ Name: keyof RedisExportRecord }> = [
  { Name: 'key' },
  { Name: 'type' },
  { Name: 'size' },
  { Name: 'field' },
  { Name: 'index' },
  { Name: 'member' },
  { Name: 'score' },
  { Name: 'value' },
]

function createBaseRecord(redisKey: RedisKey): RedisExportRecord {
  return {
    key: redisKey.key,
    type: redisKey.type,
    size: redisKey.size,
    field: '',
    index: '',
    member: '',
    score: '',
    value: '',
  }
}

export function buildRedisExportRecords(details: RedisExportDetail[]): RedisExportRecord[] {
  return details.flatMap(({ redisKey, columns, rows }) => {
    if (rows.length === 0) {
      return [createBaseRecord(redisKey)]
    }

    return rows.map((row) => {
      const record = createBaseRecord(redisKey)

      columns.forEach((column, index) => {
        const name = column.Name as keyof RedisExportRecord
        if (name in record) {
          record[name] = row[index] ?? ''
        }
      })

      return record
    })
  })
}

export function recordsToRedisExportRows(records: RedisExportRecord[]): string[][] {
  return records.map((record) => REDIS_EXPORT_COLUMNS.map((column) => record[column.Name]))
}

export function recordsToRedisExportNdjson(records: RedisExportRecord[]): string {
  return records.map((record) => JSON.stringify(record)).join('\n')
}
