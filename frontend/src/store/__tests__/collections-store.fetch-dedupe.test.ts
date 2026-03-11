import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCollectionsMock = vi.fn()
const getCollectionMock = vi.fn()
const getEnvironmentsMock = vi.fn()
const getEnvironmentMock = vi.fn()
const getCollectionVariablesMock = vi.fn()
const saveEnvironmentMock = vi.fn()
const saveCollectionVariablesMock = vi.fn()

vi.mock('@/lib/api', () => ({
  apiService: {
    getCollections: getCollectionsMock,
    getCollection: getCollectionMock,
    getEnvironments: getEnvironmentsMock,
    getEnvironment: getEnvironmentMock,
    getCollectionVariables: getCollectionVariablesMock,
    saveEnvironment: saveEnvironmentMock,
    saveCollectionVariables: saveCollectionVariablesMock,
  },
}))

async function loadStore() {
  vi.resetModules()
  const mod = await import('@/store/collections')
  return mod.useCollectionsStore
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('collections-store fetch dedupe', () => {
  beforeEach(() => {
    getCollectionsMock.mockReset()
    getCollectionMock.mockReset()
    getEnvironmentsMock.mockReset()
    getEnvironmentMock.mockReset()
    getCollectionVariablesMock.mockReset()
    saveEnvironmentMock.mockReset()
    saveCollectionVariablesMock.mockReset()
  })

  it('coalesces concurrent fetchCollections calls into a single API request', async () => {
    const pending = deferred<Array<{ id: string; name: string; path: string; requestCount: number }>>()
    getCollectionsMock.mockReturnValue(pending.promise)

    const useCollectionsStore = await loadStore()

    const p1 = useCollectionsStore.getState().fetchCollections()
    const p2 = useCollectionsStore.getState().fetchCollections()

    expect(getCollectionsMock).toHaveBeenCalledTimes(1)

    pending.resolve([
      { id: '1', name: 'A', path: '/tmp/a', requestCount: 1 },
    ])
    await Promise.all([p1, p2])

    expect(useCollectionsStore.getState().collections).toHaveLength(1)
    expect(useCollectionsStore.getState().collections[0]?.name).toBe('A')
  })

  it('coalesces concurrent fetchCollectionTree calls into a single API request', async () => {
    const pending = deferred<{
      name: string
      type: 'collection'
      children: []
    }>()
    getCollectionMock.mockReturnValue(pending.promise)

    const useCollectionsStore = await loadStore()

    const p1 = useCollectionsStore.getState().fetchCollectionTree('snehal')
    const p2 = useCollectionsStore.getState().fetchCollectionTree('snehal')

    expect(getCollectionMock).toHaveBeenCalledTimes(1)

    pending.resolve({
      name: 'snehal',
      type: 'collection',
      children: [],
    })
    await Promise.all([p1, p2])

    expect(useCollectionsStore.getState().collectionTree?.name).toBe('snehal')
  })

  it('coalesces concurrent fetchEnvironments calls into a single API request', async () => {
    const envNames = deferred<string[]>()
    const dev = deferred<{ id: string; name: string; variables: [] }>()
    const qa = deferred<{ id: string; name: string; variables: [] }>()

    getEnvironmentsMock.mockReturnValue(envNames.promise)
    getEnvironmentMock.mockImplementation((_collection: string, name: string) => {
      if (name === 'dev') return dev.promise
      if (name === 'qa') return qa.promise
      throw new Error(`Unexpected environment ${name}`)
    })

    const useCollectionsStore = await loadStore()

    const p1 = useCollectionsStore.getState().fetchEnvironments('snehal')
    const p2 = useCollectionsStore.getState().fetchEnvironments('snehal')

    envNames.resolve(['dev', 'qa'])
    await Promise.resolve()

    expect(getEnvironmentsMock).toHaveBeenCalledTimes(1)
    expect(getEnvironmentMock).toHaveBeenCalledTimes(2)

    dev.resolve({ id: '1', name: 'dev', variables: [] })
    qa.resolve({ id: '2', name: 'qa', variables: [] })
    await Promise.all([p1, p2])

    expect(useCollectionsStore.getState().environments.map(env => env.name)).toEqual(['dev', 'qa'])
  })

  it('coalesces concurrent fetchCollectionVariables calls into a single API request', async () => {
    const pending = deferred<Array<{ key: string; value: string; enabled: boolean; secret?: boolean }>>()
    getCollectionVariablesMock.mockReturnValue(pending.promise)

    const useCollectionsStore = await loadStore()

    const p1 = useCollectionsStore.getState().fetchCollectionVariables('snehal')
    const p2 = useCollectionsStore.getState().fetchCollectionVariables('snehal')

    expect(getCollectionVariablesMock).toHaveBeenCalledTimes(1)

    pending.resolve([
      { key: 'baseUrl', value: 'http://localhost:8080', enabled: true },
    ])
    await Promise.all([p1, p2])

    expect(useCollectionsStore.getState().collectionVariables).toHaveLength(1)
    expect(useCollectionsStore.getState().collectionVariables[0]?.key).toBe('baseUrl')
  })

  it('updates local environment state after save without refetching all environments', async () => {
    saveEnvironmentMock.mockResolvedValue(undefined)

    const useCollectionsStore = await loadStore()
    useCollectionsStore.setState({
      environments: [
        { id: '1', name: 'dev', variables: [{ key: 'token', value: 'old', enabled: true }] },
        { id: '2', name: 'qa', variables: [] },
      ],
      activeEnvironment: {
        id: '1',
        name: 'dev',
        variables: [{ key: 'token', value: 'old', enabled: true }],
      },
    })

    await useCollectionsStore.getState().saveEnvironment('snehal', {
      id: '1',
      name: 'dev',
      variables: [{ key: 'token', value: 'new', enabled: true }],
    })

    expect(saveEnvironmentMock).toHaveBeenCalledTimes(1)
    expect(getEnvironmentsMock).not.toHaveBeenCalled()
    expect(getEnvironmentMock).not.toHaveBeenCalled()
    expect(useCollectionsStore.getState().environments[0]?.variables[0]?.value).toBe('new')
    expect(useCollectionsStore.getState().activeEnvironment?.variables[0]?.value).toBe('new')
  })

  it('does not refetch environments or variables when setting the same active collection', async () => {
    const useCollectionsStore = await loadStore()
    useCollectionsStore.setState({
      activeCollection: { id: '1', name: 'snehal', path: '/tmp/snehal', requestCount: 1 },
      activeEnvironment: { id: 'env-1', name: 'dev', variables: [] },
      collectionVariables: [{ key: 'baseUrl', value: 'http://localhost:8080', enabled: true }],
    })

    useCollectionsStore.getState().setActiveCollection({
      id: '1',
      name: 'snehal',
      path: '/tmp/snehal',
      requestCount: 1,
    })

    expect(getEnvironmentsMock).not.toHaveBeenCalled()
    expect(getCollectionVariablesMock).not.toHaveBeenCalled()
    expect(useCollectionsStore.getState().activeEnvironment?.name).toBe('dev')
    expect(useCollectionsStore.getState().collectionVariables).toHaveLength(1)
  })

  it('registers and consumes one collection-variable self-echo after a successful save', async () => {
    saveCollectionVariablesMock.mockResolvedValue(undefined)

    const useCollectionsStore = await loadStore()

    await useCollectionsStore.getState().saveCollectionVariables('snehal', [
      { key: 'baseUrl', value: 'http://localhost:8080', enabled: true },
    ])

    expect(
      useCollectionsStore.getState().consumeCollectionVariablesSelfEcho(
        'snehal',
        'collection.bru'
      )
    ).toBe(true)
    expect(
      useCollectionsStore.getState().consumeCollectionVariablesSelfEcho(
        'snehal',
        'collection.bru'
      )
    ).toBe(false)
  })
})
