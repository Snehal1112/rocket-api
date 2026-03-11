import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionVar, Environment, HttpResponse } from '@/types'

const tabsStoreState = {
  tabs: [
    {
      kind: 'request' as const,
      id: 'tab-1',
      request: {
        id: 'req-1',
        name: 'Users',
        method: 'GET' as const,
        url: 'https://api.example.com/users',
        headers: [],
        body: { type: 'none' as const, content: '' },
        queryParams: [],
        pathParams: [],
        auth: { type: 'none' as const },
        scripts: {
          language: 'javascript' as const,
          preRequest: '',
          postResponse: 'pm.environment.set("userLength", "1001")',
        },
      },
      response: null,
      isDirty: false,
      isLoading: false,
      collectionName: 'snehal',
      filePath: 'users.bru',
    },
  ],
  activeTabId: 'tab-1',
  updateActiveName: vi.fn(),
  updateActiveMethod: vi.fn(),
  updateActiveUrl: vi.fn(),
  updateActiveHeaders: vi.fn(),
  updateActiveQueryParams: vi.fn(),
  updateActivePathParams: vi.fn(),
  updateActiveBody: vi.fn(),
  updateActiveAuth: vi.fn(),
  updateActiveScripts: vi.fn(),
  setActiveTabResponse: vi.fn(),
  setActiveTabLoading: vi.fn(),
  saveActiveTab: vi.fn(),
}

const useTabsStoreMock = vi.fn(() => tabsStoreState)

const saveEnvironmentMock = vi.fn()
const saveCollectionVariablesMock = vi.fn()
const setActiveEnvironmentMock = vi.fn()

type CollectionsStoreState = {
  activeCollection: { id: string; name: string; path: string; requestCount: number } | null
  environments: Environment[]
  activeEnvironment: Environment | null
  collectionVariables: CollectionVar[]
  setActiveEnvironment: typeof setActiveEnvironmentMock
  saveEnvironment: typeof saveEnvironmentMock
  saveCollectionVariables: typeof saveCollectionVariablesMock
  fetchCollectionTree: ReturnType<typeof vi.fn>
}

let collectionsStoreState: CollectionsStoreState

const useCollectionsStoreMock = Object.assign(
  vi.fn(() => collectionsStoreState),
  {
    getState: vi.fn(() => collectionsStoreState),
  }
)

const fetchHistoryMock = vi.fn()
const useHistoryStoreMock = {
  getState: vi.fn(() => ({
    fetchHistory: fetchHistoryMock,
  })),
}

const sendRequestMock = vi.fn<(...args: unknown[]) => Promise<HttpResponse>>()
const mockSendRequestMock = vi.fn<(...args: unknown[]) => Promise<HttpResponse>>()

vi.mock('@/store/tabs-store', () => ({
  useTabsStore: useTabsStoreMock,
}))

vi.mock('@/store/collections', () => ({
  useCollectionsStore: useCollectionsStoreMock,
}))

vi.mock('@/store/history', () => ({
  useHistoryStore: useHistoryStoreMock,
}))

vi.mock('@/lib/api', () => ({
  apiService: {
    sendRequest: sendRequestMock,
  },
}))

vi.mock('@/lib/mock-api', () => ({
  mockApiService: {
    sendRequest: mockSendRequestMock,
  },
}))

