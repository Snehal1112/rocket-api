import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabsStore } from '@/store/tabs-store'

export function WelcomeScreen() {
  const newTab = useTabsStore(state => state.newTab)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center select-none">
      <img
        src="/rocket.png"
        alt="Rocket API"
        className="w-24 h-24 object-contain opacity-80 drop-shadow-lg"
      />
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Launch your first request
        </h2>
        <p className="text-sm text-muted-foreground">
          Send your first HTTP request to get started.
        </p>
      </div>
      <Button onClick={newTab} className="gap-2">
        <Plus className="h-4 w-4" />
        New Request
      </Button>
    </div>
  )
}
