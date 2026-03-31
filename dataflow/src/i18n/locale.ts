export type Locale = 'zh' | 'en'

const SUPPORTED_LOCALES = new Set<Locale>(['zh', 'en'])

export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return 'zh'
  return SUPPORTED_LOCALES.has(value as Locale) ? (value as Locale) : 'zh'
}

export function resolveLocaleFromSearch(search: string): Locale {
  const params = new URLSearchParams(search)
  return normalizeLocale(params.get('lang'))
}
