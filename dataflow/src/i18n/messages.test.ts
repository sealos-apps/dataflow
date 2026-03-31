import { describe, expect, it } from 'vitest'
import { createTranslator, translateWithMessages } from '@/i18n/messages'
import { zhMessages } from '@/i18n/locales/zh'
import { enMessages } from '@/i18n/locales/en'

describe('translation helpers', () => {
  it('interpolates params', () => {
    const t = createTranslator('zh')
    expect(t('sidebar.tab.queryWithDatabase', { database: 'postgres' })).toBe('查询 - postgres')
  })

  it('falls back to zh when the current locale map misses a value', () => {
    expect(
      translateWithMessages(
        { 'common.actions.refresh': 'Refresh' },
        zhMessages,
        'layout.empty.noTabsTitle'
      )
    ).toBe(zhMessages['layout.empty.noTabsTitle'])
  })

  it('returns the key when no locale has the message', () => {
    expect(translateWithMessages({}, {}, 'missing.key')).toBe('missing.key')
  })

  it('exposes matching zh/en dictionaries', () => {
    expect(enMessages['common.actions.confirm']).toBe('Confirm')
    expect(zhMessages['common.actions.confirm']).toBe('确认')
  })
})
