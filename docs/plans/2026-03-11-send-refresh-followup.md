# Send Refresh Follow-up Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce redundant frontend refresh traffic after one `Send`
action, especially when a `post-response` script writes only one
variable.

**Architecture:** Keep `useRequestBuilderState` as the owner of the
send lifecycle, remove overlapping effect-driven reads from mounted UI
components, and narrow environment refresh behavior after script-driven
variable persistence. Preserve store-level in-flight dedupe as the
backstop for concurrent identical reads.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, Vite

---

### Task 1: Confirm and extend store-level dedupe coverage

**Files:**
- Modify: `frontend/src/store/__tests__/collections-store.fetch-dedupe.test.ts`
- Modify: `frontend/src/store/__tests__/history-store.fetch-dedupe.test.ts`
- Check: `frontend/src/store/collections.ts`
- Check: `frontend/src/store/history.ts`

**Step 1: Review existing dedupe tests**

Read the current tests and confirm they cover:

- `fetchCollectionTree(collection)`
- `fetchEnvironments(collection)`
- `fetchCollectionVariables(collection)`
- `fetchHistory(limit)`

If one of these is missing, add the failing test first using the
existing deferred-promise pattern.

**Step 2: Run the focused tests**

Run:

```bash
cd frontend && yarn test src/store/__tests__/collections-store.fetch-dedupe.test.ts src/store/__tests__/history-store.fetch-dedupe.test.ts
```

Expected: PASS if the current dedupe implementation is intact.

**Step 3: Commit test-only updates if needed**

```bash
git add frontend/src/store/__tests__/collections-store.fetch-dedupe.test.ts frontend/src/store/__tests__/history-store.fetch-dedupe.test.ts
git commit -m "test(store): cover send refresh dedupe"
```

### Task 2: Remove overlapping history and collection refresh effects

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/collections/CollectionOverview.tsx`
- Check: `frontend/src/components/collections/CollectionsSidebar.tsx`

**Step 1: Write or update a focused regression test if the harness is stable**

Check whether an existing component test can assert that mounting the
overview or restoring active tab context does not trigger duplicate
collection/history fetches. If the current harness is too heavy for a
useful test, keep this task manually verified and rely on store tests as
the safety net.

**Step 2: Inspect refresh ownership before editing**

Confirm:

- `CollectionsSidebar.tsx` fetches the active collection tree when
  `activeCollection` changes
- `CollectionOverview.tsx` fetches history on mount
- `App.tsx` restores active collection context from the active tab

This step is only to confirm the ownership model before narrowing it.

**Step 3: Implement the minimal ownership cleanup**

Update the components so that:

- `CollectionsSidebar.tsx` stays the owner of collection-tree loading
- `App.tsx` only restores active collection context
- `CollectionOverview.tsx` does not issue an unnecessary generic refresh
  that duplicates the send flow or sidebar behavior

Keep the change minimal. Do not redesign store ownership beyond the
duplicate paths.

**Step 4: Run affected frontend tests**

Run:

```bash
cd frontend && yarn test src/components/request-builder/useRequestBuilderState.test.tsx
```

If a component regression test was added, run that file too.

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/collections/CollectionOverview.tsx frontend/src/components/request-builder/useRequestBuilderState.test.tsx
git commit -m "fix(frontend): trim overlapping send refreshes"
```

### Task 3: Narrow environment reloads after script-driven variable saves

**Files:**
- Modify: `frontend/src/store/collections.ts`
- Modify: `frontend/src/components/request-builder/useRequestBuilderState.ts`
- Test: `frontend/src/components/request-builder/useRequestBuilderState.test.tsx`

**Step 1: Write the failing test**

Add a targeted test around the send flow where a `post-response` script
returns one mutated variable. The test should prove that persisting that
single variable does not trigger repeated environment reload chains.

Mock the relevant store and API methods so the test can assert call
counts for:

- request send
- history fetch
- environment save
- environment reload, if it still exists

**Step 2: Run the focused test to verify failure**

Run:

```bash
cd frontend && yarn test src/components/request-builder/useRequestBuilderState.test.tsx
```

Expected: FAIL because the current save path reloads more state than the
test allows.

**Step 3: Implement the minimal fix**

Update the persistence path so that saving one environment-backed
variable updates the relevant store state without forcing a broad
environment refetch unless necessary for correctness.

Keep these constraints:

- preserve `activeEnvironment` correctness
- preserve collection variable save behavior
- preserve error handling
- avoid unrelated refactors

**Step 4: Run the focused test again**

Run:

```bash
cd frontend && yarn test src/components/request-builder/useRequestBuilderState.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/store/collections.ts frontend/src/components/request-builder/useRequestBuilderState.ts frontend/src/components/request-builder/useRequestBuilderState.test.tsx
git commit -m "fix(store): narrow script variable refreshes"
```

### Task 4: Verify the reported scenario end to end

**Files:**
- Check: `frontend/src/components/request-builder/useRequestBuilderState.ts`
- Check: `frontend/src/store/collections.ts`
- Check: `frontend/src/store/history.ts`

**Step 1: Run the targeted automated tests**

Run:

```bash
cd frontend && yarn test src/store/__tests__/collections-store.fetch-dedupe.test.ts src/store/__tests__/history-store.fetch-dedupe.test.ts src/components/request-builder/useRequestBuilderState.test.tsx
```

Expected: PASS.

**Step 2: Run the frontend app and manually verify the network panel**

Run:

```bash
cd frontend && yarn dev --host 127.0.0.1 --port 5173
```

Open the UI, load the request with the one-variable `post-response`
script, click `Send`, and confirm the network panel shows:

- one `GET /health`
- one `POST /api/v1/requests/send`
- one `GET /api/v1/history?limit=50`
- no repeated collection/environment/variables burst

**Step 3: Commit any final verification-related test changes**

```bash
git add frontend/src/store/__tests__/collections-store.fetch-dedupe.test.ts frontend/src/store/__tests__/history-store.fetch-dedupe.test.ts frontend/src/components/request-builder/useRequestBuilderState.test.tsx frontend/src/App.tsx frontend/src/components/collections/CollectionOverview.tsx frontend/src/components/request-builder/useRequestBuilderState.ts frontend/src/store/collections.ts frontend/src/store/history.ts
git commit -m "fix(send): reduce redundant refresh requests"
```
