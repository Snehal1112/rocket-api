# Welcome Screen Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Postman-style welcome/empty screen (rocket logo + heading + "New Request" button) when no tabs are open — on first launch and whenever the user closes all tabs.

**Architecture:** Remove the "always keep one tab" guard from the tabs store so `tabs` can be `[]`. When `tabs.length === 0`, `App.tsx` renders a new `WelcomeScreen` component instead of `RequestBuilder`. Clicking "New Request" on the welcome screen calls `newTab()` exactly like the `+` button in the tab bar.

**Tech Stack:** React 19, TypeScript, Zustand, shadcn/ui (Button), lucide-react (Plus icon), Tailwind CSS, Vitest + Testing Library

**Spec:** [docs/superpowers/specs/2026-03-11-welcome-screen-design.md](../specs/2026-03-11-welcome-screen-design.md)

---

## Chunk 1: Store changes — allow empty tabs

### Task 1: Update `normalizeSession` to allow empty state

**Files:**
- Modify: `frontend/src/store/tabs-store.ts`

The `normalizeSession` function currently calls `createInitialSession()` when there are no persisted tabs. Change it to return an empty state instead.

**Current code (lines ~115–130):**
```ts
const normalizeSession = (
  persisted?: Partial<Pick<TabsState, 'tabs' | 'activeTabId'>>
): Pick<TabsState, 'tabs' | 'activeTabId'> => {
  if (!persisted?.tabs || persisted.tabs.length === 0) {
    return createInitialSession()
  }
  // ...
}
```

**Target code:**
```ts
const normalizeSession = (
  persisted?: Partial<Pick<TabsState, 'tabs' | 'activeTabId'>>
): Pick<TabsState, 'tabs' | 'activeTabId'> => {
  if (!persisted?.tabs || persisted.tabs.length === 0) {
    return { tabs: [], activeTabId: '' }
  }
  // rest unchanged
}
```

- [ ] **Step 1: Write the failing test**

Add a new test file `frontend/src/store/__tests__/tabs-store.empty-state.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'

// normalizeSession is not exported — test via store hydration behavior
// We simulate it by mocking sessionStorage with an empty tabs array
describe('tabs-store empty state', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
  })

  it('starts with empty tabs when sessionStorage has no stored tabs', async () => {
    // No stored data → fresh load
    const { useTabsStore } = await import('@/store/tabs-store')
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(0)
    expect(state.activeTabId).toBe('')
  })

  it('closes last tab and leaves tabs empty', async () => {
    const { useTabsStore } = await import('@/store/tabs-store')
    // Store starts empty; open one tab first
    useTabsStore.getState().newTab()
    expect(useTabsStore.getState().tabs).toHaveLength(1)

    const tabId = useTabsStore.getState().tabs[0].id
    useTabsStore.getState().closeTab(tabId)

    expect(useTabsStore.getState().tabs).toHaveLength(0)
    expect(useTabsStore.getState().activeTabId).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && yarn test src/store/__tests__/tabs-store.empty-state.test.ts --reporter=verbose
```

Expected: both tests FAIL (currently `tabs` starts with 1 tab and `closeTab` always keeps 1 tab)

- [ ] **Step 3: Update `normalizeSession` in `tabs-store.ts`**

Find the `normalizeSession` function and change the early-return branch:

```ts
// Before
if (!persisted?.tabs || persisted.tabs.length === 0) {
  return createInitialSession()
}

// After
if (!persisted?.tabs || persisted.tabs.length === 0) {
  return { tabs: [], activeTabId: '' }
}
```

Also update `createInitialSession` call site — find the store initialization block where `const initialSession = createInitialSession()` is used and replace the initial values:

```ts
// Before (inside the persist callback)
const initialSession = createInitialSession()
// ...
return {
  tabs: initialSession.tabs,
  activeTabId: initialSession.activeTabId,
  // ...
}

// After
return {
  tabs: [],
  activeTabId: '',
  // ...
}
```

- [ ] **Step 4: Update `closeTab` to allow empty tabs**

Find the `closeTab` action. The current guard:

```ts
closeTab: (id) => {
  const { tabs } = get()

  if (tabs.length === 1) {
    // Keep a fresh tab when closing the last one.
    const fresh = createTab()
    loadVersionByTabId.clear()
    set({ tabs: [fresh], activeTabId: fresh.id })
    return
  }
  // ...
}
```

Replace with:

```ts
closeTab: (id) => {
  const { tabs } = get()

  if (tabs.length === 1) {
    loadVersionByTabId.clear()
    set({ tabs: [], activeTabId: '' })
    return
  }
  // rest unchanged
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd frontend && yarn test src/store/__tests__/tabs-store.empty-state.test.ts --reporter=verbose
```

Expected: both tests PASS

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd frontend && yarn test --reporter=verbose
```

Expected: all previously passing tests still pass

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/store/__tests__/tabs-store.empty-state.test.ts src/store/tabs-store.ts
git commit -m "feat(tabs-store): allow empty tabs array for welcome screen"
```

