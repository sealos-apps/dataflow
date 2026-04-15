import { describe, expect, it } from 'vitest'

import { removeBootstrapParams } from '@/i18n/url-params'

describe('removeBootstrapParams', () => {
  it('removes sealos bootstrap keys and keeps presentation params', () => {
    const next = removeBootstrapParams(
      '?dbType=postgresql&resourceName=my-db&host=db.ns.svc&port=5432&databaseName=postgres&lang=zh&theme=light',
    )

    expect(next).toBe('?lang=zh&theme=light')
  })

  it('removes legacy dbName aliases during rollout', () => {
    const next = removeBootstrapParams('?dbType=postgresql&resourceName=my-db&dbName=postgres&lang=en')

    expect(next).toBe('?lang=en')
  })
})
