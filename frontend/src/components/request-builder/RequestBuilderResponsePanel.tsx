import { Button } from '@/components/ui/button'
import { MonacoEditor } from '@/components/ui/monaco-editor'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HttpResponse } from '@/types'
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
                <div className="flex-1 min-h-0">
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
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-sm">Send a request to see the response</p>
          </div>
        </div>
      )}
    </div>
  )
}

