# Request Open Tab Dedup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure different requests always open in different tabs, while clicking an already-open request focuses its existing tab.

**Architecture:** Keep request-open behavior centralized in `tabs-store` so sidebar/UI stays thin. Add deterministic open/focus rules in `loadRequestFromPath`, then harden async loading with tab-scoped load tokens so rapid clicks cannot overwrite unrelated tabs. Drive with TDD from store tests first.

**Tech Stack:** React, TypeScript, Zustand, Vitest, Yarn, ESLint

---

### Task 1: Add failing tests for request open/focus contract

**Files:**
- Modify: `frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`

**Step 1: Write the failing test**

```ts
it('opens different requests from same collection in separate tabs', async () => {
  // arrange existing collection + two paths
  // click/open first path
  // click/open second path
  // assert two request tabs exist with distinct filePath values
})

it('focuses existing tab when same request is opened again', async () => {
  // open one request path once
  // open same path again
  // assert tab count unchanged and activeTabId matches existing tab
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && yarn -s test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`
Expected: FAIL for tab-count/focus assertions due to active-tab reuse behavior.

**Step 3: Write minimal implementation**

No implementation in this task.

**Step 4: Run test to verify it still fails for the new cases only**

Run: `cd frontend && yarn -s test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`
Expected: New tests fail; unrelated existing tests remain stable.

**Step 5: Commit**

```bash
git add frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts
git commit -m "test(frontend): cover request open tab dedup behavior"
```

### Task 2: Implement new-tab-on-miss and focus-on-hit in tabs store

**Files:**
- Modify: `frontend/src/store/tabs-store.ts`
- Test: `frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`

**Step 1: Write the failing test**

Use Task 1 failures as red state.

**Step 2: Run test to verify it fails**

Run: `cd frontend && yarn -s test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`
Expected: FAIL in contract tests.

**Step 3: Write minimal implementation**

```ts
loadRequestFromPath: async (collectionName, path) => {
  const { tabs } = get()

  const existingTab = tabs.find(t =>
    t.kind === 'request' &&
    t.collectionName === collectionName &&
    t.filePath === path
  )

  if (existingTab && existingTab.kind === 'request') {
    set({ activeTabId: existingTab.id })
    return
  }

  // always create new request tab for non-open request
  const tab = createTab()
  set(state => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))

  // load into this tab id
  const targetTabId = tab.id
  // ...fetch and populate targetTabId
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && yarn -s test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`
Expected: PASS for new-tab/focus contract tests.

**Step 5: Commit**

```bash
git add frontend/src/store/tabs-store.ts frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts
git commit -m "fix(frontend): open non-open requests in new tabs and dedupe by path"
```

### Task 3: Add race-safety for async request loads per tab

**Files:**
- Modify: `frontend/src/store/tabs-store.ts`
- Modify: `frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`

**Step 1: Write the failing test**

```ts
it('does not let stale async request load overwrite newer tab state', async () => {
  // open request A with deferred response
  // open request B before A resolves
  // resolve B then A
  // assert each tab keeps its own request/filePath and active tab state remains correct
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && yarn -s test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`
Expected: FAIL where stale async completion mutates wrong tab or loading flag.

**Step 3: Write minimal implementation**

```ts
const loadVersionByTabId = new Map<string, number>()

const nextVersion = (tabId: string) => {
  const v = (loadVersionByTabId.get(tabId) ?? 0) + 1
  loadVersionByTabId.set(tabId, v)
  return v
}

// in loadRequestFromPath
const version = nextVersion(targetTabId)

// before applying async result:
if (loadVersionByTabId.get(targetTabId) !== version) return
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && yarn -s test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`
Expected: PASS for race-safety tests and previous contract tests.

**Step 5: Commit**

```bash
git add frontend/src/store/tabs-store.ts frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts
git commit -m "fix(frontend): guard tab request loads against stale async responses"
```

### Task 4: Verify integration behavior and quality gates

**Files:**
- Verify only (no required source edits)

**Step 1: Write the failing test**

No new tests required.

**Step 2: Run test to verify current state**

Run: `cd frontend && yarn -s test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`
Expected: PASS.

**Step 3: Write minimal implementation**

No implementation in this task.

**Step 4: Run broader checks**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s test`

Expected:
- Lint passes.
- Test suite passes (or pre-existing unrelated failures are documented explicitly).

**Step 5: Commit**

```bash
# only if any verification-driven edits were made
git add -A
git commit -m "chore(frontend): finalize request tab open behavior verification"
```

## Implementation Notes
- Keep changes DRY and scoped: only touch tab-open behavior and async safety paths.
- Use `@superpowers/test-driven-development` and `@superpowers/verification-before-completion` practices while executing.
- Do not alter collection sidebar rendering rules in this plan unless tests show a regression.
