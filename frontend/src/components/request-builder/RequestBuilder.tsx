import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HttpMethod, HttpRequest, HttpResponse, Header, QueryParam, RequestBody, FormDataField, AuthConfig } from '@/types'
import { apiService } from '@/lib/api'
import { mockApiService } from '@/lib/mock-api'
import { useTabsStore } from '@/store/tabs-store'
import { useCollectionsStore } from '@/store/collections'
import { useHistoryStore } from '@/store/history'
import { substituteRequestVariables } from '@/lib/environment'
import { MonacoEditor } from '@/components/ui/monaco-editor'
import { Play, Loader2, Plus, Check, X, FileText, Lock, Key, User, Upload, Save, Copy } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface RequestBuilderProps {
  onRequestSent?: (request: HttpRequest, response: HttpResponse) => void
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-blue-600 bg-blue-50 border-blue-200',
  POST: 'text-green-600 bg-green-50 border-green-200',
  PUT: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  DELETE: 'text-red-600 bg-red-50 border-red-200',
  PATCH: 'text-purple-600 bg-purple-50 border-purple-200',
  HEAD: 'text-gray-600 bg-gray-50 border-gray-200',
  OPTIONS: 'text-gray-600 bg-gray-50 border-gray-200',
}

export function RequestBuilder({ onRequestSent }: RequestBuilderProps) {
  const [activeTab, setActiveTab] = useState('params')
  const [responseTab, setResponseTab] = useState('body')
  const [bodyLanguage, setBodyLanguage] = useState('json')
  
  // Resizable panel state
  const [requestHeight, setRequestHeight] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Alert dialog state
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean
    title: string
    description: string
  }>({ isOpen: false, title: '', description: '' })
  
  // Handle resize
  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100
    
    // Clamp between 20% and 80%
    setRequestHeight(Math.max(20, Math.min(80, newHeight)))
  }, [isDragging])
  
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])
  
  // Tabs store
  const {
    tabs,
    activeTabId,
    updateActiveMethod,
    updateActiveUrl,
    updateActiveHeaders,
    updateActiveQueryParams,
    updateActiveBody,
    updateActiveAuth,
    setActiveTabResponse,
    setActiveTabLoading,
    saveActiveTab,
  } = useTabsStore()

  const activeTab_ = tabs.find(t => t.id === activeTabId)
  const currentRequest = activeTab_?.request
  const isDirty = activeTab_?.isDirty ?? false
  const isLoading = activeTab_?.isLoading ?? false
  const response = activeTab_?.response ?? null
  
  // Collections store
  const { activeCollection } = useCollectionsStore()
  
  // Local state for editing
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<Header[]>([])
  const [queryParams, setQueryParams] = useState<QueryParam[]>([])
  const [body, setBody] = useState<RequestBody>({ type: 'none', content: '' })
  const [auth, setAuth] = useState<AuthConfig>({ type: 'none' })
  
  // Sync local state when the active tab or its request changes from an external source.
  useEffect(() => {
    if (currentRequest) {
      setMethod(currentRequest.method)
      setUrl(currentRequest.url)
      setHeaders(currentRequest.headers)
      setQueryParams(currentRequest.queryParams)
      setBody(currentRequest.body)
      setAuth(currentRequest.auth)
    }
  }, [currentRequest?.id, activeTabId]) // Re-sync on request ID change or tab switch

  const handleSaveRequest = useCallback(async () => {
    if (!activeCollection) {
      setAlertDialog({
        isOpen: true,
        title: 'No Collection Selected',
        description: 'Please select a collection first before saving a request.'
      })
      return
    }

    // Flush local edits into the store before saving.
    updateActiveMethod(method)
    updateActiveUrl(url)
    updateActiveHeaders(headers)
    updateActiveQueryParams(queryParams)
    updateActiveBody(body)
    updateActiveAuth(auth)

    await saveActiveTab(activeCollection.name)
  }, [activeCollection, method, url, headers, queryParams, body, auth, updateActiveMethod, updateActiveUrl, updateActiveHeaders, updateActiveQueryParams, updateActiveBody, updateActiveAuth, saveActiveTab])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to send request
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (url.trim()) {
          handleSubmit()
        }
      }
      // Ctrl/Cmd + S to save request
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveRequest()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [url, method, headers, queryParams, body, auth, activeCollection])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!url.trim()) {
      return
    }

    // Flush local edits into the store before sending.
    updateActiveMethod(method)
    updateActiveUrl(url)
    updateActiveHeaders(headers)
    updateActiveQueryParams(queryParams)
    updateActiveBody(body)
    updateActiveAuth(auth)

    // Get active environment from collections store.
    const { activeEnvironment } = useCollectionsStore.getState()

    // Substitute environment variables.
    const substituted = substituteRequestVariables(
      url,
      headers,
      body.content,
      activeEnvironment
    )

    setActiveTabLoading(true)

    try {
      // Apply auth to headers.
      const finalHeaders = [...substituted.headers]

      if (auth.type === 'bearer' && auth.bearer?.token) {
        finalHeaders.push({
          key: 'Authorization',
          value: `Bearer ${auth.bearer.token}`,
          enabled: true
        })
      } else if (auth.type === 'basic' && auth.basic?.username) {
        const credentials = btoa(`${auth.basic.username}:${auth.basic.password}`)
        finalHeaders.push({
          key: 'Authorization',
          value: `Basic ${credentials}`,
          enabled: true
        })
      } else if (auth.type === 'api-key' && auth.apiKey?.key && auth.apiKey?.value) {
        if (auth.apiKey.in === 'header') {
          finalHeaders.push({
            key: auth.apiKey.key,
            value: auth.apiKey.value,
            enabled: true
          })
        }
      }

      const request: HttpRequest = {
        id: Date.now().toString(),
        name: 'Untitled Request',
        method,
        url: substituted.url,
        headers: finalHeaders.filter(h => h.enabled),
        body: { ...body, content: substituted.body },
        queryParams: queryParams.filter(q => q.enabled),
        auth
      }

      let httpResponse: HttpResponse
      let usedMockService = false

      try {
        httpResponse = await apiService.sendRequest(request)
      } catch {
        httpResponse = await mockApiService.sendRequest(request)
        usedMockService = true
      }

      // Add mock indicator to response if mock service was used.
      if (usedMockService) {
        httpResponse.headers = {
          ...httpResponse.headers,
          'X-Rocket-Mock': 'true'
        }
      }

      setActiveTabResponse(httpResponse)

      // Refresh history after successful request.
      const { fetchHistory } = useHistoryStore.getState()
      fetchHistory()

      if (onRequestSent) onRequestSent(request, httpResponse)
    } catch (error) {
      setActiveTabResponse({
        status: 0,
        statusText: 'Request Failed',
        headers: {},
        body: `Failed to send request.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        size: 0,
        time: 0
      })
    } finally {
      setActiveTabLoading(false)
    }
  }, [url, method, headers, queryParams, body, auth, onRequestSent, updateActiveMethod, updateActiveUrl, updateActiveHeaders, updateActiveQueryParams, updateActiveBody, updateActiveAuth, setActiveTabLoading, setActiveTabResponse])

  // Header management
  const addHeader = () => setHeaders([...headers, { key: '', value: '', enabled: true }])
  const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index))
  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newHeaders = headers.map((h, i) =>
      i === index ? { ...h, [field]: value } : h
    )
    setHeaders(newHeaders)
  }

  // Query param management
  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '', enabled: true }])
  const removeQueryParam = (index: number) => setQueryParams(queryParams.filter((_, i) => i !== index))
  const updateQueryParam = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newParams = queryParams.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    )
    setQueryParams(newParams)
  }

  // Form data management
  const addFormDataField = () => {
    const newField: FormDataField = { key: '', value: '', type: 'text', enabled: true }
    setBody({ ...body, formData: [...(body.formData || []), newField] })
  }
  
  const removeFormDataField = (index: number) => {
    setBody({ ...body, formData: body.formData?.filter((_, i) => i !== index) })
  }
  
  const updateFormDataField = (index: number, field: keyof FormDataField, value: string | boolean) => {
    const newFields = [...(body.formData || [])]
    newFields[index] = { ...newFields[index], [field]: value }
    setBody({ ...body, formData: newFields })
  }

  // File upload handler
  const handleFileUpload = (index: number, file: File | null) => {
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      updateFormDataField(index, 'fileName', file.name)
      updateFormDataField(index, 'fileContent', content.split(',')[1]) // Remove data URL prefix
      updateFormDataField(index, 'value', file.name)
    }
    reader.readAsDataURL(file)
  }

  // Binary file upload
  const handleBinaryUpload = (file: File | null) => {
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setBody({
        type: 'binary',
        content: content.split(',')[1],
        fileName: file.name
      })
    }
    reader.readAsDataURL(file)
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

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      {/* Request Section */}
      <div 
        className="flex flex-col overflow-hidden"
        style={{ height: `${requestHeight}%`, minHeight: '20%', maxHeight: '80%' }}
      >
        {/* URL Bar - Enhanced Style */}
        <div className="p-4 border-b border-border bg-muted/40 shadow-sm">
          <TooltipProvider>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                <SelectTrigger className={`w-[110px] font-semibold text-sm ${METHOD_COLORS[method]} border-2`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="text-sm font-medium">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex-1 relative">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter URL (use {{variable}} for env vars)"
                  className="text-sm pr-20 h-9 font-mono bg-background"
                />
                {url.includes('{{') && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">vars</span>
                  </div>
                )}
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    size="default"
                    className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 font-semibold px-4"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    <span className="ml-2">Send</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send Request (Ctrl+Enter)</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={handleSaveRequest}
                    disabled={!activeCollection}
                    className={`font-medium px-3 ${isDirty ? 'border-orange-300 text-orange-600 hover:bg-orange-50' : ''}`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isDirty ? 'Save*' : 'Save'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isDirty ? 'Save changes (Ctrl+S)' : 'No changes to save'}</p>
                </TooltipContent>
              </Tooltip>
            </form>
          </TooltipProvider>
        </div>

        {/* Request Tabs - Bruno Style */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-9 px-3">
            <TabsTrigger value="params" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent">
              Params {queryParams.filter(p => p.enabled).length > 0 && `(${queryParams.filter(p => p.enabled).length})`}
            </TabsTrigger>
            <TabsTrigger value="headers" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent">
              Headers {headers.filter(h => h.enabled).length > 0 && `(${headers.filter(h => h.enabled).length})`}
            </TabsTrigger>
            <TabsTrigger value="body" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent">
              Body
            </TabsTrigger>
            <TabsTrigger value="auth" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent">
              Auth {auth.type !== 'none' && '●'}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto p-3">
            <TabsContent value="params" className="mt-0 h-full">
              <div className="space-y-2">
                {queryParams.map((param, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateQueryParam(index, 'enabled', !param.enabled)}
                      className={`w-4 h-4 rounded border p-0 ${
                        param.enabled ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600' : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {param.enabled && <Check className="h-3 w-3" />}
                    </Button>
                    <Input
                      placeholder="Key"
                      value={param.key}
                      onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                      className="flex-1 text-xs h-8"
                    />
                    <Input
                      placeholder="Value"
                      value={param.value}
                      onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                      className="flex-1 text-xs h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQueryParam(index)}
                      className="h-7 w-7"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addQueryParam} className="text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Param
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="headers" className="mt-0 h-full">
              <div className="space-y-2">
                {headers.map((header, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateHeader(index, 'enabled', !header.enabled)}
                      className={`w-4 h-4 rounded border p-0 ${
                        header.enabled ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600' : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {header.enabled && <Check className="h-3 w-3" />}
                    </Button>
                    <Input
                      placeholder="Key"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      className="flex-1 text-xs h-8"
                    />
                    <Input
                      placeholder="Value"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      className="flex-1 text-xs h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHeader(index)}
                      className="h-7 w-7"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addHeader} className="text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Header
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="body" className="mt-0 h-full">
              <div className="space-y-2 h-full flex flex-col">
                <div className="flex items-center gap-2">
                  <Select value={body.type} onValueChange={(v) => setBody({ ...body, type: v as RequestBody['type'] })}>
                    <SelectTrigger className="w-[140px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">None</SelectItem>
                      <SelectItem value="json" className="text-xs">JSON</SelectItem>
                      <SelectItem value="form-data" className="text-xs">Form Data</SelectItem>
                      <SelectItem value="raw" className="text-xs">Raw</SelectItem>
                      <SelectItem value="binary" className="text-xs">Binary</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {body.type === 'json' && (
                    <Select value={bodyLanguage} onValueChange={setBodyLanguage}>
                      <SelectTrigger className="w-[120px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json" className="text-xs">JSON</SelectItem>
                        <SelectItem value="javascript" className="text-xs">JavaScript</SelectItem>
                        <SelectItem value="html" className="text-xs">HTML</SelectItem>
                        <SelectItem value="xml" className="text-xs">XML</SelectItem>
                        <SelectItem value="plaintext" className="text-xs">Text</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {body.type === 'none' && (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    No body content
                  </div>
                )}

                {(body.type === 'json' || body.type === 'raw') && (
                  <div className="flex-1 border rounded min-h-[200px]">
                    <MonacoEditor
                      height="100%"
                      language={body.type === 'json' ? 'json' : 'plaintext'}
                      value={body.content}
                      onChange={(value) => setBody({ ...body, content: value })}
                    />
                  </div>
                )}

                {body.type === 'form-data' && (
                  <div className="space-y-2">
                    {body.formData?.map((field, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <button
                          onClick={() => updateFormDataField(index, 'enabled', !field.enabled)}
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            field.enabled ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300'
                          }`}
                        >
                          {field.enabled && <Check className="h-3 w-3" />}
                        </button>
                        <Input
                          placeholder="Key"
                          value={field.key}
                          onChange={(e) => updateFormDataField(index, 'key', e.target.value)}
                          className="flex-1 text-xs h-8"
                        />
                        {field.type === 'text' ? (
                          <Input
                            placeholder="Value"
                            value={field.value}
                            onChange={(e) => updateFormDataField(index, 'value', e.target.value)}
                            className="flex-1 text-xs h-8"
                          />
                        ) : (
                          <div className="flex-1 flex items-center gap-2 px-2 h-8 border rounded text-xs">
                            <FileText className="h-3 w-3" />
                            <span className="truncate">{field.fileName || 'No file selected'}</span>
                            <input
                              type="file"
                              onChange={(e) => handleFileUpload(index, e.target.files?.[0] || null)}
                              className="hidden"
                              id={`file-${index}`}
                            />
                            <label htmlFor={`file-${index}`} className="cursor-pointer text-blue-500 hover:underline ml-auto">
                              Choose
                            </label>
                          </div>
                        )}
                        <Select 
                          value={field.type} 
                          onValueChange={(v) => updateFormDataField(index, 'type', v)}
                        >
                          <SelectTrigger className="w-[80px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text" className="text-xs">Text</SelectItem>
                            <SelectItem value="file" className="text-xs">File</SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => removeFormDataField(index)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <X className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={addFormDataField} className="text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Field
                    </Button>
                  </div>
                )}

                {body.type === 'binary' && (
                  <div className="space-y-4">
                    <input
                      type="file"
                      onChange={(e) => handleBinaryUpload(e.target.files?.[0] || null)}
                      className="hidden"
                      id="binary-file"
                    />
                    <label 
                      htmlFor="binary-file"
                      className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        {body.fileName ? body.fileName : 'Click to upload file'}
                      </span>
                    </label>
                    {body.fileName && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setBody({ type: 'binary', content: '', fileName: undefined })}
                        className="text-xs text-red-600"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Remove file
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="auth" className="mt-0 h-full">
              <div className="space-y-4">
                <Select value={auth.type} onValueChange={(v) => setAuth({ type: v as AuthConfig['type'] })}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No Auth</SelectItem>
                    <SelectItem value="basic" className="text-xs">Basic Auth</SelectItem>
                    <SelectItem value="bearer" className="text-xs">Bearer Token</SelectItem>
                    <SelectItem value="api-key" className="text-xs">API Key</SelectItem>
                  </SelectContent>
                </Select>

                {auth.type === 'basic' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Username"
                        value={auth.basic?.username || ''}
                        onChange={(e) => setAuth({ 
                          type: 'basic', 
                          basic: { ...auth.basic, username: e.target.value, password: auth.basic?.password || '' } 
                        })}
                        className="flex-1 text-xs h-8"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Password"
                        value={auth.basic?.password || ''}
                        onChange={(e) => setAuth({ 
                          type: 'basic', 
                          basic: { ...auth.basic, username: auth.basic?.username || '', password: e.target.value } 
                        })}
                        className="flex-1 text-xs h-8"
                      />
                    </div>
                  </div>
                )}

                {auth.type === 'bearer' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Token"
                        value={auth.bearer?.token || ''}
                        onChange={(e) => setAuth({ type: 'bearer', bearer: { token: e.target.value } })}
                        className="flex-1 text-xs h-8"
                      />
                    </div>
                  </div>
                )}

                {auth.type === 'api-key' && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Key"
                      value={auth.apiKey?.key || ''}
                      onChange={(e) => setAuth({ 
                        type: 'api-key', 
                        apiKey: { 
                          ...auth.apiKey, 
                          key: e.target.value, 
                          value: auth.apiKey?.value || '',
                          in: auth.apiKey?.in || 'header'
                        } 
                      })}
                      className="text-xs h-8"
                    />
                    <Input
                      placeholder="Value"
                      value={auth.apiKey?.value || ''}
                      onChange={(e) => setAuth({ 
                        type: 'api-key', 
                        apiKey: { 
                          ...auth.apiKey, 
                          key: auth.apiKey?.key || '', 
                          value: e.target.value,
                          in: auth.apiKey?.in || 'header'
                        } 
                      })}
                      className="text-xs h-8"
                    />
                    <Select 
                      value={auth.apiKey?.in || 'header'} 
                      onValueChange={(v) => setAuth({ 
                        type: 'api-key', 
                        apiKey: { 
                          ...auth.apiKey, 
                          key: auth.apiKey?.key || '', 
                          value: auth.apiKey?.value || '',
                          in: v as 'header' | 'query'
                        } 
                      })}
                    >
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header" className="text-xs">Header</SelectItem>
                        <SelectItem value="query" className="text-xs">Query Param</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Resize Handle - Drag to resize */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-4 bg-muted border-y-2 border-border flex items-center justify-center cursor-row-resize select-none transition-colors ${
          isDragging ? 'bg-primary/20 border-primary' : 'hover:bg-primary/10 hover:border-primary/50'
        }`}
      >
        <div className={`w-16 h-1.5 rounded-full transition-all ${isDragging ? 'w-24 h-2 bg-primary' : 'bg-muted-foreground/40'}`} />
      </div>

      {/* Response Section */}
      <div className="flex-1 flex flex-col bg-muted/20 overflow-hidden min-h-0">
        {response ? (
          <>
            {/* Response Status Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
              <div className="flex items-center gap-4">
                {/* Status Badge */}
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
                
                {/* Divider */}
                <div className="w-px h-4 bg-border" />
                
                {/* Time */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="font-mono">{response.time}ms</span>
                </div>
                
                {/* Size */}
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

            {/* Response Content */}
            <div className="flex-1 overflow-auto p-3">
              {responseTab === 'body' && (
                <div className="h-full flex flex-col">
                  {/* Response Toolbar */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/50">
                    <span className="text-xs text-muted-foreground">Response Body</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(formatResponseBody(response.body))
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
                      value={formatResponseBody(response.body)}
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

      {/* Alert Dialog */}
      <AlertDialog open={alertDialog.isOpen} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}