import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchCollectionsMock = vi.fn()
const fetchCollectionTreeMock = vi.fn()
const fetchCollectionVariablesMock = vi.fn()
const fetchEnvironmentsMock = vi.fn()
const setActiveCollectionMock = vi.fn()
const consumeCollectionVariablesSelfEchoMock = vi.fn()

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

const capturedWebSocketOptions: { current?: { onMessage?: (message: unknown) => void } } = {}

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
  CollectionsSidebar: () => <div>CollectionsSidebar</div>,
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
    fetchCollectionsMock.mockReset()
    fetchCollectionTreeMock.mockReset()
    fetchCollectionVariablesMock.mockReset()
    fetchEnvironmentsMock.mockReset()
    setActiveCollectionMock.mockReset()
    consumeCollectionVariablesSelfEchoMock.mockReset()
    capturedWebSocketOptions.current = undefined
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
})
