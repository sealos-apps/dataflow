import { describe, expect, it } from 'vitest'
import { normalizeLocale, resolveLocaleFromSearch } from '@/i18n/locale'

describe('locale resolution', () => {
  it('resolves zh and en explicitly', () => {
    expect(normalizeLocale('zh')).toBe('zh')
    expect(normalizeLocale('en')).toBe('en')
  })

  it('falls back to zh when lang is missing or unsupported', () => {
    expect(normalizeLocale(undefined)).toBe('zh')
    expect(normalizeLocale('fr')).toBe('zh')
  })

  it('reads lang from the query string', () => {
    expect(resolveLocaleFromSearch('?lang=en')).toBe('en')
    expect(resolveLocaleFromSearch('?theme=dark')).toBe('zh')
  })
})