---

## Chunk 2: WelcomeScreen component

### Task 2: Create `WelcomeScreen` component

**Files:**
- Create: `frontend/src/components/layout/WelcomeScreen.tsx`

- [ ] **Step 1: Write the failing component test**

Create `frontend/src/components/layout/__tests__/WelcomeScreen.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the tabs store
const mockNewTab = vi.fn()
vi.mock('@/store/tabs-store', () => ({
  useTabsStore: (selector: (s: { newTab: () => void }) => unknown) =>
    selector({ newTab: mockNewTab }),
}))

import { WelcomeScreen } from '../WelcomeScreen'

describe('WelcomeScreen', () => {
  it('renders the heading', () => {
    render(<WelcomeScreen />)
    expect(screen.getByText('Launch your first request')).toBeInTheDocument()
  })

  it('renders the rocket image', () => {
    render(<WelcomeScreen />)
    const img = screen.getByAltText('Rocket API')
    expect(img).toBeInTheDocument()
  })

  it('renders the New Request button', () => {
    render(<WelcomeScreen />)
    expect(screen.getByRole('button', { name: /new request/i })).toBeInTheDocument()
  })

  it('calls newTab when New Request button is clicked', async () => {
    render(<WelcomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: /new request/i }))
    expect(mockNewTab).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && yarn test src/components/layout/__tests__/WelcomeScreen.test.tsx --reporter=verbose
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `WelcomeScreen.tsx`**

Create `frontend/src/components/layout/WelcomeScreen.tsx`:

```tsx
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabsStore } from '@/store/tabs-store'

export function WelcomeScreen() {
  const newTab = useTabsStore(state => state.newTab)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center select-none">
      <img
        src="/rocket.png"
        alt="Rocket API"
        className="w-24 h-24 object-contain opacity-80 drop-shadow-lg"
      />
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Launch your first request
        </h2>
        <p className="text-sm text-muted-foreground">
          Send your first HTTP request to get started.
        </p>
      </div>
      <Button onClick={newTab} className="gap-2">
        <Plus className="h-4 w-4" />
        New Request
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd frontend && yarn test src/components/layout/__tests__/WelcomeScreen.test.tsx --reporter=verbose
```

Expected: all 4 tests PASS

- [ ] **Step 5: Run full test suite**

```bash
cd frontend && yarn test --reporter=verbose
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/WelcomeScreen.tsx frontend/src/components/layout/__tests__/WelcomeScreen.test.tsx
git commit -m "feat(ui): add WelcomeScreen component"
```

---

## Chunk 3: Wire WelcomeScreen into App.tsx

### Task 3: Render WelcomeScreen when no tabs are open

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Import `WelcomeScreen` and `tabs` state**

In `App.tsx`, add the import:

```tsx
import { WelcomeScreen } from '@/components/layout/WelcomeScreen'
```

Also update the `useTabsStore` selector to expose `tabs.length`:

```tsx
// Before
const activeTab = useTabsStore(state => state.tabs.find(t => t.id === state.activeTabId))

// After — add tabs alongside activeTab
const tabs = useTabsStore(state => state.tabs)
const activeTab = useTabsStore(state => state.tabs.find(t => t.id === state.activeTabId))
```

- [ ] **Step 2: Add the `WelcomeScreen` branch to the content area**

Find the content area render in `App.tsx`:

```tsx
{activeTab && !isRequestTab(activeTab) ? (
  <CollectionOverview collectionName={activeTab.collectionName} />
) : (
  <RequestBuilder
    onRequestSent={(req, res) => {
      useConsoleStore.getState().addEntry(req, res)
      if (!isConsoleOpen) setIsConsoleOpen(true)
    }}
  />
)}
```

Replace with:

```tsx
{tabs.length === 0 ? (
  <WelcomeScreen />
) : activeTab && !isRequestTab(activeTab) ? (
  <CollectionOverview collectionName={activeTab.collectionName} />
) : (
  <RequestBuilder
    onRequestSent={(req, res) => {
      useConsoleStore.getState().addEntry(req, res)
      if (!isConsoleOpen) setIsConsoleOpen(true)
    }}
  />
)}
```

- [ ] **Step 3: Run the linter to catch type errors**

```bash
cd frontend && yarn lint
```

Expected: no errors

- [ ] **Step 4: Run the full test suite**

```bash
cd frontend && yarn test --reporter=verbose
```

Expected: all tests pass

- [ ] **Step 5: Manual smoke test**

Start the dev server if not already running:
```bash
cd frontend && yarn dev
```

Visit `http://localhost:5173` and verify:
1. On first load (clear `sessionStorage` in DevTools → Application → Storage → Clear): welcome screen shows with rocket image, heading, and "New Request" button
2. Clicking "New Request" opens a new blank request tab with `RequestBuilder`
3. Open a few tabs, close them one by one — when the last tab is closed, welcome screen appears
4. Clicking `+` in the tab bar (when on welcome screen) also opens a new tab correctly

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(app): show WelcomeScreen when no tabs are open"
```
