import type { RedisKey } from './types'

export function applyRedisFilters(redisKeys: RedisKey[], pattern: string, filterTypes: string[]): RedisKey[] {
  let filteredKeys = redisKeys

  if (pattern !== '*') {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    const regex = new RegExp(`^${regexStr}$`, 'i')
    filteredKeys = filteredKeys.filter((redisKey) => regex.test(redisKey.key))
  }

  if (filterTypes.length > 0) {
    filteredKeys = filteredKeys.filter((redisKey) => filterTypes.includes(redisKey.type))
  }

  return filteredKeys
}

export function paginateRedisKeys(redisKeys: RedisKey[], currentPage: number, pageSize: number): RedisKey[] {
  const page = Math.max(1, currentPage)
  const start = (page - 1) * pageSize
  return redisKeys.slice(start, start + pageSize)
}
