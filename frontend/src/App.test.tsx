import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchCollectionsMock = vi.fn()
const fetchCollectionTreeMock = vi.fn()
const fetchCollectionVariablesMock = vi.fn()
const fetchEnvironmentsMock = vi.fn()
const setActiveCollectionMock = vi.fn()
const consumeCollectionVariablesSelfEchoMock = vi.fn()
const sendWebSocketMessageMock = vi.fn()
let isWebSocketConnectedMock = true

const collectionsStoreState = {
  fetchCollections: fetchCollectionsMock,
  activeCollection: { id: '1', name: 'snehal', path: '/tmp/snehal', requestCount: 1 },
  collections: [{ id: '1', name: 'snehal', path: '/tmp/snehal', requestCount: 1 }],
  setActiveCollection: setActiveCollectionMock,
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

const tabsStoreState = {
  tabs: [],
  activeTabId: '',
}

const useTabsStoreMock = vi.fn((selector?: (state: typeof tabsStoreState) => unknown) =>
  selector ? selector(tabsStoreState) : tabsStoreState
)

const capturedWebSocketOptions: {
  current?: {
    onMessage?: (message: unknown) => void
    onConnect?: () => void
  }
} = {}

vi.mock('@/store/collections', () => ({
  useCollectionsStore: useCollectionsStoreMock,
}))

vi.mock('@/store/tabs-store', () => ({
  useTabsStore: useTabsStoreMock,
  isRequestTab: vi.fn(() => false),
}))

vi.mock('@/hooks/use-websocket', () => ({
  useWebSocket: vi.fn((_url, options) => {
    capturedWebSocketOptions.current = options
    return {
      send: sendWebSocketMessageMock,
      isConnected: isWebSocketConnectedMock,
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
  }),
}))

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: 'light' }),
}))

vi.mock('@/components/request-builder/RequestBuilder', () => ({
  RequestBuilder: () => <div>RequestBuilder</div>,
}))

vi.mock('@/components/request-builder/RequestTabs', () => ({
  RequestTabs: () => <div>RequestTabs</div>,
}))

vi.mock('@/components/collections/CollectionsSidebar', () => ({
  CollectionsSidebar: ({ width }: { width?: number }) => (
    <div data-testid="collections-sidebar" style={width ? { width: `${width}px` } : undefined}>
      CollectionsSidebar
    </div>
  ),
}))

vi.mock('@/components/collections/CollectionOverview', () => ({
  CollectionOverview: () => <div>CollectionOverview</div>,
}))

vi.mock('@/components/layout/GlobalStatusBar', () => ({
  GlobalStatusBar: () => <div>GlobalStatusBar</div>,
}))

vi.mock('@/components/layout/ConsolePanel', () => ({
  ConsolePanel: () => <div>ConsolePanel</div>,
}))

vi.mock('@/components/layout/WelcomeScreen', () => ({
  WelcomeScreen: () => <div>WelcomeScreen</div>,
}))

vi.mock('@/store/console', () => ({
  useConsoleStore: {
    getState: () => ({
      addEntry: vi.fn(),
    }),
  },
}))

vi.mock('@/lib/runtime-config', () => ({
  getRuntimeConfig: () => ({
    wsUrl: 'ws://localhost:8080/ws',
  }),
}))

describe('App websocket file-change handling', () => {
  beforeEach(() => {
    window.localStorage.clear()
    fetchCollectionsMock.mockReset()
    fetchCollectionTreeMock.mockReset()
    fetchCollectionVariablesMock.mockReset()
    fetchEnvironmentsMock.mockReset()
    setActiveCollectionMock.mockReset()
    consumeCollectionVariablesSelfEchoMock.mockReset()
    sendWebSocketMessageMock.mockReset()
    isWebSocketConnectedMock = true
    capturedWebSocketOptions.current = undefined
  })

  it('uses the default sidebar width when no stored width exists', async () => {
    const { default: App } = await import('@/App')
    render(<App />)

    expect(screen.getByTestId('collections-sidebar')).toHaveStyle({ width: '288px' })
  })

  it('restores the sidebar width from localStorage when valid', async () => {
    window.localStorage.setItem('rocket-api:sidebar-width', '360')

    const { default: App } = await import('@/App')
    render(<App />)

    expect(screen.getByTestId('collections-sidebar')).toHaveStyle({ width: '360px' })
  })

  it('ignores invalid stored sidebar widths and falls back to default', async () => {
    window.localStorage.setItem('rocket-api:sidebar-width', '40')

    const { default: App } = await import('@/App')
    render(<App />)

    expect(screen.getByTestId('collections-sidebar')).toHaveStyle({ width: '288px' })
  })

  it('skips collection variable refetch for one matching collection.bru self-echo', async () => {
    consumeCollectionVariablesSelfEchoMock.mockReturnValue(true)

    const { default: App } = await import('@/App')
    render(<App />)

    capturedWebSocketOptions.current?.onMessage?.({
      type: 'file_change',
      collection: 'snehal',
      data: { relativePath: 'collection.bru' },
    })

    expect(consumeCollectionVariablesSelfEchoMock).toHaveBeenCalledWith(
      'snehal',
      'collection.bru'
    )
    expect(fetchCollectionVariablesMock).not.toHaveBeenCalled()
  })

  it('still refetches collection variables when no self-echo marker is present', async () => {
    consumeCollectionVariablesSelfEchoMock.mockReturnValue(false)

    const { default: App } = await import('@/App')
    render(<App />)

    capturedWebSocketOptions.current?.onMessage?.({
      type: 'file_change',
      collection: 'snehal',
      data: { relativePath: 'collection.bru' },
    })

    expect(consumeCollectionVariablesSelfEchoMock).toHaveBeenCalledWith(
      'snehal',
      'collection.bru'
    )
    expect(fetchCollectionVariablesMock).toHaveBeenCalledWith('snehal')
  })

  it('subscribes to the active collection over websocket', async () => {
    const { default: App } = await import('@/App')
    render(<App />)

    expect(sendWebSocketMessageMock).toHaveBeenCalledWith({
      type: 'subscribe',
      collection: 'snehal',
    })
  })

  it('resubscribes when the websocket reconnects', async () => {
    const { default: App } = await import('@/App')
    const { rerender } = render(<App />)

    sendWebSocketMessageMock.mockClear()
    isWebSocketConnectedMock = false
    rerender(<App />)
    isWebSocketConnectedMock = true
    rerender(<App />)

    expect(sendWebSocketMessageMock).toHaveBeenCalledWith({
      type: 'subscribe',
      collection: 'snehal',
    })
  })

  it('does not refetch the collection list for ordinary active-collection file writes', async () => {
    const { default: App } = await import('@/App')
    render(<App />)

    capturedWebSocketOptions.current?.onMessage?.({
      type: 'file_change',
      collection: 'snehal',
      data: { relativePath: 'requests/get-users.bru' },
    })

    expect(fetchCollectionsMock).not.toHaveBeenCalled()
    expect(fetchCollectionTreeMock).toHaveBeenCalledWith('snehal')
  })

  it('clamps sidebar width while dragging the resize handle', async () => {
    const { default: App } = await import('@/App')
    render(<App />)

    fireEvent.pointerDown(screen.getByTestId('sidebar-resize-handle'), { clientX: 288 })
    fireEvent.pointerMove(window, { clientX: 120 })
    fireEvent.pointerUp(window)

    expect(screen.getByTestId('collections-sidebar')).toHaveStyle({ width: '220px' })
  })
})
