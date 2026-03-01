import { useState } from 'react'
import { useTabsStore } from '@/store/tabs-store'
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
import { Plus, X } from 'lucide-react'
import type { HttpMethod } from '@/types'

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-blue-600',
  POST: 'text-green-600',
  PUT: 'text-yellow-600',
  DELETE: 'text-red-600',
  PATCH: 'text-purple-600',
  HEAD: 'text-gray-500',
  OPTIONS: 'text-gray-500',
}

export function RequestTabs() {
  const { tabs, activeTabId, newTab, closeTab, setActiveTab } = useTabsStore()
  const [closeCandidate, setCloseCandidate] = useState<string | null>(null)

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    const tab = tabs.find(t => t.id === tabId)
    if (tab?.isDirty) {
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

  return (
    <>
      <div className="flex items-center border-b border-border bg-muted/20 overflow-x-auto shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border shrink-0 max-w-[180px] group transition-colors ${
              tab.id === activeTabId
                ? 'bg-background border-b-2 border-b-orange-500 -mb-px'
                : 'hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            <span
              className={`font-semibold text-[10px] shrink-0 ${METHOD_COLORS[tab.request.method]}`}
            >
              {tab.request.method}
            </span>
            <span className="truncate">{tab.request.name}</span>
            {tab.isDirty && (
              <span className="text-orange-500 shrink-0 text-[10px]" title="Unsaved changes">
                ●
              </span>
            )}
            <span
              role="button"
              aria-label="Close tab"
              onClick={e => handleClose(e, tab.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}

        <Button
          variant="ghost"
          size="icon"
          onClick={newTab}
          className="h-8 w-8 shrink-0 rounded-none"
          title="New tab"
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
              <strong>{candidateTab?.request.name}</strong> has unsaved changes
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
