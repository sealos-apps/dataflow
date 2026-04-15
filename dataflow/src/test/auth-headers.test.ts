import { afterEach, describe, expect, it } from 'vitest'

import {
  clearAuth,
  setAuthSession,
} from '@/config/auth-store'
import {
  addAuthHeader,
  getAuthorizationHeader,
} from '@/config/auth-headers'

describe('auth headers', () => {
  afterEach(() => {
    clearAuth()
    sessionStorage.clear()
  })

  it('builds bearer session tokens from the opaque auth session', () => {
    setAuthSession({
      sessionToken: 'opaque-token',
      type: 'Postgres',
      hostname: 'db.ns.svc',
      port: '5432',
      database: 'postgres',
      displayName: 'my-db',
      expiresAt: '2026-04-16T00:00:00Z',
    })

    expect(getAuthorizationHeader()).toBe('Bearer session:opaque-token')
  })

  it('sends database overrides as a separate header', () => {
    setAuthSession({
      sessionToken: 'opaque-token',
      type: 'Postgres',
      hostname: 'db.ns.svc',
      port: '5432',
      database: 'postgres',
      displayName: 'my-db',
      expiresAt: '2026-04-16T00:00:00Z',
    })

    expect(addAuthHeader({}, 'analytics')).toEqual({
      Authorization: 'Bearer session:opaque-token',
      'X-WhoDB-Database': 'analytics',
    })
  })
})
