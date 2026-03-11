# Frontend Architecture Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Rocket's frontend to a route-driven, feature-owned
architecture inspired by `e4a-manage` while keeping the rollout
incremental and low-risk across multiple PRs.

**Architecture:** Keep `HashRouter`, introduce a dedicated workspace
shell and nested route hierarchy, move feature orchestration out of
`App.tsx`, and gradually replace oversized shared stores with
feature-local hooks and services behind a temporary compatibility
layer.

**Tech Stack:** React 19, TypeScript, React Router, Zustand, Vitest

---

### Task 1: Establish the target app-shell seam

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/features/workspace/components/WorkspaceShell.tsx`
- Create: `frontend/src/features/workspace/routes.tsx`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/App.test.tsx`

**Step 1: Write the failing shell composition test**

Add a focused test proving the root route renders a dedicated workspace
shell component instead of directly rendering the old all-in-one `App`
content.

**Step 2: Run the focused test**

Run:

```bash
cd frontend && yarn test src/App.test.tsx
```

Expected: FAIL because the shell extraction does not exist yet.

**Step 3: Implement the minimal shell extraction**

- move shell composition into `WorkspaceShell`
- keep behavior unchanged
- keep feature logic temporarily delegated to existing stores and
  components

**Step 4: Re-run the focused test**

Run:

```bash
cd frontend && yarn test src/App.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/features/workspace/components/WorkspaceShell.tsx frontend/src/features/workspace/routes.tsx frontend/src/app/routes.tsx frontend/src/App.test.tsx
git commit -m "refactor(app): extract workspace shell"
```

### Task 2: Introduce nested workspace routes

**Files:**
- Modify: `frontend/src/app/routes.tsx`
- Create: `frontend/src/features/collections/routes.tsx`
- Create: `frontend/src/features/request-builder/routes.tsx`
- Create: `frontend/src/features/history/routes.tsx`
- Create or Modify: `frontend/src/providers/Routes/*`
- Create: `frontend/src/features/workspace/hooks/useWorkspaceRouteState.ts`
- Create: `frontend/src/features/workspace/__tests__/workspace-routes.test.tsx`

**Step 1: Write failing route tests**

Cover:

- collection overview route
- request route with collection and request path
- history route
- not-found route

**Step 2: Run the focused route tests**

Run:

```bash
cd frontend && yarn test src/features/workspace/__tests__/workspace-routes.test.tsx
```

Expected: FAIL because those route fragments do not exist yet.

**Step 3: Implement the nested route registry**

- keep `HashRouter`
- add route fragments under features
- make the root route compose feature route fragments inside the
  workspace shell

**Step 4: Re-run the focused route tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/app/routes.tsx frontend/src/features/collections/routes.tsx frontend/src/features/request-builder/routes.tsx frontend/src/features/history/routes.tsx frontend/src/providers/Routes frontend/src/features/workspace/hooks/useWorkspaceRouteState.ts frontend/src/features/workspace/__tests__/workspace-routes.test.tsx
git commit -m "feat(routes): add nested workspace routes"
```

### Task 3: Make route params the source of active workspace context

**Files:**
- Modify: `frontend/src/store/tabs-store.ts`
- Modify: `frontend/src/store/collections.ts`
- Create: `frontend/src/features/workspace/hooks/useRouteSyncedTabs.ts`
- Create: `frontend/src/features/request-builder/hooks/useRequestRouteState.ts`
- Create or Modify: `frontend/src/features/workspace/__tests__/route-sync.test.tsx`

**Step 1: Write failing route-sync tests**

Cover:

- navigating to a collection route updates active collection context
- navigating to a request route opens the corresponding request tab
- restoring a tab navigates back to its route

**Step 2: Run the focused route-sync tests**

Expected: FAIL because tabs and routes are not synchronized yet.

**Step 3: Implement the compatibility sync layer**

- route params drive active collection/request context first
- tabs mirror route state
- existing tab/store behavior remains as compatibility during migration

**Step 4: Re-run the focused route-sync tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/store/tabs-store.ts frontend/src/store/collections.ts frontend/src/features/workspace/hooks/useRouteSyncedTabs.ts frontend/src/features/request-builder/hooks/useRequestRouteState.ts frontend/src/features/workspace/__tests__/route-sync.test.tsx
git commit -m "feat(workspace): sync tabs with routes"
```

