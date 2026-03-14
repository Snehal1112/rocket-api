import { RequestBuilder } from '@/components/request-builder/RequestBuilder'
import { RequestTabs } from '@/components/request-builder/RequestTabs'
import { CollectionsSidebar } from '@/components/collections/CollectionsSidebar'
import { CollectionOverview } from '@/components/collections/CollectionOverview'
import { GlobalStatusBar } from '@/components/layout/GlobalStatusBar'
import { ConsolePanel } from '@/components/layout/ConsolePanel'
import { WelcomeScreen } from '@/components/layout/WelcomeScreen'
import { SidebarRail } from '@/components/layout/SidebarRail'
import { useConsoleStore } from '@/store/console'
import { ThemeProvider, useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { useCollectionsStore } from '@/store/collections'
import { useTabsStore, isRequestTab } from '@/store/tabs-store'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Outlet } from 'react-router-dom'
import { useRouteSyncedTabs } from '@/features/workspace/hooks/useRouteSyncedTabs'
import { useRealtimeSync } from '@/features/realtime/hooks/useRealtimeSync'
import { useSidebarState } from '@/hooks/use-sidebar-state'

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
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
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

export function WorkspaceShell() {
  const {
    activeCollection,
    collections,
    setActiveCollection,
  } = useCollectionsStore()
  const tabs = useTabsStore(state => state.tabs)
  const activeTabId = useTabsStore(state => state.activeTabId)
  const activeTab = tabs.find(t => t.id === activeTabId)
  useRouteSyncedTabs()
  useRealtimeSync()

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
  const sidebar = useSidebarState()

  // Ctrl+B keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'b' && (event.ctrlKey || event.metaKey)) {
        // Skip when focus is inside Monaco Editor
        const target = event.target as HTMLElement
        if (target.closest('.monaco-editor')) return

        event.preventDefault()
        sidebar.toggle()
      }
      // Escape dismisses overlay
      if (event.key === 'Escape' && sidebar.isOverlayOpen) {
        sidebar.closeOverlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebar.isOverlayOpen, sidebar.toggle, sidebar.closeOverlay])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="rocket-theme" enableSystem>
      <div
        data-testid="workspace-shell"
        className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/25 text-sm"
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium focus:shadow-lg"
        >
          Skip to main content
        </a>
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

        <div className="flex-1 flex overflow-hidden relative">
          {sidebar.isCollapsed ? (
            <SidebarRail
              activeOverlayTab={sidebar.isOverlayOpen ? sidebar.overlayTab : null}
              onOpenOverlay={sidebar.openOverlay}
              onToggle={sidebar.toggle}
            />
          ) : (
            <>
              <div style={{ width: `${sidebar.sidebarWidth}px` }} className="shrink-0">
                <CollectionsSidebar />
              </div>
              <div
                data-testid="sidebar-resize-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
                onPointerDown={(event) => {
                  event.preventDefault()
                  sidebar.startResizing()
                }}
                className={`w-1.5 shrink-0 cursor-col-resize bg-border/35 transition-colors hover:bg-primary/35 ${
                  sidebar.isSidebarResizing ? 'bg-primary/50' : ''
                }`}
              />
            </>
          )}

          {/* Overlay sidebar */}
          {sidebar.isCollapsed && sidebar.isOverlayOpen && (
            <>
              <div
                data-testid="sidebar-overlay"
                className="absolute top-0 bottom-0 z-30 w-[280px] bg-card shadow-xl animate-in slide-in-from-left duration-150"
                style={{ left: '48px' }}
              >
                <CollectionsSidebar initialTab={sidebar.overlayTab} />
              </div>
              <div
                data-testid="sidebar-overlay-backdrop"
                className="absolute inset-0 z-20 bg-black/20"
                style={{ left: '48px' }}
                onClick={sidebar.closeOverlay}
              />
            </>
          )}

          <main id="main-content" className="flex-1 flex flex-col min-w-0 bg-transparent">
            <RequestTabs />
            <div className="hidden">
              <Outlet />
            </div>
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
  )
}
