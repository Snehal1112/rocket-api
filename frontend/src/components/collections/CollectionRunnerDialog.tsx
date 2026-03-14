import { useState, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { apiService, CollectionNode } from '@/lib/api'
import { HttpRequest, HttpResponse } from '@/types'
import { Loader2, Play, Square, CheckCircle2, XCircle, Clock } from 'lucide-react'

interface CollectionRunnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  collectionTree: CollectionNode | null
  environmentVariables?: Record<string, string>
}

interface RunResult {
  name: string
  path: string
  method: string
  url: string
  status: number
  statusText: string
  time: number
  passed: boolean
  testsPassed: number
  testsFailed: number
  error?: string
}

type RunState = 'idle' | 'running' | 'completed' | 'cancelled'

function collectRequestPaths(node: CollectionNode, basePath: string = ''): { name: string; path: string }[] {
  const results: { name: string; path: string }[] = []
  if (node.type === 'request' && node.path) {
    results.push({ name: node.name, path: node.path })
  }
  if (node.children) {
    for (const child of node.children) {
      results.push(...collectRequestPaths(child, basePath))
    }
  }
  return results
}

function parseRequest(bruFile: Record<string, unknown>): HttpRequest {
  const http = bruFile.http as Record<string, unknown>
  const body = bruFile.body as Record<string, unknown> | undefined
  const meta = bruFile.meta as Record<string, unknown>
  const scripts = bruFile.scripts as Record<string, unknown> | undefined

  return {
    id: Date.now().toString(),
    name: (meta?.name as string) || 'Untitled',
    method: (http?.method as HttpRequest['method']) || 'GET',
    url: (http?.url as string) || '',
    headers: ((http?.headers as Array<{ key: string; value: string; enabled?: boolean }>) || []).map(h => ({
      key: h.key,
      value: h.value,
      enabled: h.enabled ?? true,
    })),
    queryParams: ((http?.queryParams as Array<{ key: string; value: string; enabled: boolean }>) || []).map(q => ({
      key: q.key,
      value: q.value,
      enabled: q.enabled,
    })),
    pathParams: ((http?.pathParams as Array<{ key: string; value: string; enabled: boolean }>) || []).map(p => ({
      key: p.key,
      value: p.value,
      enabled: p.enabled,
    })),
    body: {
      type: ((body?.type as string) || 'none') as HttpRequest['body']['type'],
      content: (body?.data as string) || '',
      formData: body?.formData as HttpRequest['body']['formData'],
      fileName: body?.fileName as string | undefined,
    },
    auth: (http?.auth as HttpRequest['auth']) || { type: 'none' },
    scripts: {
      language: (scripts?.language as 'javascript' | 'typescript') || 'javascript',
      preRequest: (scripts?.preRequest as string) || '',
      postResponse: (scripts?.postResponse as string) || '',
    },
  }
}

