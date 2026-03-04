# Collection Tab Selection, Save Target, and Dirty-State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure request send/save/dirty behavior is tab-correct so saves always target the originating request tab and dirty state only reflects persisted request changes.

**Architecture:** Refactor `tabs-store` to use tab-scoped saved snapshots and async-safe tab-id capture for save completion. Keep collection sidebar selection as visual/navigation state and synchronize highlight from active request tab path. RequestBuilder should rely on tab store state transitions rather than sidebar selection for save/dirty behavior.

**Tech Stack:** React 19, TypeScript, Zustand store, existing API client (`apiService`), Vitest + Testing Library.

---

## Background reading

Read before implementation:

- `frontend/src/store/tabs-store.ts`
- `frontend/src/components/request-builder/RequestBuilder.tsx`
- `frontend/src/components/request-builder/RequestTabs.tsx`
- `frontend/src/components/collections/CollectionsSidebar.tsx`
- `frontend/src/store/__tests__/tabs-store.*.test.ts` (existing store test patterns)

---

### Task 1: Add failing tests for dirty-state and wrong save target repro

**Files:**
- Create: `frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`

**Step 1: Write failing tests**

Add tests for:

- Sending with no persisted request edits should not set `isDirty`.
- Save initiated from tab A should update only tab A even if active selection switches to tab B before save resolves.

Test scaffold sketch:

```ts
it('does not mark dirty on send without persisted changes', async () => {
  // arrange tab + saved snapshot
  // invoke send-related state update path
  // expect isDirty false
})

it('save completion updates only originating tab', async () => {
  // arrange tabs A and B
  // start save on A (deferred promise)
  // switch active tab/selection to B
  // resolve save
  // assert only tab A path/save flags changed
})
```

**Step 2: Run tests to verify failure**

Run:

```bash
cd frontend
yarn test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts
```

Expected: FAIL because store logic does not yet enforce these semantics.

**Step 3: Commit failing tests (optional checkpoint commit)**

```bash
git add frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts
git commit -m "test(frontend): add failing repro tests for save target and dirty semantics"
```

---

### Task 2: Refactor `tabs-store` to tab-scoped save target and snapshot dirty model

**Files:**
- Modify: `frontend/src/store/tabs-store.ts`
- Modify: `frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts`

**Step 1: Implement tab-scoped metadata**

In `RequestTab`, add minimal fields:

- `lastSavedSnapshot?: string`
- `saveState?: 'clean' | 'dirty' | 'saving' | 'save_failed'`
- `lastSaveError?: string`

Add a helper:

```ts
const serializePersistedRequest = (request: HttpRequest) =>
  JSON.stringify({
    name: request.name,
    method: request.method,
    url: request.url,
    headers: request.headers,
    queryParams: request.queryParams,
    body: request.body,
    auth: request.auth,
  })
```

**Step 2: Update dirty transitions**

- On request-field update actions, compare serialized request with `lastSavedSnapshot`.
- Set `isDirty` true only when snapshot differs; set false when it matches.

**Step 3: Make save async tab-safe**

- In `saveActiveTab`, capture `activeTabId` and tab request/filePath at start.
- Execute save with captured values.
- On success/failure, update only tab matching captured tab id.

**Step 4: Update load/save snapshot initialization**

- On load into active tab, initialize `lastSavedSnapshot` from loaded request.
- On successful save, refresh `lastSavedSnapshot` and clear dirty for the same tab id.

**Step 5: Run targeted tests**

```bash
cd frontend
yarn test src/store/__tests__/tabs-store.save-target-and-dirty.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add frontend/src/store/tabs-store.ts frontend/src/store/__tests__/tabs-store.save-target-and-dirty.test.ts
git commit -m "fix(frontend): make save target and dirty-state tab-scoped"
```

---

### Task 3: Sync collection-list selection/highlight from active tab path

**Files:**
- Modify: `frontend/src/components/collections/CollectionsSidebar.tsx`
- Modify: `frontend/src/components/request-builder/RequestTabs.tsx`
- Modify (if needed): `frontend/src/store/tabs-store.ts`
- Test: `frontend/src/components/collections/__tests__/CollectionsSidebar.selection-sync.test.tsx`

**Step 1: Write failing test**

Add a test ensuring:

- Selecting tab A highlights path A in collection list.
- Switching to tab B updates highlight to path B immediately.

Run:

```bash
cd frontend
yarn test src/components/collections/__tests__/CollectionsSidebar.selection-sync.test.tsx
```

Expected: FAIL.

**Step 2: Implement sync behavior**

- Keep highlight derived from active request tab `filePath`.
- Ensure tab click (`setActiveTab`) and sidebar highlight path stay aligned.
- Do not let sidebar-selected node influence save target.

**Step 3: Re-run test**

```bash
cd frontend
yarn test src/components/collections/__tests__/CollectionsSidebar.selection-sync.test.tsx
```

Expected: PASS.

**Step 4: Commit**

```bash
git add frontend/src/components/collections/CollectionsSidebar.tsx frontend/src/components/request-builder/RequestTabs.tsx frontend/src/store/tabs-store.ts frontend/src/components/collections/__tests__/CollectionsSidebar.selection-sync.test.tsx
git commit -m "fix(frontend): sync collection highlight with active request tab"
```

---

### Task 4: Ensure send flow does not create false dirty state

**Files:**
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx`
- Test: `frontend/src/components/request-builder/__tests__/RequestBuilder.send-dirty-semantics.test.tsx`

**Step 1: Write failing component-level test**

Scenario:

- Load saved request with known snapshot.
- Click Send.
- Assert dirty remains false if no persisted fields were changed.

Run:

```bash
cd frontend
yarn test src/components/request-builder/__tests__/RequestBuilder.send-dirty-semantics.test.tsx
```

Expected: FAIL.

**Step 2: Implement minimal fix**

- Remove/avoid update calls during send path that mutate persisted tab state unless actual editor values changed.
- Ensure send-time runtime substitutions/auth additions are execution-only and do not flip dirty.

**Step 3: Re-run test**

```bash
cd frontend
yarn test src/components/request-builder/__tests__/RequestBuilder.send-dirty-semantics.test.tsx
```

Expected: PASS.

**Step 4: Commit**

```bash
git add frontend/src/components/request-builder/RequestBuilder.tsx frontend/src/components/request-builder/__tests__/RequestBuilder.send-dirty-semantics.test.tsx
git commit -m "fix(frontend): keep send flow from setting false dirty state"
```

---

### Task 5: Full verification + regression pass

**Files:**
- Optional docs update: `docs/plans/2026-03-04-collection-tab-selection-save-dirty.md`

**Step 1: Run full frontend checks**

```bash
cd frontend
yarn lint
yarn test
yarn build
```

Expected: all pass.

**Step 2: Run backend regression check**

```bash
cd ../backend
go test ./...
```

Expected: pass (or no regressions).

**Step 3: Manual repro verification**

Run this sequence:

1. Open Request A.
2. Send Request A.
3. Confirm no false dirty when persisted fields unchanged.
4. Open Request B from sidebar.
5. Switch back to Request A tab and click Save.
6. Confirm saved file is Request A (not Request B).
7. Confirm sidebar highlight follows currently active tab.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(frontend): correct tab-scoped save target and dirty-state behavior"
```

