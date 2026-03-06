import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AuthConfig,
  FormDataField,
  Header,
  HttpMethod,
  HttpRequest,
  HttpResponse,
  QueryParam,
  RequestBody,
  Scripts,
} from '@/types'
import { useTabsStore } from '@/store/tabs-store'
import { useCollectionsStore } from '@/store/collections'
import { substituteRequestVariables } from '@/lib/environment'
import { applyApiKeyToQueryParams } from '@/lib/request-auth'
import { apiService } from '@/lib/api'
import { mockApiService } from '@/lib/mock-api'
import { useHistoryStore } from '@/store/history'

interface RequestBuilderStateOptions {
  onRequestSent?: (request: HttpRequest, response: HttpResponse) => void
}

interface AlertDialogState {
  isOpen: boolean
  title: string
  description: string
}

export function useRequestBuilderState({ onRequestSent }: RequestBuilderStateOptions) {
  const [requestHeight, setRequestHeight] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    isOpen: false,
    title: '',
    description: '',
  })

  const [envDialogOpen, setEnvDialogOpen] = useState(false)

  const {
    tabs,
    activeTabId,
    updateActiveName,
    updateActiveMethod,
    updateActiveUrl,
    updateActiveHeaders,
    updateActiveQueryParams,
    updateActivePathParams,
    updateActiveBody,
    updateActiveAuth,
    updateActiveScripts,
    setActiveTabResponse,
    setActiveTabLoading,
    saveActiveTab,
  } = useTabsStore()

  const {
    activeCollection,
    environments,
    activeEnvironment,
    collectionVariables,
    setActiveEnvironment,
  } = useCollectionsStore()

  const activeTab_ = tabs.find(t => t.id === activeTabId)
  const currentRequest = activeTab_?.kind === 'request' ? activeTab_.request : undefined
  const isDirty = activeTab_?.kind === 'request' ? activeTab_.isDirty : false
  const isLoading = activeTab_?.kind === 'request' ? activeTab_.isLoading : false
  const response = activeTab_?.kind === 'request' ? activeTab_.response : null

  const [name, setName] = useState('Untitled Request')
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<Header[]>([])
  const [queryParams, setQueryParams] = useState<QueryParam[]>([])
  const [pathParams, setPathParams] = useState<QueryParam[]>([])
  const [body, setBody] = useState<RequestBody>({ type: 'none', content: '' })
  const [auth, setAuth] = useState<AuthConfig>({ type: 'none' })
  const [scripts, setScripts] = useState<Scripts>({
    language: 'javascript',
    preRequest: '',
    postResponse: '',
  })

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

  useLayoutEffect(() => {
    if (currentRequest) {
      setName(currentRequest.name)
      setMethod(currentRequest.method)
      setUrl(currentRequest.url)
      setHeaders(currentRequest.headers)
      setQueryParams(currentRequest.queryParams)
      setPathParams(currentRequest.pathParams ?? [])
      setBody(currentRequest.body)
      setAuth(currentRequest.auth)
      setScripts(currentRequest.scripts ?? { language: 'javascript', preRequest: '', postResponse: '' })
    }
  }, [currentRequest, activeTabId])

  const handleSaveRequest = useCallback(async () => {
    if (!activeCollection) {
      setAlertDialog({
        isOpen: true,
        title: 'No Collection Selected',
        description: 'Please select a collection first before saving a request.',
      })
      return
    }

    updateActiveName(name)
    updateActiveMethod(method)
    updateActiveUrl(url)
    updateActiveHeaders(headers)
    updateActiveQueryParams(queryParams)
    updateActivePathParams(pathParams)
    updateActiveBody(body)
    updateActiveAuth(auth)
    updateActiveScripts(scripts)

    await saveActiveTab(activeCollection.name)
    useCollectionsStore.getState().fetchCollectionTree(activeCollection.name)
  }, [
    activeCollection,
    name,
    method,
    url,
    headers,
    queryParams,
    setQueryParams,
    pathParams,
    setPathParams,
    body,
    auth,
    scripts,
    updateActiveName,
    updateActiveMethod,
    updateActiveUrl,
    updateActiveHeaders,
    updateActiveQueryParams,
    updateActivePathParams,
    updateActiveBody,
    updateActiveAuth,
    updateActiveScripts,
    saveActiveTab,
  ])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!url.trim()) return

    updateActiveMethod(method)
    updateActiveUrl(url)
    updateActiveHeaders(headers)
    updateActiveQueryParams(queryParams)
    updateActivePathParams(pathParams)
    updateActiveBody(body)
    updateActiveAuth(auth)
    updateActiveScripts(scripts)

    const applyPathParamsToUrl = (inputUrl: string): string => {
      let output = inputUrl
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      for (const param of pathParams) {
        if (!param.enabled || !param.key) continue
        output = output.replace(new RegExp(`:${escapeRegExp(param.key)}\\b`, 'g'), param.value)
      }
      return output
    }

    const { activeEnvironment, collectionVariables } = useCollectionsStore.getState()
    const substituted = substituteRequestVariables(
      applyPathParamsToUrl(url),
      headers,
      body.content,
      activeEnvironment,
      collectionVariables
    )

    setActiveTabLoading(true)

    try {
      const finalHeaders = [...substituted.headers]

      if (auth.type === 'bearer' && auth.bearer?.token) {
        finalHeaders.push({ key: 'Authorization', value: `Bearer ${auth.bearer.token}`, enabled: true })
      } else if (auth.type === 'basic' && auth.basic?.username) {
        const credentials = btoa(`${auth.basic.username}:${auth.basic.password}`)
        finalHeaders.push({ key: 'Authorization', value: `Basic ${credentials}`, enabled: true })
      } else if (auth.type === 'api-key' && auth.apiKey?.key && auth.apiKey?.value) {
        if (auth.apiKey.in === 'header') {
          finalHeaders.push({ key: auth.apiKey.key, value: auth.apiKey.value, enabled: true })
        }
      }

      const finalQueryParams = applyApiKeyToQueryParams(queryParams.filter(q => q.enabled), auth)

      const request: HttpRequest = {
        id: Date.now().toString(),
        name: 'Untitled Request',
        method,
        url: substituted.url,
        headers: finalHeaders.filter(h => h.enabled),
        body: { ...body, content: substituted.body },
        queryParams: finalQueryParams,
        pathParams,
        auth,
        scripts,
      }

      let httpResponse: HttpResponse
      let usedMockService = false

      try {
        httpResponse = await apiService.sendRequest(request)
      } catch {
        httpResponse = await mockApiService.sendRequest(request)
        usedMockService = true
      }

      if (usedMockService) {
        httpResponse.headers = {
          ...httpResponse.headers,
          'X-Rocket-Mock': 'true',
        }
      }

      setActiveTabResponse(httpResponse)
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
        time: 0,
      })
    } finally {
      setActiveTabLoading(false)
    }
  }, [
    url,
    method,
    headers,
    queryParams,
    setQueryParams,
    pathParams,
    setPathParams,
    body,
    auth,
    scripts,
    onRequestSent,
    updateActiveMethod,
    updateActiveUrl,
    updateActiveHeaders,
    updateActiveQueryParams,
    updateActivePathParams,
    updateActiveBody,
    updateActiveAuth,
    updateActiveScripts,
    setActiveTabLoading,
    setActiveTabResponse,
  ])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (url.trim()) handleSubmit()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveRequest()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [url, handleSubmit, handleSaveRequest])

  const addHeader = () => setHeaders([...headers, { key: '', value: '', enabled: true }])
  const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index))
  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newHeaders = headers.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    setHeaders(newHeaders)
  }

  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '', enabled: true }])
  const removeQueryParam = (index: number) => setQueryParams(queryParams.filter((_, i) => i !== index))
  const updateQueryParam = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newParams = queryParams.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    setQueryParams(newParams)
  }

  const addPathParam = () => setPathParams([...pathParams, { key: '', value: '', enabled: true }])
  const removePathParam = (index: number) => setPathParams(pathParams.filter((_, i) => i !== index))
  const updatePathParam = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newParams = pathParams.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    setPathParams(newParams)
  }

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

  const handleFileUpload = (index: number, file: File | null) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      updateFormDataField(index, 'fileName', file.name)
      updateFormDataField(index, 'fileContent', content.split(',')[1])
      updateFormDataField(index, 'value', file.name)
    }
    reader.readAsDataURL(file)
  }

  const handleBinaryUpload = (file: File | null) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setBody({
        type: 'binary',
        content: content.split(',')[1],
        fileName: file.name,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleSaveUrlVariable = useCallback(async (name: string, nextValue: string) => {
    const { activeCollection, activeEnvironment, environments, collectionVariables } = useCollectionsStore.getState()
    if (!activeCollection) return

    const envMatch = activeEnvironment?.variables.find(v => v.key === name)
    if (activeEnvironment && envMatch) {
      const updatedEnv = {
        ...activeEnvironment,
        variables: activeEnvironment.variables.map(v =>
          v.key === name ? { ...v, value: nextValue, enabled: true } : v
        ),
      }
      await useCollectionsStore.getState().saveEnvironment(activeCollection.name, updatedEnv)
      const refreshedEnv = environments.find(e => e.name === activeEnvironment.name) ?? updatedEnv
      useCollectionsStore.getState().setActiveEnvironment(refreshedEnv)
      return
    }

    const collectionMatch = collectionVariables.find(v => v.key === name)
    if (collectionMatch) {
      const updatedCollectionVars = collectionVariables.map(v =>
        v.key === name ? { ...v, value: nextValue, enabled: true } : v
      )
      await useCollectionsStore.getState().saveCollectionVariables(activeCollection.name, updatedCollectionVars)
      return
    }

    if (activeEnvironment) {
      const updatedEnv = {
        ...activeEnvironment,
        variables: [
          ...activeEnvironment.variables,
          { key: name, value: nextValue, enabled: true, secret: false },
        ],
      }
      await useCollectionsStore.getState().saveEnvironment(activeCollection.name, updatedEnv)
      const refreshedEnv = useCollectionsStore
        .getState()
        .environments.find(e => e.name === activeEnvironment.name) ?? updatedEnv
      useCollectionsStore.getState().setActiveEnvironment(refreshedEnv)
      return
    }

    await useCollectionsStore
      .getState()
      .saveCollectionVariables(activeCollection.name, [
        ...collectionVariables,
        { key: name, value: nextValue, enabled: true, secret: false },
      ])
  }, [])

  return {
    containerRef,
    requestHeight,
    isDragging,
    handleMouseDown,

    alertDialog,
    setAlertDialog,

    envDialogOpen,
    setEnvDialogOpen,

    activeCollection,
    environments,
    activeEnvironment,
    collectionVariables,
    setActiveEnvironment,

    name,
    setName,
    method,
    setMethod,
    url,
    setUrl,
    headers,
    queryParams,
    setQueryParams,
    pathParams,
    setPathParams,
    body,
    auth,
    scripts,
    setBody,
    setAuth,
    setScripts,

    isDirty,
    isLoading,
    response,

    handleSubmit,
    handleSaveRequest,
    handleSaveUrlVariable,
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
    updateActiveName,
  }
}
