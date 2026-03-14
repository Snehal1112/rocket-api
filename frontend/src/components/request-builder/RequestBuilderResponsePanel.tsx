import { Button } from '@/components/ui/button'
import { MonacoEditor } from '@/components/ui/monaco-editor'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HttpResponse, ScriptTestResult } from '@/types'
import { Copy } from 'lucide-react'
import { useMemo, useState } from 'react'

interface RequestBuilderResponsePanelProps {
  response: HttpResponse | null
}

const formatResponseBody = (body: unknown): string => {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return body
    }
  }
  if (body === null || body === undefined) {
    return ''
  }
  try {
    return JSON.stringify(body, null, 2)
  } catch {
    return String(body)
  }
}

export function RequestBuilderResponsePanel({
  response,
}: RequestBuilderResponsePanelProps) {
  const [responseTab, setResponseTab] = useState('body')
  const formattedBody = useMemo(
    () => (response ? formatResponseBody(response.body) : ''),
    [response]
  )

  const allTests = useMemo<ScriptTestResult[]>(() => [
    ...(response?.preScriptResult?.tests ?? []),
    ...(response?.scriptResult?.tests ?? []),
  ], [response])

  const passCount = useMemo(() => allTests.filter(t => t.passed).length, [allTests])
  const failCount = allTests.length - passCount

  return (
    <div className="flex-1 flex flex-col bg-card/65 overflow-hidden min-h-0 backdrop-blur-sm">
      {response ? (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-md font-bold text-sm ${
                response.status >= 200 && response.status < 300
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : response.status >= 300 && response.status < 400
                  ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  : response.status >= 400
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}>
                {response.status}
              </div>
              <span className="font-medium text-foreground">
                {response.statusText?.replace(/^\d+\s*/, '') || 'OK'}
              </span>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="font-mono">{response.time}ms</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="font-mono">{(response.size / 1024).toFixed(2)} KB</span>
              </div>

              {response.headers?.['X-Rocket-Mock'] && (
                <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-1 rounded border border-yellow-200">
                  Mock Response
                </span>
              )}
            </div>
            <Tabs value={responseTab} onValueChange={setResponseTab} className="w-auto">
              <TabsList className="h-7 bg-transparent">
                <TabsTrigger value="body" className="text-xs h-6 data-[state=active]:bg-background">Body</TabsTrigger>
                <TabsTrigger value="headers" className="text-xs h-6 data-[state=active]:bg-background">Headers</TabsTrigger>
                <TabsTrigger value="tests" className="text-xs h-6 data-[state=active]:bg-background">
                  Tests
                  {allTests.length > 0 && (
                    <span className={`ml-1 text-[10px] font-semibold px-1 rounded ${failCount > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {passCount}/{allTests.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {responseTab === 'body' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Response Body</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(formattedBody)
                    }}
                    className="h-7 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy
                  </Button>
                </div>
                <div className="flex-1 min-h-0 border rounded">
                  <MonacoEditor
                    height="100%"
                    language="json"
                    value={formattedBody}
                    onChange={() => {}}
                  />
                </div>
              </div>
            )}
            {responseTab === 'headers' && (
              <div className="space-y-1">
                {response.headers && Object.entries(response.headers).map(([key, value]) => (
                  <div key={key} className="flex text-xs">
                    <span className="font-medium text-muted-foreground w-40 shrink-0">{key}:</span>
                    <span className="text-foreground">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
            {responseTab === 'tests' && (
              <div className="space-y-1">
                {allTests.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No tests ran. Use <code className="font-mono bg-muted px-1 rounded">pm.test()</code> in your scripts.
                  </p>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground mb-2">
                      {passCount} passed · {failCount} failed
                    </div>
                    {allTests.map((t, i) => (
                      <div key={i} className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded ${t.passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <span className="font-bold shrink-0">{t.passed ? '✓' : '✗'}</span>
                        <div className="min-w-0">
                          <span className="font-medium">{t.name}</span>
                          {t.error && <div className="text-[11px] opacity-75 mt-0.5 font-mono">{t.error}</div>}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground select-none">
          <div className="text-center">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto opacity-80 drop-shadow-lg"
            >
              {/* Exhaust glow */}
              <ellipse cx="60" cy="108" rx="12" ry="4" className="fill-primary/15" />
              <ellipse cx="60" cy="104" rx="8" ry="3" className="fill-primary/25" />
              {/* Rocket body */}
              <path
                d="M60 20 C60 20, 78 40, 78 70 C78 85, 70 95, 60 95 C50 95, 42 85, 42 70 C42 40, 60 20, 60 20Z"
                className="fill-muted-foreground/20 stroke-muted-foreground/40"
                strokeWidth="1.5"
              />
              {/* Nose cone */}
              <path
                d="M60 20 C60 20, 68 35, 68 45 C68 45, 60 42, 52 45 C52 35, 60 20, 60 20Z"
                className="fill-primary/80"
              />
              {/* Window */}
              <circle cx="60" cy="55" r="8" className="fill-background stroke-muted-foreground/40" strokeWidth="1.5" />
              <circle cx="60" cy="55" r="5" className="fill-background" />
              <circle cx="57" cy="52" r="2" className="fill-primary/40" />
              {/* Fins */}
              <path d="M42 75 L30 90 L42 88Z" className="fill-primary/50" />
              <path d="M78 75 L90 90 L78 88Z" className="fill-primary/50" />
              {/* Flame */}
              <path d="M54 95 Q60 115 66 95" className="fill-amber-500/60" />
              <path d="M56 95 Q60 108 64 95" className="fill-red-500/40" />
            </svg>
            <p className="mt-5 text-sm font-semibold text-foreground/80">Ready for liftoff</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Send a request to see the response here
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
              <span>Press</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Ctrl+Enter
              </kbd>
              <span>to send</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

