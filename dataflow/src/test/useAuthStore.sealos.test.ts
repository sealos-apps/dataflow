import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
const mutateMock = vi.fn()
const sealosInitializeMock = vi.fn()

let sealosState: {
  session: { kubeconfig: string } | null
  initialize: typeof sealosInitializeMock
} = {
  session: { kubeconfig: 'test-kubeconfig' },
  initialize: sealosInitializeMock,
}

vi.mock('@/config/graphql-client', () => ({
  graphqlClient: {
    query: queryMock,
    mutate: mutateMock,
  },
}))

vi.mock('@/stores/useSealosStore', () => ({
  useSealosStore: {
    getState: () => sealosState,
  },
}))

const launchPath =
  '/?dbType=postgresql&resourceName=my-db&databaseName=postgres&host=my-db.ns-demo.svc&port=5432&namespace=ns-demo'

function storedSealosState(options: { instanceUid?: string; expiresAt?: string; namespace?: string } = {}) {
  const namespace = options.namespace ?? 'ns-demo'
  return {
    session: {
      sessionToken: 'stored-token',
      type: 'Postgres',
      hostname: 'my-db.ns-demo.svc',
      port: '5432',
      database: 'postgres',
      displayName: 'my-db',
      expiresAt: options.expiresAt ?? '2099-07-20T00:00:00Z',
      ...(options.instanceUid === undefined ? {} : { instanceUid: options.instanceUid }),
    },
    bootstrap: {
      dbType: 'postgresql',
      resourceName: 'my-db',
      databaseName: 'postgres',
      host: 'my-db.ns-demo.svc',
      port: '5432',
      namespace,
      fingerprint: `postgresql:my-db:my-db.ns-demo.svc:5432:postgres:${namespace}`,
    },
  }
}

function currentIdentity(uid = 'current-uid', namespace = 'ns-demo') {
  return {
    data: {
      ResolveSealosInstanceIdentity: {
        uid,
        namespace,
        resourceName: 'my-db',
      },
    },
  }
}

function replacementBootstrap(uid = 'current-uid') {
  return {
    data: {
      BootstrapSealosSession: {
        sessionToken: 'replacement-token',
        instanceUid: uid,
        type: 'Postgres',
        hostname: 'my-db.ns-demo.svc',
        port: '5432',
        database: 'postgres',
        displayName: 'my-db',
        expiresAt: '2099-07-21T00:00:00Z',
      },
    },
  }
}

describe('useAuthStore Sealos instance identity flow', () => {
  beforeEach(() => {
    vi.resetModules()
    queryMock.mockReset()
    mutateMock.mockReset()
    sealosInitializeMock.mockReset()
    sealosInitializeMock.mockResolvedValue(undefined)
    sealosState = {
      session: { kubeconfig: 'test-kubeconfig' },
      initialize: sealosInitializeMock,
    }
    sessionStorage.clear()
    window.history.pushState({}, '', launchPath)
    queryMock.mockResolvedValue(currentIdentity())
    mutateMock.mockResolvedValue(replacementBootstrap())
  })

  it('reuses an unexpired session only when the launch target and instance UID match', async () => {
    sessionStorage.setItem('dataflow_auth', JSON.stringify(storedSealosState({ instanceUid: 'current-uid' })))

    const { useAuthStore } = await import('@/stores/useAuthStore')
    await useAuthStore.getState().initialize()

    expect(queryMock).toHaveBeenCalledOnce()
    expect(mutateMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      session: { sessionToken: 'stored-token', instanceUid: 'current-uid' },
    })
  })

  it('bootstraps when the matching instance session is expired', async () => {
    sessionStorage.setItem(
      'dataflow_auth',
      JSON.stringify(storedSealosState({ instanceUid: 'current-uid', expiresAt: '2000-01-01T00:00:00Z' })),
    )

    const { useAuthStore } = await import('@/stores/useAuthStore')
    await useAuthStore.getState().initialize()

    expect(queryMock).toHaveBeenCalledOnce()
    expect(mutateMock).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().session).toMatchObject({
      sessionToken: 'replacement-token',
      instanceUid: 'current-uid',
    })
  })

  it('bootstraps and persists the replacement UID when the instance identity changed', async () => {
    sessionStorage.setItem('dataflow_auth', JSON.stringify(storedSealosState({ instanceUid: 'old-uid' })))

    const { useAuthStore } = await import('@/stores/useAuthStore')
    await useAuthStore.getState().initialize()

    expect(mutateMock).toHaveBeenCalledOnce()
    const persistedState = sessionStorage.getItem('dataflow_auth') ?? ''
    expect(JSON.parse(persistedState)).toMatchObject({
      session: { sessionToken: 'replacement-token', instanceUid: 'current-uid' },
    })
    expect(persistedState).not.toContain('test-kubeconfig')
  })

  it('persists the UID resolved again by bootstrap when the instance changes after the probe', async () => {
    sessionStorage.setItem('dataflow_auth', JSON.stringify(storedSealosState({ instanceUid: 'old-uid' })))
    queryMock.mockResolvedValue(currentIdentity('probe-uid'))
    mutateMock.mockResolvedValue(replacementBootstrap('bootstrap-uid'))

    const { useAuthStore } = await import('@/stores/useAuthStore')
    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().session).toMatchObject({
      sessionToken: 'replacement-token',
      instanceUid: 'bootstrap-uid',
    })
    expect(JSON.parse(sessionStorage.getItem('dataflow_auth') ?? '{}')).toMatchObject({
      session: { instanceUid: 'bootstrap-uid' },
    })
  })

  it('bootstraps a legacy persisted session without an instance UID once', async () => {
    sessionStorage.setItem('dataflow_auth', JSON.stringify(storedSealosState()))

    const { useAuthStore } = await import('@/stores/useAuthStore')
    await useAuthStore.getState().initialize()

    expect(queryMock).toHaveBeenCalledOnce()
    expect(mutateMock).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().session?.instanceUid).toBe('current-uid')
  })

  it('does not reuse a same-name instance session from a different namespace', async () => {
    sessionStorage.setItem(
      'dataflow_auth',
      JSON.stringify(storedSealosState({ instanceUid: 'current-uid', namespace: 'ns-other' })),
    )

    const { useAuthStore } = await import('@/stores/useAuthStore')
    await useAuthStore.getState().initialize()

    expect(queryMock).toHaveBeenCalledOnce()
    expect(mutateMock).toHaveBeenCalledOnce()
  })

  it('fails closed and clears the restored session when identity resolution fails', async () => {
    sessionStorage.setItem('dataflow_auth', JSON.stringify(storedSealosState({ instanceUid: 'old-uid' })))

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const { getAuthSession } = await import('@/config/auth-store')
    queryMock.mockImplementation(() => {
      expect(getAuthSession()).toBeNull()
      return Promise.reject(new Error('cluster identity unavailable'))
    })
    await useAuthStore.getState().initialize()

    expect(mutateMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState()).toMatchObject({
      status: 'error',
      session: null,
      error: 'common.auth.instanceIdentityFailed',
    })
    expect(getAuthSession()).toBeNull()
    expect(sessionStorage.getItem('dataflow_auth')).toBeNull()
  })
})
