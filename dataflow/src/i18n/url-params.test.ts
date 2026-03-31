import { describe, expect, it } from 'vitest'
import { removeBootstrapParams, replaceBootstrapUrl } from '@/i18n/url-params'

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

describe('replaceBootstrapUrl', () => {
  const basePath = '/bootstrap'
  const baseHash = '#panel'
  const preservedState = { preserved: true }

  beforeEach(() => {
    window.history.replaceState(preservedState, '', `${basePath}${baseHash}`)
  })

  it('removes bootstrap params but keeps other params plus pathname/hash', () => {
    replaceBootstrapUrl('?dbType=postgresql&credential=secret&lang=en&theme=dark&foo=bar')

    expect(window.location.pathname).toBe(basePath)
    expect(window.location.search).toBe('?lang=en&theme=dark&foo=bar')
    expect(window.location.hash).toBe(baseHash)
    expect(window.history.state).toBe(preservedState)
  })

  it('leaves pathname+hash intact when no params remain', () => {
    replaceBootstrapUrl('?dbType=postgresql&credential=secret')

    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe(baseHash)
    expect(`${window.location.pathname}${window.location.hash}`).toBe(`${basePath}${baseHash}`)
    expect(window.history.state).toBe(preservedState)
  })
})
