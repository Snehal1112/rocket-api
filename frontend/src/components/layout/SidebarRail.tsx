import { Folder, Clock, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OverlayTab } from '@/hooks/use-sidebar-state'

interface SidebarRailProps {
  activeOverlayTab: OverlayTab | null
  onOpenOverlay: (tab: OverlayTab) => void
  onToggle: () => void
}

export function SidebarRail({ activeOverlayTab, onOpenOverlay, onToggle }: SidebarRailProps) {
  return (
    <div className="w-12 shrink-0 border-r border-border/70 bg-card/80 backdrop-blur-sm flex flex-col items-center py-2">
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenOverlay('collections')}
          className={`h-9 w-9 ${activeOverlayTab === 'collections' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
          title="Collections"
        >
          <Folder className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenOverlay('history')}
          className={`h-9 w-9 ${activeOverlayTab === 'history' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
          title="History"
        >
          <Clock className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="h-9 w-9 text-muted-foreground"
        title="Expand sidebar"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
