import type { RecordInput } from '@graphql'

import type { RedisKeyDraft } from './redis-key.types'

export function hasRedisDraftPayload(draft: RedisKeyDraft): boolean {
  switch (draft.type) {
    case 'string':
      return true
    case 'hash':
      return draft.hashPairs.some((pair) => pair.field.trim().length > 0)
    case 'list':
      return draft.listItems.some((item) => item.value.trim().length > 0)
    case 'set':
      return draft.setItems.some((item) => item.value.trim().length > 0)
    case 'zset':
      return draft.zsetItems.some((item) => item.member.trim().length > 0)
  }
}

/** Build fields for AddStorageUnit. Redis reads key type from `Extra.type` on the first field. */
export function buildRedisFields(draft: RedisKeyDraft): RecordInput[] {
  const fields: RecordInput[] = []

  switch (draft.type) {
    case 'string':
      fields.push({ Key: 'value', Value: draft.stringValue })
      break
    case 'hash':
      for (const item of draft.hashPairs) {
        if (!item.field.trim()) continue
        fields.push({ Key: item.field, Value: item.value })
      }
      break
    case 'list':
      for (const item of draft.listItems) {
        if (!item.value.trim()) continue
        fields.push({ Key: 'value', Value: item.value })
      }
      break
    case 'set':
      for (const item of draft.setItems) {
        if (!item.value.trim()) continue
        fields.push({ Key: 'value', Value: item.value })
      }
      break
    case 'zset':
      for (const item of draft.zsetItems) {
        if (!item.member.trim()) continue
        fields.push({ Key: item.member, Value: item.score })
      }
      break
  }

  if (fields.length > 0) {
    fields[0] = { ...fields[0], Extra: [{ Key: 'type', Value: draft.type }] }
  }

  return fields
}
