import { createContext, use, useMemo, type ReactNode } from 'react'
import type { Locale } from './locale'
import {
  createTranslator,
  messagesByLocale,
  type MessageKey,
  type Messages,
  type TranslationParams,
} from './messages'

interface I18nContextValue {
  locale: Locale
  t: (key: MessageKey, params?: TranslationParams) => string
  messages: Messages
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      messages: messagesByLocale[locale],
      t: createTranslator(locale),
    }),
    [locale],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18nContext(): I18nContextValue {
  const ctx = use(I18nContext)
  if (!ctx) throw new Error('useI18nContext must be used within I18nProvider')
  return ctx
}
