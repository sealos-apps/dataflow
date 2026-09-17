import { create } from 'zustand'
import { EVENT_NAME, type SessionV1 } from '@labring/sealos-desktop-sdk'
import { createSealosApp, sealosApp } from '@labring/sealos-desktop-sdk/app'

type SealosSession = Pick<SessionV1, 'user' | 'kubeconfig'>

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

function hasKubeconfig(session: SealosSession | null): session is SealosSession {
  return typeof session?.kubeconfig === 'string' && session.kubeconfig.trim().length > 0
}

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
          const resolvedSession = await sealosApp.getSession()
          session = hasKubeconfig(resolvedSession) ? resolvedSession : null
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
