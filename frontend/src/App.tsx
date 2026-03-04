import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RequestBuilder } from '@/components/request-builder/RequestBuilder'
import { RequestTabs } from '@/components/request-builder/RequestTabs'
import { CollectionsSidebar } from '@/components/collections/CollectionsSidebar'
import { CollectionOverview } from '@/components/collections/CollectionOverview'
import { GlobalStatusBar } from '@/components/layout/GlobalStatusBar'
import { ThemeProvider, useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'
import { useCollectionsStore } from '@/store/collections'
import { useTabsStore, isRequestTab } from '@/store/tabs-store'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const queryClient = new QueryClient()

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
  const { fetchCollections, fetchCollectionTree, activeCollection } = useCollectionsStore()
  const activeTab = useTabsStore(state => state.tabs.find(t => t.id === state.activeTabId))
  
  // WebSocket for real-time updates
  useWebSocket('ws://localhost:8080/ws', {
    onMessage: (message) => {
      if (message.type === 'file_change') {
        console.log('File changed:', message)
        // Refresh collections
        fetchCollections()
        // Refresh active collection tree if it's the one that changed
        if (activeCollection && message.collection === activeCollection.name) {
          fetchCollectionTree(activeCollection.name)
        }
      }
    },
    onConnect: () => {
      console.log('WebSocket connected - real-time sync enabled')
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected - real-time sync disabled')
    }
  })

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
            <CollectionsSidebar />
            
            <main className="flex-1 flex flex-col min-w-0 bg-transparent">
              <RequestTabs />
              {activeTab && !isRequestTab(activeTab) ? (
                <CollectionOverview collectionName={activeTab.collectionName} />
              ) : (
                <RequestBuilder
                  onRequestSent={(req, res) => console.log('Request sent:', req, res)}
                />
              )}
            </main>
          </div>
          <GlobalStatusBar />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
