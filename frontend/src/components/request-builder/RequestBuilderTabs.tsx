import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MonacoEditor } from '@/components/ui/monaco-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthConfig, FormDataField, Header, QueryParam, RequestBody, Scripts } from '@/types'
import { Check, FileText, Key, Lock, Plus, Upload, User, X } from 'lucide-react'
import { useState } from 'react'

interface RequestBuilderTabsProps {
  headers: Header[]
  queryParams: QueryParam[]
  pathParams: QueryParam[]
  body: RequestBody
  auth: AuthConfig
  scripts: Scripts
  setBody: (body: RequestBody) => void
  setAuth: (auth: AuthConfig) => void
  setScripts: (scripts: Scripts) => void
  addHeader: () => void
  removeHeader: (index: number) => void
  updateHeader: (
    index: number,
    field: 'key' | 'value' | 'enabled',
    value: string | boolean
  ) => void
  addQueryParam: () => void
  removeQueryParam: (index: number) => void
  updateQueryParam: (
    index: number,
    field: 'key' | 'value' | 'enabled',
    value: string | boolean
  ) => void
  addPathParam: () => void
  removePathParam: (index: number) => void
  updatePathParam: (
    index: number,
    field: 'key' | 'value' | 'enabled',
    value: string | boolean
  ) => void
  addFormDataField: () => void
  removeFormDataField: (index: number) => void
  updateFormDataField: (
    index: number,
    field: keyof FormDataField,
    value: string | boolean
  ) => void
  handleFileUpload: (index: number, file: File | null) => void
  handleBinaryUpload: (file: File | null) => void
}

export function RequestBuilderTabs({
  headers,
  queryParams,
  pathParams,
  body,
  auth,
  scripts,
  setBody,
  setAuth,
  setScripts,
  addHeader,
  removeHeader,
  updateHeader,
  addQueryParam,
  removeQueryParam,
  updateQueryParam,
  addPathParam,
  removePathParam,
  updatePathParam,
  addFormDataField,
  removeFormDataField,
  updateFormDataField,
  handleFileUpload,
  handleBinaryUpload,
}: RequestBuilderTabsProps) {
  const [activeTab, setActiveTab] = useState('params')
  const [bodyLanguage, setBodyLanguage] = useState('plaintext')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
      <TabsList className="w-full justify-start rounded-none border-b border-border/70 bg-card/60 h-9 px-3">
        <TabsTrigger value="params" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          Params {(queryParams.filter(p => p.enabled).length + pathParams.filter(p => p.enabled).length) > 0 && `(${queryParams.filter(p => p.enabled).length + pathParams.filter(p => p.enabled).length})`}
        </TabsTrigger>
        <TabsTrigger value="headers" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          Headers {headers.filter(h => h.enabled).length > 0 && `(${headers.filter(h => h.enabled).length})`}
        </TabsTrigger>
        <TabsTrigger value="body" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          Body
        </TabsTrigger>
        <TabsTrigger value="auth" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          Auth {auth.type !== 'none' && '●'}
        </TabsTrigger>
        <TabsTrigger value="scripts" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent">
          Scripts
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-auto p-3">
        <TabsContent value="params" className="mt-0 h-full">
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-muted-foreground">Path Params</div>
            {pathParams.map((param, index) => (
              <div key={`path-${index}`} className="flex gap-2 items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updatePathParam(index, 'enabled', !param.enabled)}
                  className={`w-4 h-4 rounded border p-0 ${
                    param.enabled ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90' : 'border-gray-300 hover:bg-muted'
                  }`}
                >
                  {param.enabled && <Check className="h-3 w-3" />}
                </Button>
                <Input
                  placeholder="Path Key (e.g. customerId)"
                  value={param.key}
                  onChange={(e) => updatePathParam(index, 'key', e.target.value)}
                  className="flex-1 text-xs h-8"
                />
                <Input
                  placeholder="Value"
                  value={param.value}
                  onChange={(e) => updatePathParam(index, 'value', e.target.value)}
                  className="flex-1 text-xs h-8"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePathParam(index)}
                  className="h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addPathParam} className="text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Path Param
            </Button>

            <div className="text-[11px] font-medium text-muted-foreground pt-2">Query Params</div>
            {queryParams.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateQueryParam(index, 'enabled', !param.enabled)}
                  className={`w-4 h-4 rounded border p-0 ${
                    param.enabled ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90' : 'border-gray-300 hover:bg-muted'
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
              Add Query Param
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
                    header.enabled ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90' : 'border-gray-300 hover:bg-muted'
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

              {body.type === 'raw' && (
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
                  language={body.type === 'json' ? 'json' : bodyLanguage}
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
                        field.enabled ? 'bg-primary border-primary text-primary-foreground' : 'border-gray-300'
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
                        <label htmlFor={`file-${index}`} className="cursor-pointer text-primary hover:underline ml-auto">
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
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
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
                      basic: { ...auth.basic, username: e.target.value, password: auth.basic?.password || '' },
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
                      basic: { ...auth.basic, username: auth.basic?.username || '', password: e.target.value },
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
                      in: auth.apiKey?.in || 'header',
                    },
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
                      in: auth.apiKey?.in || 'header',
                    },
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
                      in: v as 'header' | 'query',
                    },
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

        <TabsContent value="scripts" className="mt-0 h-full data-[state=inactive]:hidden" forceMount>
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Language</span>
              <Select
                value={scripts.language}
                onValueChange={(v) =>
                  setScripts({
                    ...scripts,
                    language: v as Scripts['language'],
                  })
                }
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript" className="text-xs">JavaScript</SelectItem>
                  <SelectItem value="typescript" className="text-xs">TypeScript</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 flex-1 min-h-[260px]">
              <div className="border rounded overflow-hidden min-h-[120px] flex flex-col">
                <div className="text-[11px] px-2 py-1 border-b bg-muted/30 text-muted-foreground">Pre-request script</div>
                <div className="flex-1 min-h-[100px]">
                  <MonacoEditor
                    height="100%"
                    language={scripts.language}
                    value={scripts.preRequest}
                    onChange={(value) => setScripts({ ...scripts, preRequest: value })}
                  />
                </div>
              </div>
              <div className="border rounded overflow-hidden min-h-[120px] flex flex-col">
                <div className="text-[11px] px-2 py-1 border-b bg-muted/30 text-muted-foreground">Post-response script</div>
                <div className="flex-1 min-h-[100px]">
                  <MonacoEditor
                    height="100%"
                    language={scripts.language}
                    value={scripts.postResponse}
                    onChange={(value) => setScripts({ ...scripts, postResponse: value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  )
}
