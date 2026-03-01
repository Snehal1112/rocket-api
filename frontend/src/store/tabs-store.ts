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

export interface Tab {
  id: string
  request: HttpRequest
  response: HttpResponse | null
  isDirty: boolean
  isLoading: boolean
  collectionName?: string
  filePath?: string
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  newTab: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void

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

const createTab = (request?: HttpRequest): Tab => ({
  id: crypto.randomUUID(),
  request: request ?? createDefaultRequest(),
  response: null,
  isDirty: false,
  isLoading: false,
})

export const useTabsStore = create<TabsState>((set, get) => {
  const initialTab = createTab()

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

    updateActiveMethod: (method) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId
            ? { ...t, request: { ...t.request, method }, isDirty: true }
            : t
        ),
      })),

    updateActiveUrl: (url) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId
            ? { ...t, request: { ...t.request, url }, isDirty: true }
            : t
        ),
      })),

    updateActiveHeaders: (headers) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId
            ? { ...t, request: { ...t.request, headers }, isDirty: true }
            : t
        ),
      })),

    updateActiveQueryParams: (queryParams) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId
            ? { ...t, request: { ...t.request, queryParams }, isDirty: true }
            : t
        ),
      })),

    updateActiveBody: (body) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId
            ? { ...t, request: { ...t.request, body }, isDirty: true }
            : t
        ),
      })),

    updateActiveAuth: (auth) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId
            ? { ...t, request: { ...t.request, auth }, isDirty: true }
            : t
        ),
      })),

    loadRequestInActiveTab: (request, collectionName?, filePath?) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId
            ? {
                ...t,
                request: { ...request, id: Date.now().toString() },
                response: null,
                isDirty: false,
                collectionName,
                filePath,
              }
            : t
        ),
      })),

    setActiveTabResponse: (response) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId ? { ...t, response } : t
        ),
      })),

    setActiveTabLoading: (isLoading) =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId ? { ...t, isLoading } : t
        ),
      })),

    markActiveTabSaved: () =>
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === state.activeTabId ? { ...t, isDirty: false } : t
        ),
      })),

    saveActiveTab: async (collectionName, path?) => {
      const { tabs, activeTabId, markActiveTabSaved } = get()
      const activeTab = tabs.find(t => t.id === activeTabId)
      if (!activeTab) return

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
      await apiService.saveRequest(collectionName, path, bruFile)
      markActiveTabSaved()
    },

    loadRequestFromPath: async (collectionName, path) => {
      const { activeTabId } = get()

      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === activeTabId ? { ...t, isLoading: true } : t
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
      } finally {
        set(state => ({
          tabs: state.tabs.map(t =>
            t.id === activeTabId ? { ...t, isLoading: false } : t
          ),
        }))
      }
    },
  }
})