### Task 4: Extract collections feature data modules

**Files:**
- Create: `frontend/src/features/collections/api/collectionsApi.ts`
- Create: `frontend/src/features/collections/hooks/useCollections.ts`
- Create: `frontend/src/features/collections/hooks/useCollectionTree.ts`
- Create: `frontend/src/features/collections/hooks/useCollectionSettings.ts`
- Move or Modify: `frontend/src/components/collections/*`
- Modify: `frontend/src/store/collections.ts`
- Create: `frontend/src/features/collections/__tests__/collections-hooks.test.tsx`

**Step 1: Write failing collections feature tests**

Cover:

- fetching collections list
- fetching collection tree
- fetching and saving collection variables
- fetching and saving environments

Use feature hooks as the test surface, not the old store directly.

**Step 2: Run the focused collections tests**

Expected: FAIL because feature hooks do not exist yet.

**Step 3: Implement collections feature APIs and hooks**

- keep old store as a compatibility facade if needed
- move API access and orchestration into feature-local hooks
- keep component behavior stable

**Step 4: Re-run the focused collections tests**

Expected: PASS.

**Step 5: Run legacy store regression tests**

Run:

```bash
cd frontend && yarn test src/store/__tests__/collections-store.fetch-dedupe.test.ts
```

Expected: PASS while compatibility remains.

**Step 6: Commit**

```bash
git add frontend/src/features/collections/api/collectionsApi.ts frontend/src/features/collections/hooks/useCollections.ts frontend/src/features/collections/hooks/useCollectionTree.ts frontend/src/features/collections/hooks/useCollectionSettings.ts frontend/src/components/collections frontend/src/store/collections.ts frontend/src/features/collections/__tests__/collections-hooks.test.tsx
git commit -m "refactor(collections): add feature-owned data hooks"
```

### Task 5: Extract request-builder feature orchestration

**Files:**
- Create: `frontend/src/features/request-builder/api/requestExecutionApi.ts`
- Create: `frontend/src/features/request-builder/hooks/useRequestExecution.ts`
- Move or Modify: `frontend/src/components/request-builder/*`
- Modify: `frontend/src/components/request-builder/useRequestBuilderState.ts`
- Create: `frontend/src/features/request-builder/__tests__/request-execution.test.tsx`

**Step 1: Write failing request-builder feature tests**

Cover:

- request execution from route-backed context
- cURL paste import still updates request state correctly
- script write-back reconciliation stays single-pass

**Step 2: Run the focused request-builder tests**

Expected: FAIL because the feature-local execution hooks do not exist
yet.

**Step 3: Implement feature-local request execution hooks**

- move orchestration from shared shell/store assumptions into the
  request-builder feature
- preserve current behavior and tests

**Step 4: Re-run the focused request-builder tests**

Expected: PASS.

**Step 5: Re-run existing request-builder regressions**

Run:

```bash
cd frontend && yarn test src/components/request-builder/useRequestBuilderState.test.tsx src/lib/curl-parser.test.ts src/components/request-builder/VariableAwareUrlInput.test.tsx
```

Expected: PASS.

**Step 6: Commit**

```bash
git add frontend/src/features/request-builder/api/requestExecutionApi.ts frontend/src/features/request-builder/hooks/useRequestExecution.ts frontend/src/components/request-builder frontend/src/features/request-builder/__tests__/request-execution.test.tsx
git commit -m "refactor(request-builder): localize execution state"
```

### Task 6: Extract history feature modules

**Files:**
- Create: `frontend/src/features/history/api/historyApi.ts`
- Create: `frontend/src/features/history/hooks/useHistoryEntries.ts`
- Move or Modify: `frontend/src/components/collections/CollectionOverview.tsx`
- Modify: `frontend/src/store/history.ts`
- Create: `frontend/src/features/history/__tests__/history-hooks.test.tsx`

**Step 1: Write failing history feature tests**

Cover:

- loading history entries
- deleting history entries
- clearing history
- route-driven history view behavior

**Step 2: Run the focused history tests**

Expected: FAIL because feature-local history modules do not exist yet.

