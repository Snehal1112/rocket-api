# Request Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a tabbed interface to the center panel so multiple requests can be open simultaneously, each with independent state.

**Architecture:** Replace the single `useRequestStore` with a `useTabsStore` that holds an array of `Tab` objects. Each tab owns its `request`, `response`, `isDirty`, and `isLoading`. A new `RequestTabs` bar component sits above `RequestBuilder`. `RequestBuilder` reads from the active tab instead of the old store.

**Tech Stack:** React 19, TypeScript, Zustand, shadcn/ui (`AlertDialog`, `Button`), lucide-react (`Plus`, `X`).

---

### Task 1: Create `useTabsStore`

**Files:**
- Create: `frontend/src/store/tabs-store.ts`

**Step 1: Create the file with this exact content**

```typescript
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
      const newActiveId =
        get().activeTabId === id
          ? newTabs[Math.max(0, idx - 1)].id
          : get().activeTabId

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
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend && yarn tsc --noEmit
```

Expected: no errors related to `tabs-store.ts`.

**Step 3: Commit**

```bash
git add frontend/src/store/tabs-store.ts
git commit -m "feat(tabs): add useTabsStore replacing useRequestStore"
```

---

### Task 2: Create `RequestTabs` component

**Files:**
- Create: `frontend/src/components/request-builder/RequestTabs.tsx`

**Step 1: Create the file with this exact content**

```tsx
import { useState } from 'react'
import { useTabsStore } from '@/store/tabs-store'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, X } from 'lucide-react'
import type { HttpMethod } from '@/types'

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-blue-600',
  POST: 'text-green-600',
  PUT: 'text-yellow-600',
  DELETE: 'text-red-600',
  PATCH: 'text-purple-600',
  HEAD: 'text-gray-500',
  OPTIONS: 'text-gray-500',
}

export function RequestTabs() {
  const { tabs, activeTabId, newTab, closeTab, setActiveTab } = useTabsStore()
  const [closeCandidate, setCloseCandidate] = useState<string | null>(null)

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    const tab = tabs.find(t => t.id === tabId)
    if (tab?.isDirty) {
      setCloseCandidate(tabId)
    } else {
      closeTab(tabId)
    }
  }

  const confirmClose = () => {
    if (closeCandidate) {
      closeTab(closeCandidate)
      setCloseCandidate(null)
    }
  }

  const candidateTab = tabs.find(t => t.id === closeCandidate)

  return (
    <>
      <div className="flex items-center border-b border-border bg-muted/20 overflow-x-auto shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border shrink-0 max-w-[180px] group transition-colors ${
              tab.id === activeTabId
                ? 'bg-background border-b-2 border-b-orange-500 -mb-px'
                : 'hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            <span
              className={`font-semibold text-[10px] shrink-0 ${METHOD_COLORS[tab.request.method]}`}
            >
              {tab.request.method}
            </span>
            <span className="truncate">{tab.request.name}</span>
            {tab.isDirty && (
              <span className="text-orange-500 shrink-0 text-[10px]" title="Unsaved changes">
                ●
              </span>
            )}
            <span
              role="button"
              aria-label="Close tab"
              onClick={e => handleClose(e, tab.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}

        <Button
          variant="ghost"
          size="icon"
          onClick={newTab}
          className="h-8 w-8 shrink-0 rounded-none"
          title="New tab (Ctrl+T)"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog
        open={!!closeCandidate}
        onOpenChange={open => !open && setCloseCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{candidateTab?.request.name}</strong> has unsaved changes
              that will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add frontend/src/components/request-builder/RequestTabs.tsx
git commit -m "feat(tabs): add RequestTabs bar component"
```

---

### Task 3: Update `RequestBuilder` to use `useTabsStore`

**Files:**
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx`

This task has 5 targeted edits. Apply them in order.

**Edit 1 — Replace the store import (line 9)**

Remove:
```typescript
import { useRequestStore } from '@/store/request-store'
```
Add:
```typescript
import { useTabsStore } from '@/store/tabs-store'
```

**Edit 2 — Replace the store destructure block (lines 96–106)**

Remove:
```typescript
  // Request store
  const {
    currentRequest,
    isDirty,
    updateMethod,
    updateUrl,
    updateHeaders,
    updateQueryParams,
    updateBody,
    updateAuth,
    saveRequest
  } = useRequestStore()
```
Add:
```typescript
  // Tabs store — reads from the active tab.
  const {
    tabs,
    activeTabId,
    updateActiveMethod,
    updateActiveUrl,
    updateActiveHeaders,
    updateActiveQueryParams,
    updateActiveBody,
    updateActiveAuth,
    saveActiveTab,
    setActiveTabResponse,
    setActiveTabLoading,
  } = useTabsStore()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const currentRequest = activeTab?.request ?? null
  const isDirty = activeTab?.isDirty ?? false
```

**Edit 3 — Remove local `isLoading` and `response` state, replace with derived values**

Remove these two lines near the top of the component (around lines 43–44):
```typescript
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<HttpResponse | null>(null)
```
Add after the tabs store block instead:
```typescript
  const isLoading = activeTab?.isLoading ?? false
  const response = activeTab?.response ?? null
```

**Edit 4 — Replace `setIsLoading` / `setResponse` / `saveRequest` / update function calls in `handleSubmit` and `handleSaveRequest`**

In `handleSubmit`, replace:
```typescript
    setIsLoading(true)
