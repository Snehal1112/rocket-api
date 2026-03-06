import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  HttpRequest,
  HttpResponse,
  HttpMethod,
  Header,
  QueryParam,
  RequestBody,
  AuthConfig,
  Scripts,
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
  updateActivePathParams: (params: QueryParam[]) => void
  updateActiveBody: (body: RequestBody) => void
  updateActiveAuth: (auth: AuthConfig) => void
  updateActiveScripts: (scripts: Scripts) => void

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

const TABS_SESSION_STORAGE_KEY = 'rocket-api:tabs-session:v1'

const createDefaultRequest = (): HttpRequest => ({
  id: Date.now().toString(),
  name: 'Untitled Request',
  method: 'GET',
  url: '',
  headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
  queryParams: [],
  pathParams: [],
  body: { type: 'none', content: '' },
  auth: { type: 'none' },
  scripts: { language: 'javascript', preRequest: '', postResponse: '' },
})

const serializePersistedRequest = (request: HttpRequest): string =>
  JSON.stringify({
    name: request.name,
    method: request.method,
    url: request.url,
    headers: request.headers,
    queryParams: request.queryParams,
    pathParams: request.pathParams ?? [],
    body: request.body,
    auth: request.auth,
    scripts: request.scripts ?? { language: 'javascript', preRequest: '', postResponse: '' },
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

const createInitialSession = () => {
  const initialTab = createTab()
  return {
    tabs: [initialTab] as Tab[],
    activeTabId: initialTab.id,
  }
}

const normalizeSession = (
  persisted?: Partial<Pick<TabsState, 'tabs' | 'activeTabId'>>
): Pick<TabsState, 'tabs' | 'activeTabId'> => {
  if (!persisted?.tabs || persisted.tabs.length === 0) {
    return createInitialSession()
  }

  const tabs = persisted.tabs
  const activeTabId = persisted.activeTabId
  const validActiveId =
    activeTabId && tabs.some(tab => tab.id === activeTabId)
      ? activeTabId
      : tabs[0].id

  return {
    tabs,
    activeTabId: validActiveId,
  }
}

const loadVersionByTabId = new Map<string, number>()

const bumpLoadVersion = (tabId: string): number => {
  const nextVersion = (loadVersionByTabId.get(tabId) ?? 0) + 1
  loadVersionByTabId.set(tabId, nextVersion)
  return nextVersion
}

const isLatestLoadVersion = (tabId: string, version: number): boolean =>
  loadVersionByTabId.get(tabId) === version

export const sanitizeTabsForPersistence = (tabs: Tab[]): Tab[] =>
  tabs.map(tab =>
    tab.kind === 'request'
      ? {
          ...tab,
          response: null,
          isLoading: false,
        }
      : tab
  )

export const toPersistedTabsSession = (
  state: Pick<TabsState, 'tabs' | 'activeTabId'>
): Pick<TabsState, 'tabs' | 'activeTabId'> => ({
  tabs: sanitizeTabsForPersistence(state.tabs),
  activeTabId: state.activeTabId,
})

export const useTabsStore = create<TabsState>()(
  persist((set, get) => {
  const initialSession = createInitialSession()
  const loadRequestIntoTab = (
    tabId: string,
    request: HttpRequest,
    collectionName?: string,
    filePath?: string
  ) =>
    set(state => ({
      tabs: state.tabs.map(t =>
        t.id === tabId && t.kind === 'request'
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
    }))
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
    tabs: initialSession.tabs,
    activeTabId: initialSession.activeTabId,

    newTab: () => {
      const tab = createTab()
      set(state => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))
    },

    closeTab: (id) => {
      const { tabs } = get()

      if (tabs.length === 1) {
        // Keep a fresh tab when closing the last one.
        const fresh = createTab()
        loadVersionByTabId.clear()
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

      loadVersionByTabId.delete(id)
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

    updateActivePathParams: (pathParams) =>
      updateActiveRequest(request => ({ ...request, pathParams })),

    updateActiveBody: (body) =>
      updateActiveRequest(request => ({ ...request, body })),

    updateActiveAuth: (auth) =>
      updateActiveRequest(request => ({ ...request, auth })),

    updateActiveScripts: (scripts) =>
      updateActiveRequest(request => ({ ...request, scripts })),

    loadRequestInActiveTab: (request, collectionName?, filePath?) =>
      loadRequestIntoTab(get().activeTabId, request, collectionName, filePath),

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
          pathParams: (req.pathParams ?? []).map(p => ({ key: p.key, value: p.value, enabled: p.enabled })),
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
        scripts: req.scripts ?? { language: 'javascript', preRequest: '', postResponse: '' },
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

      // If this request is already open, just focus that tab.
      const existingTab = tabs.find(
        t =>
          t.kind === 'request' &&
          t.collectionName === collectionName &&
          t.filePath === path
      )
      if (existingTab && existingTab.kind === 'request') {
        set({ activeTabId: existingTab.id })
        return
      }

      // Always open non-open requests in a new request tab.
      const tab = createTab()
      const targetTabId = tab.id
      set(state => ({ tabs: [...state.tabs, tab], activeTabId: targetTabId }))
      const loadVersion = bumpLoadVersion(targetTabId)

      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === targetTabId && t.kind === 'request' ? { ...t, isLoading: true } : t
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
          headers: bruFile.http.headers.map((h: { key: string; value: string; enabled?: boolean }) => ({
            key: h.key,
            value: h.value,
            enabled: h.enabled ?? true,
          })),
          queryParams:
            bruFile.http.queryParams?.map(
              (q: { key: string; value: string; enabled: boolean }) => ({
                key: q.key,
                value: q.value,
                enabled: q.enabled,
              })
            ) ?? [],
          pathParams:
            bruFile.http.pathParams?.map(
              (p: { key: string; value: string; enabled: boolean }) => ({
                key: p.key,
                value: p.value,
                enabled: p.enabled,
              })
            ) ?? [],
          body: {
            type: bruFile.body.type ?? 'none',
            content: bruFile.body.data ?? '',
            formData: bruFile.body.formData,
            fileName: bruFile.body.fileName,
          },
          auth: bruFile.http.auth ?? { type: 'none' },
          scripts: {
            language: bruFile.scripts?.language ?? 'javascript',
            preRequest: bruFile.scripts?.preRequest ?? '',
            postResponse: bruFile.scripts?.postResponse ?? '',
          },
        }

        if (!isLatestLoadVersion(targetTabId, loadVersion)) return
        loadRequestIntoTab(targetTabId, request, collectionName, path)
      } catch (err) {
        console.error('Failed to load request from path:', path, err)
      } finally {
        if (isLatestLoadVersion(targetTabId, loadVersion)) {
          set(state => ({
            tabs: state.tabs.map(t =>
              t.id === targetTabId && t.kind === 'request' ? { ...t, isLoading: false } : t
            ),
          }))
          loadVersionByTabId.delete(targetTabId)
        }
      }
    },
  }
},
{
  name: TABS_SESSION_STORAGE_KEY,
  partialize: (state) => toPersistedTabsSession(state),
  merge: (persistedState, currentState) => ({
    ...currentState,
    ...normalizeSession(persistedState as Partial<Pick<TabsState, 'tabs' | 'activeTabId'>>),
  }),
})
)
