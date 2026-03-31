import type { Locale } from './locale'
import { zhMessages } from './locales/zh'
import { enMessages } from './locales/en'

export type MessageKey = keyof typeof zhMessages
export type Messages = {
  readonly [K in MessageKey]: string
}
export type MessageLookup = Partial<Messages>
export type TranslationParams = Record<string, string | number>

export const messagesByLocale: Record<Locale, Messages> = {
  zh: zhMessages,
  en: enMessages,
}

export function translateWithMessages(
  currentMessages: MessageLookup,
  fallbackMessages: MessageLookup,
  key: string,
  params?: TranslationParams,
): string {
  const typedKey = key as MessageKey
  const template = currentMessages[typedKey] ?? fallbackMessages[typedKey] ?? key
  if (!params) return template

  return template.replace(/\{(\w+)\}/g, (_, token) => {
    const value = params[token]
    return value === undefined ? `{${token}}` : String(value)
  })
}

export function createTranslator(locale: Locale) {
  return (key: MessageKey, params?: TranslationParams) =>
    translateWithMessages(messagesByLocale[locale], zhMessages, key, params)
}