```
With:
```typescript
    setActiveTabLoading(true)
```

Replace:
```typescript
      setResponse(response)
```
With:
```typescript
      setActiveTabResponse(response)
```

Replace:
```typescript
      setResponse({
```
With:
```typescript
      setActiveTabResponse({
```

Replace:
```typescript
    } finally {
      setIsLoading(false)
    }
```
With:
```typescript
    } finally {
      setActiveTabLoading(false)
    }
```

Replace in both `handleSubmit` and `handleSaveRequest` every update call:
```typescript
    updateMethod(method)
    updateUrl(url)
    updateHeaders(headers)
    updateQueryParams(queryParams)
    updateBody(body)
    updateAuth(auth)
```
With:
```typescript
    updateActiveMethod(method)
    updateActiveUrl(url)
    updateActiveHeaders(headers)
    updateActiveQueryParams(queryParams)
    updateActiveBody(body)
    updateActiveAuth(auth)
```

In `handleSaveRequest`, replace:
```typescript
    await saveRequest(activeCollection.name)
```
With:
```typescript
    await saveActiveTab(activeCollection.name)
```

**Edit 5 — Fix the sync `useEffect` dependency (line ~129)**

The existing effect already uses `[currentRequest?.id]` as dependency — no change needed. This still works because `currentRequest` now comes from the active tab, and when the active tab switches to a different request, `currentRequest.id` changes, triggering the sync.

**Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors in `RequestBuilder.tsx`.

**Step 3: Commit**

```bash
git add frontend/src/components/request-builder/RequestBuilder.tsx
git commit -m "feat(tabs): update RequestBuilder to use useTabsStore"
```

---

### Task 4: Update `CollectionsSidebar` to use `useTabsStore`

**Files:**
- Modify: `frontend/src/components/collections/CollectionsSidebar.tsx`

There are 3 places that call `useRequestStore`. Replace all of them.

**Edit 1 — Replace the import (line 3)**

Remove:
```typescript
import { useRequestStore } from '@/store/request-store'
```
Add:
```typescript
import { useTabsStore } from '@/store/tabs-store'
```

**Edit 2 — Replace the store hook call (line 101)**

Remove:
```typescript
  const { loadRequestFromPath } = useRequestStore()
```
Add:
```typescript
  const { loadRequestFromPath } = useTabsStore()
```

**Edit 3 — Replace `handleUseTemplate` store call (around line 187)**

Remove:
```typescript
    const { loadRequest } = useRequestStore.getState()
    loadRequest({
```
Add:
```typescript
    const { loadRequestInActiveTab } = useTabsStore.getState()
    loadRequestInActiveTab({
```

**Edit 4 — Replace history entry click store call (around line 539)**

Remove:
```typescript
                        const { loadRequest } = useRequestStore.getState()
                        loadRequest({
```
Add:
```typescript
                        const { loadRequestInActiveTab } = useTabsStore.getState()
                        loadRequestInActiveTab({
```

**Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors in `CollectionsSidebar.tsx`.

**Step 3: Commit**

```bash
git add frontend/src/components/collections/CollectionsSidebar.tsx
git commit -m "feat(tabs): update CollectionsSidebar to use useTabsStore"
```

---

### Task 5: Update `App.tsx` to render `RequestTabs`

**Files:**
- Modify: `frontend/src/App.tsx`

**Edit 1 — Add the import**

After the existing `RequestBuilder` import line, add:
```typescript
import { RequestTabs } from '@/components/request-builder/RequestTabs'
```

**Edit 2 — Insert `<RequestTabs />` above `<RequestBuilder />`**

Replace:
```tsx
            <main className="flex-1 flex flex-col min-w-0 bg-background">
              <RequestBuilder
                onRequestSent={(req, res) => console.log('Request sent:', req, res)}
              />
            </main>
```
With:
```tsx
            <main className="flex-1 flex flex-col min-w-0 bg-background">
              <RequestTabs />
              <RequestBuilder
                onRequestSent={(req, res) => console.log('Request sent:', req, res)}
              />
            </main>
```

**Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(tabs): render RequestTabs in App layout"
```

---

### Task 6: Delete `request-store.ts` and verify full build

**Files:**
- Delete: `frontend/src/store/request-store.ts`

**Step 1: Delete the file**

```bash
rm frontend/src/store/request-store.ts
```

**Step 2: Full build to confirm no remaining references**

```bash
cd frontend && yarn build 2>&1
```

Expected: clean build, no `request-store` references in errors. If any remain, grep for them:

```bash
grep -r "request-store\|useRequestStore" frontend/src/
```

All output should be empty.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(tabs): remove useRequestStore, tabs implementation complete"
```

---

### Task 7: Manual smoke test

Start the dev server and verify:

```bash
cd frontend && yarn dev
```

Check:
1. Tab bar appears above the request builder with one "GET Untitled Request" tab.
2. Clicking `+` opens a new blank tab.
3. Editing method/URL/headers marks the tab dirty (orange `●`).
4. Clicking `×` on a dirty tab shows "Discard changes?" dialog.
5. Clicking `×` on a clean tab closes it immediately.
6. Closing the last tab opens a fresh blank tab.
7. Clicking a request in the sidebar loads it into the current tab.
8. Switching tabs restores each tab's request and response independently.
9. Sending a request stores the response in the active tab; switching tabs and back shows it.
