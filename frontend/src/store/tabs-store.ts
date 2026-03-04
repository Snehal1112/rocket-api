import { create } from 'zustand'
import {
  HttpRequest,
  HttpResponse,
  HttpMethod,
  Header,
  QueryParam,
  RequestBody,
  AuthConfig,
} from '@/types'

export interface RequestTab {
  kind: 'request'
  id: string
  request: HttpRequest
  response: HttpResponse | null
  isDirty: boolean
  isLoading: boolean
  lastSavedSnapshot?: string
  collectionName?: string
  filePath?: string
}

export interface CollectionOverviewTab {
  kind: 'collection-overview'
  id: string
  collectionName: string
}

export type Tab = RequestTab | CollectionOverviewTab

export function isRequestTab(tab: Tab): tab is RequestTab {
  return tab.kind === 'request'
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  newTab: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  openCollectionOverview: (collectionName: string) => void

  updateActiveName: (name: string) => void
  updateActiveMethod: (method: HttpMethod) => void
  updateActiveUrl: (url: string) => void
  updateActiveHeaders: (headers: Header[]) => void
  updateActiveQueryParams: (params: QueryParam[]) => void
  updateActiveBody: (body: RequestBody) => void
  updateActiveAuth: (auth: AuthConfig) => void

  loadRequestInActiveTab: (
    request: HttpRequest,
    collectionName?: string,
    filePath?: string
  ) => void

  setActiveTabResponse: (response: HttpResponse | null) => void
  setActiveTabLoading: (loading: boolean) => void
  markActiveTabSaved: () => void

  saveActiveTab: (collectionName: string, path?: string) => Promise<void>
  loadRequestFromPath: (collectionName: string, path: string) => Promise<void>
}

const createDefaultRequest = (): HttpRequest => ({
  id: Date.now().toString(),
  name: 'Untitled Request',
  method: 'GET',
  url: '',
  headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
  queryParams: [],
  body: { type: 'none', content: '' },
  auth: { type: 'none' },
})

const serializePersistedRequest = (request: HttpRequest): string =>
  JSON.stringify({
    name: request.name,
    method: request.method,
    url: request.url,
    headers: request.headers,
    queryParams: request.queryParams,
    body: request.body,
    auth: request.auth,
  })

const createTab = (request?: HttpRequest): RequestTab => {
  const req = request ?? createDefaultRequest()
  return {
    kind: 'request',
    id: crypto.randomUUID(),
    request: req,
    response: null,
    isDirty: false,
    isLoading: false,
    lastSavedSnapshot: serializePersistedRequest(req),
  }
}

