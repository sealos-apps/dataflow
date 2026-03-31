import { describe, expect, it } from 'vitest'
import { removeBootstrapParams } from '@/i18n/url-params'

describe('bootstrap URL cleanup', () => {
  it('removes only auth bootstrap parameters', () => {
    expect(
      removeBootstrapParams('?dbType=postgresql&credential=secret&host=localhost&port=5432&dbName=postgres&lang=zh&theme=dark')
    ).toBe('?lang=zh&theme=dark')
  })

  it('preserves unrelated query parameters', () => {
    expect(removeBootstrapParams('?lang=en&theme=dark&foo=bar')).toBe('?lang=en&theme=dark&foo=bar')
  })

  it('returns an empty string when nothing remains', () => {
    expect(removeBootstrapParams('?dbType=postgresql&credential=secret')).toBe('')
  })
})
