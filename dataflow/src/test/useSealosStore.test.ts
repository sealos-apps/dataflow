import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const getLanguageMock = vi.fn()
const addAppEventListenMock = vi.fn()
const createSealosAppMock = vi.fn(() => undefined)

vi.mock('@labring/sealos-desktop-sdk', () => ({
  EVENT_NAME: {
    CHANGE_I18N: 'change-i18n',
  },
}))

vi.mock('@labring/sealos-desktop-sdk/app', () => ({
  createSealosApp: createSealosAppMock,
  sealosApp: {
    getSession: getSessionMock,
    getLanguage: getLanguageMock,
    addAppEventListen: addAppEventListenMock,
  },
}))

describe('useSealosStore', () => {
  beforeEach(() => {
    vi.resetModules()
    getSessionMock.mockReset()
    getLanguageMock.mockReset()
    addAppEventListenMock.mockReset()
    createSealosAppMock.mockReset()
    createSealosAppMock.mockReturnValue(undefined)
    getLanguageMock.mockResolvedValue({ lng: 'en' })
    addAppEventListenMock.mockReturnValue(undefined)
  })

  it('prefers the Sealos SDK session when it includes kubeconfig', async () => {
    getSessionMock.mockResolvedValue({
      token: 'sdk-token',
      user: {
        id: 'u-1',
        name: 'Ada',
        avatar: '',
      },
      kubeconfig: 'sdk-kubeconfig',
    })
    const { useSealosStore } = await import('@/stores/useSealosStore')

    await useSealosStore.getState().initialize()

    expect(useSealosStore.getState().session?.kubeconfig).toBe('sdk-kubeconfig')
    expect(createSealosAppMock).toHaveBeenCalledOnce()
  })

  it('treats an unavailable SDK session as outside Sealos Desktop', async () => {
    getSessionMock.mockRejectedValue(new Error('not in desktop bridge'))

    const { useSealosStore } = await import('@/stores/useSealosStore')

    await useSealosStore.getState().initialize()

    expect(useSealosStore.getState().session).toBeNull()
    expect(useSealosStore.getState().isInSealosDesktop).toBe(false)
  })

  it('ignores SDK sessions without kubeconfig', async () => {
    getSessionMock.mockResolvedValue(null)

    const { useSealosStore } = await import('@/stores/useSealosStore')

    await useSealosStore.getState().initialize()

    expect(useSealosStore.getState().session).toBeNull()
    expect(useSealosStore.getState().isInSealosDesktop).toBe(false)
  })

  it('updates the language from Desktop events', async () => {
    let changeI18n: ((data: { currentLanguage?: string }) => void) | undefined
    getSessionMock.mockResolvedValue(null)
    addAppEventListenMock.mockImplementation((_, callback) => {
      changeI18n = callback
      return undefined
    })

    const { useSealosStore } = await import('@/stores/useSealosStore')

    await useSealosStore.getState().initialize()
    changeI18n?.({ currentLanguage: 'zh' })

    expect(useSealosStore.getState().language).toBe('zh')
  })
})
