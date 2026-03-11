import { useState } from 'react'
import { useTabsStore, isRequestTab } from '@/store/tabs-store'
import { useCollectionsStore } from '@/store/collections'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, X, Database } from 'lucide-react'
import { METHOD_TEXT_COLORS } from '@/lib/constants'

export function RequestTabs() {
  const { tabs, activeTabId, newTab, closeTab, setActiveTab } = useTabsStore()
  const { collections, activeCollection, setActiveCollection } = useCollectionsStore()
  const [closeCandidate, setCloseCandidate] = useState<string | null>(null)

  const handleActivateTab = (tabId: string) => {
    setActiveTab(tabId)
    const tab = tabs.find(t => t.id === tabId)
    if (!tab || !isRequestTab(tab) || !tab.collectionName) return
    if (activeCollection?.name === tab.collectionName) return

    const collection = collections.find(c => c.name === tab.collectionName)
    if (!collection) return

    setActiveCollection(collection)
  }

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    const tab = tabs.find(t => t.id === tabId)
    if (tab && isRequestTab(tab) && tab.isDirty) {
      setCloseCandidate(tabId)
    } else {
      closeTab(tabId)
    }
  }

  const confirmClose = () => {
    if (closeCandidate) {
      closeTab(closeCandidate)
      setCloseCandidate(null)
    }
  }

  const candidateTab = tabs.find(t => t.id === closeCandidate)
  const candidateLabel = candidateTab
    ? isRequestTab(candidateTab)
      ? candidateTab.request.name
      : candidateTab.collectionName
    : ''

  return (
    <>
      <div className="flex items-center border-b border-border/70 bg-card/70 backdrop-blur-sm overflow-x-auto overflow-y-hidden shrink-0">
        {tabs.map(tab => (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={tab.id === activeTabId}
            onClick={() => handleActivateTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleActivateTab(tab.id)
              }
            }}
            className={`group flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border/70 cursor-pointer shrink-0 min-w-0 max-w-[190px] transition-all ${
              tab.id === activeTabId
                ? 'bg-background/95 border-b-2 border-b-primary -mb-px text-foreground'
                : 'hover:bg-accent/50 text-muted-foreground'
            }`}
          >
            {isRequestTab(tab) ? (
              <>
                <span
                  className={`font-semibold text-[10px] shrink-0 ${METHOD_TEXT_COLORS[tab.request.method]}`}
                >
                  {tab.request.method}
                </span>
                <span className="truncate">{tab.request.name}</span>
                {tab.isDirty && (
                  <span
                    className="text-primary shrink-0 text-[10px]"
                    aria-label="Unsaved changes"
                  >
                    ●
                  </span>
                )}
              </>
            ) : (
              <>
                <Database className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                <span className="truncate font-medium">{tab.collectionName}</span>
              </>
            )}
            <button
              type="button"
              aria-label="Close tab"
              onClick={(e) => handleClose(e, tab.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-foreground rounded-sm p-0.5 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        <Button
          variant="ghost"
          size="icon"
              onClick={newTab}
          className="h-8 w-8 shrink-0 rounded-none hover:bg-accent/60"
          aria-label="New tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog
        open={!!closeCandidate}
        onOpenChange={open => !open && setCloseCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{candidateLabel}</strong> has unsaved changes
              that will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
