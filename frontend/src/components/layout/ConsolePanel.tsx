import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConsoleStore } from '@/store/console'
import { ConsoleEntry } from '@/types'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface ConsolePanelProps {
  isOpen: boolean
  height: number
  onHeightChange: (height: number) => void
}

const MIN_HEIGHT = 120
const MAX_HEIGHT = 600

function statusColor(status: number): string {
  if (status >= 500) return 'text-red-500'
  if (status >= 400) return 'text-orange-500'
  if (status >= 300) return 'text-yellow-500'
  if (status >= 200) return 'text-green-500'
  return 'text-muted-foreground'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function HeaderTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return <span className="text-muted-foreground">(none)</span>
  return (
    <table className="w-full">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td className="pr-2 font-medium text-foreground/80 align-top whitespace-nowrap">{k}</td>
            <td className="text-muted-foreground break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EntryDetail({ entry }: { entry: ConsoleEntry }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-2 bg-muted/30 border-t text-[11px]">
      <div>
        <div className="font-medium text-muted-foreground mb-1">Request Headers</div>
        <div className="font-mono bg-background/60 rounded p-1.5 max-h-32 overflow-auto">
          <HeaderTable headers={entry.requestHeaders} />
        </div>
      </div>
      <div>
        <div className="font-medium text-muted-foreground mb-1">Request Body</div>
        <pre className="font-mono whitespace-pre-wrap break-all bg-background/60 rounded p-1.5 max-h-32 overflow-auto">
          {entry.requestBody || '(empty)'}
        </pre>
      </div>
      <div>
        <div className="font-medium text-muted-foreground mb-1">Response Headers</div>
        <div className="font-mono bg-background/60 rounded p-1.5 max-h-32 overflow-auto">
          <HeaderTable headers={entry.responseHeaders} />
        </div>
      </div>
      <div>
        <div className="font-medium text-muted-foreground mb-1">Response Body</div>
        <pre className="font-mono whitespace-pre-wrap break-all bg-background/60 rounded p-1.5 max-h-32 overflow-auto">
          {entry.responseBody || '(empty)'}
        </pre>
      </div>
    </div>
  )
}

export function ConsolePanel({ isOpen, height, onHeightChange }: ConsolePanelProps) {
  const { entries, clearEntries } = useConsoleStore()
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const dragStartRef = useRef<{ y: number; h: number } | null>(null)

  if (!isOpen) return null

  const filtered = search
    ? entries.filter(e => e.url.toLowerCase().includes(search.toLowerCase()))
    : entries

  const handleDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = { y: e.clientY, h: height }

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return
      const delta = dragStartRef.current.y - ev.clientY
      const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartRef.current.h + delta))
      onHeightChange(next)
    }

    const onMouseUp = () => {
      dragStartRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      className="shrink-0 border-t border-border/70 bg-card/85 flex flex-col"
      style={{ height }}
    >
      {/* Drag handle. */}
      <div
        className="h-1 cursor-row-resize bg-border/40 hover:bg-primary/40 transition-colors shrink-0"
        onMouseDown={handleDragMouseDown}
      />

      {/* Tab strip + toolbar. */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/70 shrink-0">
        <span className="text-xs font-medium">Console</span>
        {entries.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {entries.length}
          </span>
        )}
        <div className="flex-1" />
        <Input
          placeholder="Filter by URL"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-6 text-xs w-48"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={clearEntries}
        >
          Clear
        </Button>
      </div>

      {/* Entry list. */}
      <div className="flex-1 overflow-y-auto text-[11px] font-mono">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No requests sent yet
          </div>
        ) : (
          filtered.map(entry => (
            <div key={entry.id}>
              <div
                data-testid="console-entry-row"
                className="flex items-center gap-2 px-3 py-1 hover:bg-accent/40 cursor-pointer border-b border-border/30"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                {expandedId === entry.id
                  ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                }
                <span className="text-muted-foreground w-16 shrink-0">{formatTime(entry.timestamp)}</span>
                <span className="font-semibold w-12 shrink-0">{entry.method}</span>
                <span className="flex-1 truncate text-foreground/80">{entry.url}</span>
                <span className={`w-10 text-right shrink-0 font-semibold ${statusColor(entry.status)}`}>
                  {entry.status}
                </span>
                <span className="text-muted-foreground w-16 text-right shrink-0">
                  {entry.duration}ms
                </span>
              </div>
              {expandedId === entry.id && <EntryDetail entry={entry} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
