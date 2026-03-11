# Script Write-back Idempotency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make post-send script variable persistence idempotent so the
frontend saves only real diffs and never replays identical
collection-variable payloads during one send lifecycle.

**Architecture:** Refactor the request-builder send flow to reconcile
script-written variables once per response, split environment and
collection write-back into explicit diffable targets, and persist each
target at most once only when its values actually changed.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, Vite

---

### Task 1: Add failing tests for script write-back reconciliation

**Files:**
- Modify: `frontend/src/components/request-builder/useRequestBuilderState.test.tsx`
- Check: `frontend/src/components/request-builder/useRequestBuilderState.ts`

**Step 1: Write the failing tests**

Add focused tests that exercise the post-send write-back path:

- environment-only script mutation calls `saveEnvironment()` and does not
  call `saveCollectionVariables()`
- collection-only script mutation calls `saveCollectionVariables()` once
- unchanged collection-variable values do not call
  `saveCollectionVariables()`
- unchanged environment-variable values do not call `saveEnvironment()`

Mock the tabs store, collections store, history store, and API send
path just enough to drive `handleSubmit()`.

**Step 2: Run the focused tests**

Run:

```bash
cd frontend && yarn test src/components/request-builder/useRequestBuilderState.test.tsx
```

Expected: FAIL because the current write-back loop persists incrementally
and does not skip unchanged collection saves.

**Step 3: Commit test-only updates if needed**

```bash
git add frontend/src/components/request-builder/useRequestBuilderState.test.tsx
git commit -m "test(request-builder): cover script write-back diffs"
```

### Task 2: Refactor script write-back to reconcile once and persist diffs

**Files:**
- Modify: `frontend/src/components/request-builder/useRequestBuilderState.ts`
- Test: `frontend/src/components/request-builder/useRequestBuilderState.test.tsx`

**Step 1: Extract reconciliation logic**

Refactor the script-variable persistence section so it:

- reads the latest `activeCollection`, `activeEnvironment`, and
  `collectionVariables` once
- builds final target variables for environment and collection scopes
- determines whether each target actually changed

Do not call `handleSaveUrlVariable()` inside a per-key loop anymore if
that loop can replay equivalent saves.

**Step 2: Persist only changed targets**

Implement the minimal persistence rules:

- if environment variables changed, call `saveEnvironment()` once
- if collection variables changed, call `saveCollectionVariables()` once
- if no diff exists for a scope, skip that save entirely

Preserve the existing scope precedence:

- update matching environment variable when present
- otherwise update matching collection variable
- otherwise create in active environment when one exists
- otherwise create in collection variables

**Step 3: Run the focused tests**

Run:

```bash
cd frontend && yarn test src/components/request-builder/useRequestBuilderState.test.tsx
```

Expected: PASS.

**Step 4: Commit**

```bash
git add frontend/src/components/request-builder/useRequestBuilderState.ts frontend/src/components/request-builder/useRequestBuilderState.test.tsx
git commit -m "fix(request-builder): dedupe script write-back"
```

### Task 3: Verify interaction with existing dedupe and websocket logic

**Files:**
- Check: `frontend/src/store/collections.ts`
- Check: `frontend/src/App.tsx`
- Check: `frontend/src/store/__tests__/collections-store.fetch-dedupe.test.ts`
- Check: `frontend/src/App.test.tsx`

**Step 1: Run targeted regression tests**

Run:

```bash
cd frontend && yarn test src/components/request-builder/useRequestBuilderState.test.tsx src/store/__tests__/collections-store.fetch-dedupe.test.ts src/App.test.tsx src/store/__tests__/history-store.fetch-dedupe.test.ts
```

Expected: PASS.

**Step 2: Confirm no new overlap was introduced**

Review:

- collection-variable self-echo suppression still works
- same-collection activation still does not refetch variables or
  environments
- history dedupe still passes

If a regression appears, fix it before moving on.

**Step 3: Commit any supporting adjustments**

```bash
git add frontend/src/components/request-builder/useRequestBuilderState.ts frontend/src/components/request-builder/useRequestBuilderState.test.tsx frontend/src/store/collections.ts frontend/src/App.tsx frontend/src/store/__tests__/collections-store.fetch-dedupe.test.ts frontend/src/App.test.tsx frontend/src/store/__tests__/history-store.fetch-dedupe.test.ts
git commit -m "test(frontend): verify script persistence dedupe"
```

### Task 4: Manually verify the reported request

**Files:**
- Check: `frontend/src/components/request-builder/useRequestBuilderState.ts`

**Step 1: Run the frontend app**

Run:

```bash
cd frontend && yarn dev --host 127.0.0.1 --port 5173
```

**Step 2: Reproduce the exact request**

Use the request whose post-response script calls:

```js
pm.environment.set("userLength", 1001)
```

Confirm the network panel shows:

- one `GET /health`
- one `POST /api/v1/requests/send`
- one `GET /api/v1/history?limit=50`
- at most one `POST /api/v1/environments`
- zero repeated `POST /api/v1/collections/:name/variables`

**Step 3: Verify collection-variable script case too**

If available, run a request that uses `pm.variables.set(...)` and
confirm:

- one `POST /api/v1/collections/:name/variables` when values change
- no duplicate identical posts

**Step 4: Commit final changes**

```bash
git add frontend/src/components/request-builder/useRequestBuilderState.ts frontend/src/components/request-builder/useRequestBuilderState.test.tsx frontend/src/store/collections.ts frontend/src/App.tsx frontend/src/store/__tests__/collections-store.fetch-dedupe.test.ts frontend/src/App.test.tsx frontend/src/store/__tests__/history-store.fetch-dedupe.test.ts
git commit -m "fix(send): make script write-back idempotent"
```
