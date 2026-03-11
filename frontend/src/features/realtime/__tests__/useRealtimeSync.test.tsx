import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRealtimeSync } from '@/features/realtime/hooks/useRealtimeSync'

const {
  sendWebSocketMessageMock,
  fetchCollectionsMock,
  fetchCollectionTreeMock,
  fetchCollectionVariablesMock,
  fetchEnvironmentsMock,
  consumeCollectionVariablesSelfEchoMock,
  collectionsStoreState,
  useCollectionsStoreMock,
  capturedWebSocketOptions,
} = vi.hoisted(() => {
  const sendWebSocketMessageMock = vi.fn()
  const fetchCollectionsMock = vi.fn()
  const fetchCollectionTreeMock = vi.fn()
  const fetchCollectionVariablesMock = vi.fn()
  const fetchEnvironmentsMock = vi.fn()
  const consumeCollectionVariablesSelfEchoMock = vi.fn()

  const collectionsStoreState = {
    activeCollection: { id: '1', name: 'snehal', path: '/tmp/snehal', requestCount: 1 },
    fetchCollections: fetchCollectionsMock,
    fetchCollectionTree: fetchCollectionTreeMock,
    fetchCollectionVariables: fetchCollectionVariablesMock,
    fetchEnvironments: fetchEnvironmentsMock,
    consumeCollectionVariablesSelfEcho: consumeCollectionVariablesSelfEchoMock,
  }

  const useCollectionsStoreMock = Object.assign(
    vi.fn((selector?: (state: typeof collectionsStoreState) => unknown) =>
      selector ? selector(collectionsStoreState) : collectionsStoreState
    ),
    {
      getState: vi.fn(() => collectionsStoreState),
    }
  )

  const capturedWebSocketOptions: { current?: { onMessage?: (message: unknown) => void } } = {}

  return {
    sendWebSocketMessageMock,
    fetchCollectionsMock,
    fetchCollectionTreeMock,
    fetchCollectionVariablesMock,
    fetchEnvironmentsMock,
    consumeCollectionVariablesSelfEchoMock,
    collectionsStoreState,
    useCollectionsStoreMock,
    capturedWebSocketOptions,
  }
})

vi.mock('@/store/collections', () => ({
  useCollectionsStore: useCollectionsStoreMock,
}))

vi.mock('@/hooks/use-websocket', () => ({
  useWebSocket: vi.fn((_url, options) => {
    capturedWebSocketOptions.current = options
    return {
      send: sendWebSocketMessageMock,
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
  }),
}))

vi.mock('@/lib/runtime-config', () => ({
  getRuntimeConfig: () => ({
    wsUrl: 'ws://localhost:8080/ws',
  }),
}))

describe('useRealtimeSync', () => {
  beforeEach(() => {
    sendWebSocketMessageMock.mockReset()
    fetchCollectionsMock.mockReset()
    fetchCollectionTreeMock.mockReset()
    fetchCollectionVariablesMock.mockReset()
    fetchEnvironmentsMock.mockReset()
    consumeCollectionVariablesSelfEchoMock.mockReset()
    capturedWebSocketOptions.current = undefined
  })

  it('subscribes to the active collection over websocket', () => {
    renderHook(() => useRealtimeSync())

    expect(sendWebSocketMessageMock).toHaveBeenCalledWith({
      type: 'subscribe',
      collection: 'snehal',
    })
  })

  it('routes ordinary request file writes to the collection tree refresh path', () => {
    renderHook(() => useRealtimeSync())

    capturedWebSocketOptions.current?.onMessage?.({
      type: 'file_change',
      collection: 'snehal',
      data: { relativePath: 'requests/get-users.bru' },
    })

    expect(fetchCollectionsMock).not.toHaveBeenCalled()
    expect(fetchCollectionTreeMock).toHaveBeenCalledWith('snehal')
  })
})