export function CollectionRunnerDialog({
  open,
  onOpenChange,
  collectionName,
  collectionTree,
  environmentVariables,
}: CollectionRunnerDialogProps) {
  const [runState, setRunState] = useState<RunState>('idle')
  const [results, setResults] = useState<RunResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalRequests, setTotalRequests] = useState(0)
  const cancelledRef = useRef(false)

  const handleRun = useCallback(async () => {
    if (!collectionTree) return

    const requestPaths = collectRequestPaths(collectionTree)
    if (requestPaths.length === 0) return

    setRunState('running')
    setResults([])
    setCurrentIndex(0)
    setTotalRequests(requestPaths.length)
    cancelledRef.current = false

    for (let i = 0; i < requestPaths.length; i++) {
      if (cancelledRef.current) {
        setRunState('cancelled')
        return
      }

      setCurrentIndex(i + 1)
      const { name, path } = requestPaths[i]

      try {
        const bruFile = await apiService.getRequest(collectionName, path) as Record<string, unknown>
        const request = parseRequest(bruFile)

        const response: HttpResponse = await apiService.sendRequest(request, environmentVariables)

        const testsPassed = (response.scriptResult?.tests || []).filter(t => t.passed).length
        const testsFailed = (response.scriptResult?.tests || []).filter(t => !t.passed).length

        setResults(prev => [...prev, {
          name,
          path,
          method: request.method,
          url: request.url,
          status: response.status,
          statusText: response.statusText,
          time: response.time,
          passed: response.status >= 200 && response.status < 400 && testsFailed === 0,
          testsPassed,
          testsFailed,
        }])
      } catch (error) {
        setResults(prev => [...prev, {
          name,
          path,
          method: 'GET',
          url: '',
          status: 0,
          statusText: 'Error',
          time: 0,
          passed: false,
          testsPassed: 0,
          testsFailed: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        }])
      }
    }

    setRunState('completed')
  }, [collectionTree, collectionName, environmentVariables])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    setRunState('cancelled')
  }, [])

  const handleReset = useCallback(() => {
    setRunState('idle')
    setResults([])
    setCurrentIndex(0)
    setTotalRequests(0)
  }, [])

  const passedCount = results.filter(r => r.passed).length
  const failedCount = results.filter(r => !r.passed).length
  const totalTime = results.reduce((sum, r) => sum + r.time, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            Collection Runner
            <Badge variant="secondary" className="text-xs">{collectionName}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Controls */}
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          {runState === 'idle' && (
            <Button size="sm" onClick={handleRun} disabled={!collectionTree} className="text-xs">
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Run All Requests
            </Button>
          )}
          {runState === 'running' && (
            <>
              <Button size="sm" variant="destructive" onClick={handleCancel} className="text-xs">
                <Square className="h-3.5 w-3.5 mr-1.5" />
                Cancel
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running {currentIndex} of {totalRequests}...
              </div>
            </>
          )}
          {(runState === 'completed' || runState === 'cancelled') && (
            <>
              <Button size="sm" variant="outline" onClick={handleRun} className="text-xs">
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Run Again
              </Button>
              <Button size="sm" variant="ghost" onClick={handleReset} className="text-xs">
                Clear
              </Button>
            </>
          )}
        </div>

        {/* Progress bar */}
        {runState !== 'idle' && totalRequests > 0 && (
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  failedCount > 0 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${(results.length / totalRequests) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {passedCount} passed
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {failedCount} failed
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {totalTime}ms total
              </span>
            </div>
          </div>
        )}

        {/* Results */}
        <ScrollArea className="flex-1 min-h-[200px]">
          {results.length === 0 && runState === 'idle' && (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Click "Run All Requests" to execute all requests in this collection
            </div>
          )}
          <div className="space-y-1">
            {results.map((result, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${
                  result.passed
                    ? 'bg-green-50 dark:bg-green-500/10'
                    : 'bg-red-50 dark:bg-red-500/10'
                }`}
              >
                {result.passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span className="font-semibold shrink-0 w-16 text-[10px]">
                  {result.method}
                </span>
                <span className="truncate font-medium" title={result.url || result.name}>
                  {result.name}
                </span>
                <span className="ml-auto shrink-0 flex items-center gap-2">
                  {result.error ? (
                    <span className="text-red-600" title={result.error}>Error</span>
                  ) : (
                    <>
                      <span className={`font-semibold ${
                        result.status >= 200 && result.status < 300
                          ? 'text-green-600'
                          : result.status >= 400
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }`}>
                        {result.status}
                      </span>
                      <span className="text-muted-foreground font-mono">{result.time}ms</span>
                      {(result.testsPassed + result.testsFailed) > 0 && (
                        <span className={`text-[10px] px-1 rounded ${
                          result.testsFailed > 0
                            ? 'bg-red-100 text-red-600 dark:bg-red-500/20'
                            : 'bg-green-100 text-green-600 dark:bg-green-500/20'
                        }`}>
                          {result.testsPassed}/{result.testsPassed + result.testsFailed}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
