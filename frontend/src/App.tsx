import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RequestBuilder } from '@/components/request-builder/RequestBuilder'
import { CollectionsSidebar } from '@/components/collections/CollectionsSidebar'
import { EnvironmentsPanel } from '@/components/collections/EnvironmentsPanel'
import { ThemeProvider, useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'
import { useCollectionsStore } from '@/store/collections'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const queryClient = new QueryClient()

// Theme Toggle Component
function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="h-8 w-8" />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-8 w-8"
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
  const [showEnvironments, setShowEnvironments] = useState(false)
  const { fetchCollections, fetchCollectionTree, activeCollection } = useCollectionsStore()
  
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
        <div className="h-screen flex flex-col bg-background font-sans text-sm">
          {/* Minimal Header - Bruno Style */}
          <header className="h-12 border-b border-border flex items-center px-4 bg-background shrink-0">
            <div className="flex items-center gap-2">
              <img 
                src="/rocket.png" 
                alt="Rocket API" 
                className="w-6 h-6 object-contain"
              />
              <span className="font-semibold text-foreground">Rocket</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button 
                onClick={() => setShowEnvironments(!showEnvironments)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  showEnvironments 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-accent/50 text-muted-foreground'
                }`}
              >
                Environments
              </button>
            </div>
          </header>

          {/* Main Content - Three Panel Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Collections (Bruno Style) */}
            <CollectionsSidebar />
            
            {/* Center Panel - Request/Response (Bruno Style - Stacked) */}
            <main className="flex-1 flex flex-col min-w-0 bg-background">
              <RequestBuilder 
                onRequestSent={(req, res) => console.log('Request sent:', req, res)}
              />
            </main>
            
            {/* Right Panel - Environments (Collapsible) */}
            {showEnvironments && (
              <EnvironmentsPanel />
            )}
          </div>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App