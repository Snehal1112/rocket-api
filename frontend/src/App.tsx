import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RequestBuilder } from '@/components/request-builder/RequestBuilder'
import { RequestTabs } from '@/components/request-builder/RequestTabs'
import { CollectionsSidebar } from '@/components/collections/CollectionsSidebar'
import { CollectionOverview } from '@/components/collections/CollectionOverview'
import { GlobalStatusBar } from '@/components/layout/GlobalStatusBar'
import { ConsolePanel } from '@/components/layout/ConsolePanel'
import { WelcomeScreen } from '@/components/layout/WelcomeScreen'
import { useConsoleStore } from '@/store/console'
import { ThemeProvider, useTheme } from 'next-themes'
import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'
import { useCollectionsStore } from '@/store/collections'
import { useTabsStore, isRequestTab } from '@/store/tabs-store'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRuntimeConfig } from '@/lib/runtime-config'

const queryClient = new QueryClient()
const runtimeConfig = getRuntimeConfig()
const SIDEBAR_WIDTH_STORAGE_KEY = 'rocket-api:sidebar-width'
const DEFAULT_SIDEBAR_WIDTH = 288
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 520

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

function getInitialSidebarWidth() {
  if (typeof window === 'undefined') {
    return DEFAULT_SIDEBAR_WIDTH
  }

  const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY))
  if (!Number.isFinite(stored)) {
    return DEFAULT_SIDEBAR_WIDTH
  }

  return stored >= MIN_SIDEBAR_WIDTH && stored <= MAX_SIDEBAR_WIDTH
    ? stored
    : DEFAULT_SIDEBAR_WIDTH
}

// Theme Toggle Component
function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch - suppressHydrationWarning handles the mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="h-8 w-8" />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-8 w-8 rounded-full border-border/70 bg-card/70 backdrop-blur"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}

function App() {
  const {
    fetchCollections,
    activeCollection,
    collections,
    setActiveCollection,
  } = useCollectionsStore()
  const tabs = useTabsStore(state => state.tabs)
  const activeTabId = useTabsStore(state => state.activeTabId)
  const activeTab = tabs.find(t => t.id === activeTabId)

  const handleFileChangeMessage = (message: {
    collection?: string
    data?: { relativePath?: string; type?: string }
  }) => {
    const relativePath = message.data?.relativePath ?? ''

    if (relativePath.startsWith('environments/')) {
      if (activeCollection && message.collection === activeCollection.name) {
        useCollectionsStore.getState().fetchEnvironments(activeCollection.name)
      }
      return
    }

    if (relativePath === 'collection.bru') {
      if (activeCollection && message.collection === activeCollection.name) {
        const store = useCollectionsStore.getState()
        if (store.consumeCollectionVariablesSelfEcho(activeCollection.name, relativePath)) {
          return
        }
        store.fetchCollectionVariables(activeCollection.name)
      }
      return
    }

    if (!relativePath.includes('/') && relativePath !== '' && !relativePath.includes('.')) {
      fetchCollections()
      return
    }

    if (activeCollection && message.collection === activeCollection.name) {
      useCollectionsStore.getState().fetchCollectionTree(activeCollection.name)
    }
  }

  const {
    send: sendWebSocketMessage,
    isConnected: isWebSocketConnected,
  } = useWebSocket(runtimeConfig.wsUrl, {
    onMessage: (message) => {
      if (message.type === 'file_change') {
        console.log('File changed:', message)
        handleFileChangeMessage(message as { collection?: string; data?: { relativePath?: string } })
      }
    },
    onConnect: () => {
      console.log('WebSocket connected - real-time sync enabled')
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected - real-time sync disabled')
    }
  })

  const syncWebSocketSubscription = useCallback(() => {
    if (!isWebSocketConnected) {
      return
    }

    if (activeCollection?.name) {
      sendWebSocketMessage({
        type: 'subscribe',
        collection: activeCollection.name,
      })
      return
    }

    sendWebSocketMessage({ type: 'unsubscribe' })
  }, [activeCollection?.name, isWebSocketConnected, sendWebSocketMessage])

  useEffect(() => {
    syncWebSocketSubscription()
  }, [syncWebSocketSubscription])

  // Restore active collection context from the currently active tab after reload.
  useEffect(() => {
    if (!activeTab || collections.length === 0) return

    const targetCollectionName = activeTab.collectionName
    if (!targetCollectionName) return

    const targetCollection = collections.find(c => c.name === targetCollectionName)
    if (!targetCollection) return

    if (activeCollection?.name !== targetCollection.name) {
      setActiveCollection(targetCollection)
    }
  }, [
    activeTab,
    activeCollection?.name,
    collections,
    setActiveCollection,
  ])

  const [isConsoleOpen, setIsConsoleOpen] = useState(false)
  const [consoleHeight, setConsoleHeight] = useState(280)
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth)
  const [isSidebarResizing, setIsSidebarResizing] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    if (!isSidebarResizing) return

    const handlePointerMove = (event: PointerEvent) => {
      setSidebarWidth(clampSidebarWidth(event.clientX))
    }

    const handlePointerUp = () => {
      setIsSidebarResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isSidebarResizing])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" storageKey="rocket-theme" enableSystem>
        <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/25 text-sm">
          <header className="h-14 border-b border-border/70 flex items-center px-4 bg-card/70 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2.5">
              <img 
                src="/rocket.png" 
                alt="Rocket API" 
                className="w-7 h-7 object-contain"
              />
              <div className="leading-tight">
                <p className="font-semibold tracking-tight text-foreground">Rocket</p>
                <p className="text-[11px] text-muted-foreground">API Workspace</p>
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            <CollectionsSidebar width={sidebarWidth} />
            <div
              data-testid="sidebar-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              onPointerDown={(event) => {
                event.preventDefault()
                setIsSidebarResizing(true)
              }}
              className={`w-1.5 shrink-0 cursor-col-resize bg-border/35 transition-colors hover:bg-primary/35 ${
                isSidebarResizing ? 'bg-primary/50' : ''
              }`}
            />
            
            <main className="flex-1 flex flex-col min-w-0 bg-transparent">
              <RequestTabs />
              {tabs.length === 0 ? (
                <WelcomeScreen />
              ) : activeTab && !isRequestTab(activeTab) ? (
                <CollectionOverview collectionName={activeTab.collectionName} />
              ) : (
                <RequestBuilder
                  onRequestSent={(req, res) => {
                    useConsoleStore.getState().addEntry(req, res)
                    if (!isConsoleOpen) setIsConsoleOpen(true)
                  }}
                />
              )}
            </main>
          </div>
          <ConsolePanel
            isOpen={isConsoleOpen}
            height={consoleHeight}
            onHeightChange={setConsoleHeight}
          />
          <GlobalStatusBar
            isConsoleOpen={isConsoleOpen}
            onConsoleToggle={() => setIsConsoleOpen(o => !o)}
          />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
