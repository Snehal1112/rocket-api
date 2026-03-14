import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollections } from '@/features/collections/hooks/useCollections'
import { useCollectionTree } from '@/features/collections/hooks/useCollectionTree'
import { useCollectionSettings } from '@/features/collections/hooks/useCollectionSettings'

const {
  fetchCollectionsMock,
  fetchCollectionTreeMock,
  fetchEnvironmentsMock,
  fetchCollectionVariablesMock,
  useCollectionsStoreMock,
  storeState,
} = vi.hoisted(() => {
  const fetchCollectionsMock = vi.fn()
  const fetchCollectionTreeMock = vi.fn()
  const fetchEnvironmentsMock = vi.fn()
  const fetchCollectionVariablesMock = vi.fn()

  const storeState = {
    collections: [{ id: '1', name: 'snehal', path: '/tmp/snehal', requestCount: 3 }],
    collectionTree: null,
    environments: [{ id: 'env-1', name: 'dev', variables: [] }],
    activeCollection: { id: '1', name: 'snehal', path: '/tmp/snehal', requestCount: 3 },
    activeEnvironment: null,
    collectionVariables: [{ key: 'baseUrl', value: 'http://localhost', enabled: true, secret: false }],
    isCollectionsLoading: false,
    isCollectionTreeLoading: false,
    error: null,
    fetchCollections: fetchCollectionsMock,
    fetchCollectionTree: fetchCollectionTreeMock,
    createCollection: vi.fn(),
    deleteCollection: vi.fn(),
    setActiveCollection: vi.fn(),
    importBruno: vi.fn(),
    exportBruno: vi.fn(),
    exportPostman: vi.fn(),
    fetchEnvironments: fetchEnvironmentsMock,
    setActiveEnvironment: vi.fn(),
    createEnvironment: vi.fn(),
    saveEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    fetchCollectionVariables: fetchCollectionVariablesMock,
    saveCollectionVariables: vi.fn(),
  }

  const useCollectionsStoreMock = vi.fn((selector?: (state: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState
  )

  return {
    fetchCollectionsMock,
    fetchCollectionTreeMock,
    fetchEnvironmentsMock,
    fetchCollectionVariablesMock,
    useCollectionsStoreMock,
    storeState,
  }
})

vi.mock('@/store/collections', () => ({
  useCollectionsStore: useCollectionsStoreMock,
}))

describe('collections feature hooks', () => {
  beforeEach(() => {
    fetchCollectionsMock.mockReset()
    fetchCollectionTreeMock.mockReset()
    fetchEnvironmentsMock.mockReset()
    fetchCollectionVariablesMock.mockReset()
  })

  it('exposes collections state and actions through useCollections', () => {
    const { result } = renderHook(() => useCollections())

    expect(result.current.collections).toEqual(storeState.collections)
    expect(result.current.activeCollection).toEqual(storeState.activeCollection)

    result.current.fetchCollections()
    expect(fetchCollectionsMock).toHaveBeenCalled()
  })

  it('fetches collection tree when a collection name is provided', async () => {
    renderHook(() => useCollectionTree('snehal'))

    await waitFor(() => {
      expect(fetchCollectionTreeMock).toHaveBeenCalledWith('snehal')
    })
  })

  it('fetches environments and collection variables for a collection', async () => {
    const { result } = renderHook(() => useCollectionSettings('snehal'))

    await waitFor(() => {
      expect(fetchEnvironmentsMock).toHaveBeenCalledWith('snehal')
      expect(fetchCollectionVariablesMock).toHaveBeenCalledWith('snehal')
    })

    expect(result.current.environments).toEqual(storeState.environments)
    expect(result.current.collectionVariables).toEqual(storeState.collectionVariables)
  })
})
