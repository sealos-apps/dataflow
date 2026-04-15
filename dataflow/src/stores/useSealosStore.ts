import { create } from 'zustand'
import { EVENT_NAME } from 'sealos-desktop-sdk'
import { createSealosApp, sealosApp } from 'sealos-desktop-sdk/app'

export interface SealosSession {
  token?: {
    access_token: string
    token_type: string
    refresh_token: string
    expiry: string
  }
  user: {
    id: string
    name: string
    avatar: string
  }
  kubeconfig: string
}

interface SealosState {
  loading: boolean
  initialized: boolean
  session: SealosSession | null
  language: string | null
  isInSealosDesktop: boolean
  initialize: () => Promise<void>
}

let initializePromise: Promise<void> | null = null
let sdkCleanup: (() => void) | undefined
let languageCleanup: (() => void) | undefined

export const useSealosStore = create<SealosState>((set) => ({
  loading: true,
  initialized: false,
  session: null,
  language: null,
  isInSealosDesktop: false,

  initialize: async () => {
    if (initializePromise) return initializePromise

    initializePromise = (async () => {
      try {
        if (!sdkCleanup) {
          const cleanup = createSealosApp()
          if (typeof cleanup === 'function') {
            sdkCleanup = cleanup
          }
        }

        let session: SealosSession | null = null
        let language: string | null = null

        try {
          session = await sealosApp.getSession()
        } catch {
          session = null
        }

        try {
          const result = await sealosApp.getLanguage()
          language = result.lng
        } catch {
          language = null
        }

        if (!languageCleanup) {
          languageCleanup = sealosApp?.addAppEventListen(EVENT_NAME.CHANGE_I18N, (data: { currentLanguage?: string }) => {
            set({ language: data?.currentLanguage ?? null })
          })
        }

        set({
          session,
          language,
          isInSealosDesktop: session !== null,
          loading: false,
          initialized: true,
        })
      } catch {
        set({
          loading: false,
          initialized: true,
          session: null,
          language: null,
          isInSealosDesktop: false,
        })
      }
    })()

    return initializePromise
  },
}))
