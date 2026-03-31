import { describe, expect, it } from 'vitest'
import { removeBootstrapParams } from '@/i18n/url-params'

describe('bootstrap URL cleanup', () => {
  it('removes auth params and preserves lang/theme', () => {
    const cleaned = removeBootstrapParams(
      '?dbType=postgresql&credential=secret&host=localhost&port=5432&dbName=postgres&lang=zh&theme=dark'
    )

    expect(cleaned).toBe('?lang=zh&theme=dark')
  })
})