describe('useRequestBuilderState script write-back', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    tabsStoreState.setActiveTabLoading.mockClear()
    tabsStoreState.setActiveTabResponse.mockClear()

    collectionsStoreState = {
      activeCollection: {
        id: '1',
        name: 'snehal',
        path: '/tmp/snehal',
        requestCount: 1,
      },
      environments: [],
      activeEnvironment: {
        id: 'env-1',
        name: 'dev',
        variables: [
          { key: 'userLength', value: '1000', enabled: true, secret: false },
          { key: 'baseURL', value: 'https://api.example.com', enabled: true, secret: false },
        ],
      },
      collectionVariables: [
        { key: 'user1', value: 'user2', enabled: true, secret: false },
        { key: 'user2', value: 'user22', enabled: true, secret: false },
        { key: 'user5', value: 'user5', enabled: true, secret: false },
        { key: 'userID', value: '1', enabled: true, secret: false },
      ],
      setActiveEnvironment: setActiveEnvironmentMock,
      saveEnvironment: saveEnvironmentMock,
      saveCollectionVariables: saveCollectionVariablesMock,
      fetchCollectionTree: vi.fn(),
    }

    useCollectionsStoreMock.mockImplementation(() => collectionsStoreState)
    useCollectionsStoreMock.getState.mockImplementation(() => collectionsStoreState)

    sendRequestMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '[]',
      size: 2,
      time: 10,
      scriptResult: {
        tests: [],
        consoleLogs: [],
        variables: {},
      },
    })
    mockSendRequestMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '[]',
      size: 2,
      time: 10,
      scriptResult: {
        tests: [],
        consoleLogs: [],
        variables: {},
      },
    })
  })

  it('initializes without reading handleSaveUrlVariable before declaration', async () => {
    const { useRequestBuilderState } = await import('@/components/request-builder/useRequestBuilderState')

    expect(() => renderHook(() => useRequestBuilderState({}))).not.toThrow()
  })

  it('persists only environment diffs when script returns the full variable bag', async () => {
    sendRequestMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '[]',
      size: 2,
      time: 10,
      scriptResult: {
        tests: [],
        consoleLogs: [],
        variables: {
          user1: 'user2',
          user2: 'user22',
          user5: 'user5',
          userID: '1',
          baseURL: 'https://api.example.com',
          userLength: '1001',
        },
      },
    })

    const { useRequestBuilderState } = await import('@/components/request-builder/useRequestBuilderState')
    const { result } = renderHook(() => useRequestBuilderState({}))

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(saveEnvironmentMock).toHaveBeenCalledTimes(1)
    expect(saveCollectionVariablesMock).not.toHaveBeenCalled()
    expect(saveEnvironmentMock).toHaveBeenCalledWith(
      'snehal',
      expect.objectContaining({
        name: 'dev',
        variables: expect.arrayContaining([
          expect.objectContaining({ key: 'userLength', value: '1001' }),
        ]),
      })
    )
  })

  it('persists collection variable diffs only once when a collection value changes', async () => {
    collectionsStoreState.activeEnvironment = null
    sendRequestMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '[]',
      size: 2,
      time: 10,
      scriptResult: {
        tests: [],
        consoleLogs: [],
        variables: {
          user1: 'user2',
          user2: 'user22',
          user5: 'user5',
          userID: '2',
        },
      },
    })

    const { useRequestBuilderState } = await import('@/components/request-builder/useRequestBuilderState')
    const { result } = renderHook(() => useRequestBuilderState({}))

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(saveCollectionVariablesMock).toHaveBeenCalledTimes(1)
    expect(saveCollectionVariablesMock).toHaveBeenCalledWith(
      'snehal',
      expect.arrayContaining([
        expect.objectContaining({ key: 'userID', value: '2' }),
      ])
    )
    expect(saveEnvironmentMock).not.toHaveBeenCalled()
  })

  it('skips collection variable saves when script values match current collection state', async () => {
    collectionsStoreState.activeEnvironment = null
    sendRequestMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '[]',
      size: 2,
      time: 10,
      scriptResult: {
        tests: [],
        consoleLogs: [],
        variables: {
          user1: 'user2',
          user2: 'user22',
          user5: 'user5',
          userID: '1',
        },
      },
    })

    const { useRequestBuilderState } = await import('@/components/request-builder/useRequestBuilderState')
    const { result } = renderHook(() => useRequestBuilderState({}))

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(saveCollectionVariablesMock).not.toHaveBeenCalled()
    expect(saveEnvironmentMock).not.toHaveBeenCalled()
  })
})
