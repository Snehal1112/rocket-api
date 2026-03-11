import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionVar, Environment, HttpRequest, HttpResponse } from '@/types'

const saveEnvironmentMock = vi.fn()
const saveCollectionVariablesMock = vi.fn()

type CollectionsStoreState = {
  activeCollection: { id: string; name: string; path: string; requestCount: number } | null
  activeEnvironment: Environment | null
  collectionVariables: CollectionVar[]
  saveEnvironment: typeof saveEnvironmentMock
  saveCollectionVariables: typeof saveCollectionVariablesMock
}

let collectionsStoreState: CollectionsStoreState

const useCollectionsStoreMock = {
  getState: vi.fn(() => collectionsStoreState),
}

const fetchHistoryMock = vi.fn()
const useHistoryStoreMock = {
  getState: vi.fn(() => ({
    fetchHistory: fetchHistoryMock,
  })),
}

const sendRequestMock = vi.fn<(...args: unknown[]) => Promise<HttpResponse>>()
const mockSendRequestMock = vi.fn<(...args: unknown[]) => Promise<HttpResponse>>()

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

describe('useRequestExecution', () => {
  const request: HttpRequest = {
    id: 'req-1',
    name: 'Users',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [],
    body: { type: 'none', content: '' },
    queryParams: [],
    pathParams: [],
    auth: { type: 'none' },
    scripts: { language: 'javascript', preRequest: '', postResponse: '' },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    collectionsStoreState = {
      activeCollection: {
        id: '1',
        name: 'snehal',
        path: '/tmp/snehal',
        requestCount: 1,
      },
      activeEnvironment: {
        id: 'env-1',
        name: 'dev',
        variables: [
          { key: 'userLength', value: '1000', enabled: true, secret: false },
        ],
      },
      collectionVariables: [
        { key: 'user1', value: 'user2', enabled: true, secret: false },
      ],
      saveEnvironment: saveEnvironmentMock,
      saveCollectionVariables: saveCollectionVariablesMock,
    }

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

  it('persists only environment diffs when the script returns the full variable bag', async () => {
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
          userLength: '1001',
        },
      },
    })

    const { useRequestExecution } = await import('@/features/request-builder/hooks/useRequestExecution')
    const { result } = renderHook(() => useRequestExecution())

    await act(async () => {
      await result.current(request, {})
    })

    expect(fetchHistoryMock).toHaveBeenCalled()
    expect(saveEnvironmentMock).toHaveBeenCalledTimes(1)
    expect(saveCollectionVariablesMock).not.toHaveBeenCalled()
  })

  it('falls back to the mock service when the primary request fails', async () => {
    sendRequestMock.mockRejectedValueOnce(new Error('network failed'))
    mockSendRequestMock.mockResolvedValueOnce({
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

    const { useRequestExecution } = await import('@/features/request-builder/hooks/useRequestExecution')
    const { result } = renderHook(() => useRequestExecution())

    let response: HttpResponse | undefined
    await act(async () => {
      response = await result.current(request, {})
    })

    expect(mockSendRequestMock).toHaveBeenCalledWith(request)
    expect(response?.headers['X-Rocket-Mock']).toBe('true')
  })
})