export const useTabsStore = create<TabsState>((set, get) => {
  const initialTab = createTab()
  const updateActiveRequest = (updater: (request: HttpRequest) => HttpRequest) =>
    set(state => ({
      tabs: state.tabs.map(t => {
        if (t.id !== state.activeTabId || t.kind !== 'request') return t

        const nextRequest = updater(t.request)
        const previousSnapshot = serializePersistedRequest(t.request)
        const nextSnapshot = serializePersistedRequest(nextRequest)

        if (nextSnapshot === previousSnapshot) {
          return t
        }

        const baseline = t.lastSavedSnapshot ?? previousSnapshot
        return {
          ...t,
          request: nextRequest,
          isDirty: nextSnapshot !== baseline,
        }
      }),
    }))

  return {
    tabs: [initialTab],
    activeTabId: initialTab.id,

    newTab: () => {
      const tab = createTab()
      set(state => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))
    },

    closeTab: (id) => {
      const { tabs } = get()

      if (tabs.length === 1) {
        // Keep a fresh tab when closing the last one.
        const fresh = createTab()
        set({ tabs: [fresh], activeTabId: fresh.id })
        return
      }

      const idx = tabs.findIndex(t => t.id === id)
      const newTabs = tabs.filter(t => t.id !== id)
      const currentActiveId = get().activeTabId
      const newActiveId =
        currentActiveId === id
          ? newTabs[Math.max(0, idx - 1)].id
          : currentActiveId

      set({ tabs: newTabs, activeTabId: newActiveId })
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    openCollectionOverview: (collectionName: string) => {
      const { tabs } = get()
      const existing = tabs.find(
        (t): t is CollectionOverviewTab =>
          t.kind === 'collection-overview' && t.collectionName === collectionName
      )
      if (existing) {
        set({ activeTabId: existing.id })
        return
      }
      const tab: CollectionOverviewTab = {
        kind: 'collection-overview',
        id: crypto.randomUUID(),
        collectionName,
      }
      set(state => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))
    },

    updateActiveName: (name) =>
      updateActiveRequest(request => ({ ...request, name })),

    updateActiveMethod: (method) =>
      updateActiveRequest(request => ({ ...request, method })),

    updateActiveUrl: (url) =>
      updateActiveRequest(request => ({ ...request, url })),

    updateActiveHeaders: (headers) =>
      updateActiveRequest(request => ({ ...request, headers })),

    updateActiveQueryParams: (queryParams) =>
      updateActiveRequest(request => ({ ...request, queryParams })),

    updateActiveBody: (body) =>
      updateActiveRequest(request => ({ ...request, body })),

    updateActiveAuth: (auth) =>
      updateActiveRequest(request => ({ ...request, auth })),

    loadRequestInActiveTab: (request, collectionName?, filePath?) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId && t.kind === 'request'
            ? {
                ...t,
                // Use a stable UUID so the RequestBuilder useEffect always fires,
                // even when the fetch completes within the same millisecond as tab creation.
                request: { ...request, id: crypto.randomUUID() },
                response: null,
                isDirty: false,
                lastSavedSnapshot: serializePersistedRequest(request),
                collectionName,
                filePath,
              }
            : t
        ),
      })),

    setActiveTabResponse: (response) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId && t.kind === 'request' ? { ...t, response } : t
        ),
      })),

    setActiveTabLoading: (isLoading) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId && t.kind === 'request' ? { ...t, isLoading } : t
        ),
      })),

    markActiveTabSaved: () =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId && t.kind === 'request'
            ? {
                ...t,
                isDirty: false,
                lastSavedSnapshot: serializePersistedRequest(t.request),
              }
            : t
        ),
      })),

    saveActiveTab: async (collectionName, path?) => {
      const { tabs, activeTabId } = get()
      const activeTab = tabs.find(t => t.id === activeTabId)
      if (!activeTab || activeTab.kind !== 'request') return

      const req = activeTab.request
      const bruFile = {
        meta: { name: req.name, type: 'http' as const, seq: 1 },
        http: {
          method: req.method,
          url: req.url,
          headers: req.headers
            .filter(h => h.enabled)
            .map(h => ({ key: h.key, value: h.value })),
          queryParams: req.queryParams
            .filter(q => q.enabled)
            .map(q => ({ key: q.key, value: q.value, enabled: q.enabled })),
          auth:
            req.auth.type !== 'none'
              ? {
                  type: req.auth.type,
                  basic: req.auth.basic,
                  bearer: req.auth.bearer,
                  apiKey: req.auth.apiKey,
                }
              : undefined,
        },
        body: {
          type: req.body.type,
          data: req.body.content,
          formData: req.body.formData,
          fileName: req.body.fileName,
        },
      }

      const { apiService } = await import('@/lib/api')
      const effectivePath = path ?? activeTab.filePath
      const savedSnapshot = serializePersistedRequest(req)
      const result = await apiService.saveRequest(collectionName, effectivePath, bruFile)
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === activeTabId
            ? (() => {
                if (t.kind !== 'request') return t
                const latestSnapshot = serializePersistedRequest(t.request)
                return {
                  ...t,
                  isDirty: latestSnapshot !== savedSnapshot,
                  lastSavedSnapshot: savedSnapshot,
                  filePath: result.path,
                  collectionName,
                }
              })()
            : t
        ),
      }))
    },

    loadRequestFromPath: async (collectionName, path) => {
      const { tabs } = get()
      let { activeTabId } = get()

      // If the active tab is a collection overview, open a new request tab instead.
      if (!tabs.find(t => t.id === activeTabId && t.kind === 'request')) {
        const tab = createTab()
        set(state => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))
        activeTabId = tab.id
      }

      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === activeTabId && t.kind === 'request' ? { ...t, isLoading: true } : t
        ),
      }))

      try {
        const { apiService } = await import('@/lib/api')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bruFile = (await apiService.getRequest(collectionName, path)) as any

        const request: HttpRequest = {
          id: Date.now().toString(),
          name: bruFile.meta.name,
          method: bruFile.http.method,
          url: bruFile.http.url,
          headers: bruFile.http.headers.map((h: { key: string; value: string }) => ({
            key: h.key,
            value: h.value,
            enabled: true,
          })),
          queryParams:
            bruFile.http.queryParams?.map(
              (q: { key: string; value: string; enabled: boolean }) => ({
                key: q.key,
                value: q.value,
                enabled: q.enabled,
              })
            ) ?? [],
          body: {
            type: bruFile.body.type ?? 'none',
            content: bruFile.body.data ?? '',
            formData: bruFile.body.formData,
            fileName: bruFile.body.fileName,
          },
          auth: bruFile.http.auth ?? { type: 'none' },
        }

        get().loadRequestInActiveTab(request, collectionName, path)
      } catch (err) {
        console.error('Failed to load request from path:', path, err)
      } finally {
        // Use get() to capture the tab id that was actually loaded into.
        const loadedTabId = get().activeTabId
        set(state => ({
          tabs: state.tabs.map(t =>
            t.id === loadedTabId && t.kind === 'request' ? { ...t, isLoading: false } : t
          ),
        }))
      }
    },
  }
})