**Step 3: Implement feature-local history hooks**

- move history data access out of the shared store as the primary owner
- keep compatibility with existing components until migration is
  complete

**Step 4: Re-run focused and legacy history tests**

Run:

```bash
cd frontend && yarn test src/features/history/__tests__/history-hooks.test.tsx src/store/__tests__/history-store.fetch-dedupe.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/history/api/historyApi.ts frontend/src/features/history/hooks/useHistoryEntries.ts frontend/src/components/collections/CollectionOverview.tsx frontend/src/store/history.ts frontend/src/features/history/__tests__/history-hooks.test.tsx
git commit -m "refactor(history): add feature-owned history hooks"
```

### Task 7: Extract realtime feature ownership

**Files:**
- Create: `frontend/src/features/realtime/hooks/useRealtimeSync.ts`
- Create: `frontend/src/features/realtime/lib/event-routing.ts`
- Modify: `frontend/src/hooks/use-websocket.ts`
- Modify: `frontend/src/App.tsx` or `WorkspaceShell.tsx`
- Create: `frontend/src/features/realtime/__tests__/useRealtimeSync.test.tsx`

**Step 1: Write failing realtime feature tests**

Cover:

- active-collection websocket subscription
- event routing for collection tree, environments, and collection
  variables
- self-echo suppression stays intact

**Step 2: Run the focused realtime tests**

Expected: FAIL because realtime ownership is still not isolated.

**Step 3: Implement realtime feature extraction**

- move websocket orchestration out of app-shell code
- keep one websocket connection
- keep existing active-collection subscription behavior

**Step 4: Re-run focused and existing websocket tests**

Run:

```bash
cd frontend && yarn test src/features/realtime/__tests__/useRealtimeSync.test.tsx src/App.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/realtime/hooks/useRealtimeSync.ts frontend/src/features/realtime/lib/event-routing.ts frontend/src/hooks/use-websocket.ts frontend/src/App.tsx frontend/src/features/workspace/components/WorkspaceShell.tsx frontend/src/features/realtime/__tests__/useRealtimeSync.test.tsx
git commit -m "refactor(realtime): isolate websocket orchestration"
```

### Task 8: Reduce shared stores to UI-local state

**Files:**
- Modify: `frontend/src/store/collections.ts`
- Modify: `frontend/src/store/history.ts`
- Modify: `frontend/src/store/tabs-store.ts`
- Modify: `frontend/src/store/console.ts`
- Create or Modify: `frontend/src/store/__tests__/*`

**Step 1: Write failing cleanup tests**

Cover:

- tabs store only holds UI-local tab state
- console store remains UI-local
- feature data stores no longer act as the primary orchestration layer

**Step 2: Run the focused cleanup tests**

Expected: FAIL until compatibility code is removed or reduced.

**Step 3: Remove obsolete compatibility seams**

- keep only client-local state in shared stores
- remove redundant feature data orchestration from shared stores

**Step 4: Re-run focused and legacy regression tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/store/collections.ts frontend/src/store/history.ts frontend/src/store/tabs-store.ts frontend/src/store/console.ts frontend/src/store/__tests__
git commit -m "refactor(store): keep only UI-local shared state"
```

### Task 9: Final regression and manual validation

**Files:**
- Check: `frontend/src/app/routes.tsx`
- Check: `frontend/src/features/workspace/components/WorkspaceShell.tsx`
- Check: `frontend/src/features/collections/*`
- Check: `frontend/src/features/request-builder/*`
- Check: `frontend/src/features/history/*`
- Check: `frontend/src/features/realtime/*`

**Step 1: Run frontend regression coverage**

Run:

```bash
cd frontend && yarn test
```

Expected: PASS.

**Step 2: Run frontend build**

Run:

```bash
cd frontend && yarn build
```

Expected: PASS.

**Step 3: Manual verification**

Verify:

- deep-link to collection overview route works
- deep-link to request route opens the correct request
- tab restore and route sync both work
- collection sidebar navigation updates URL
- send flow still works
- cURL paste import still works
- realtime active-collection updates still work
- history route works

**Step 4: Commit final adjustments**

```bash
git add frontend/src
git commit -m "refactor(frontend): migrate to feature routes"
```
