# WebSocket Active Collection Subscription Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce websocket fan-out and follow-up refresh work by routing
collection file-change events only to clients subscribed to the active
collection.

**Architecture:** Keep one websocket connection per app session, add a
minimal subscribe protocol from frontend to backend, store one active
collection subscription per websocket client, and preserve targeted
frontend refresh logic for relevant file types.

**Tech Stack:** React 19, TypeScript, Zustand, Go, Gorilla WebSocket,
Vitest, Go testing

---

### Task 1: Add tests for subscription-aware websocket routing

**Files:**
- Modify: `backend/internal/infrastructure/websocket/hub.go`
- Create or Modify: `backend/internal/infrastructure/websocket/hub_test.go`

**Step 1: Add failing backend tests**

Cover:

- a client receives file-change events only for its subscribed
  collection
- switching subscription replaces the previous collection
- unsubscribed clients do not receive collection events

Keep the tests focused on hub behavior rather than the whole server.

**Step 2: Run the focused backend tests**

Run:

```bash
cd backend && go test ./internal/infrastructure/websocket
```

Expected: FAIL because the current hub broadcasts globally.

**Step 3: Commit test-only updates if needed**

```bash
git add backend/internal/infrastructure/websocket/hub_test.go
git commit -m "test(websocket): cover collection subscriptions"
```

### Task 2: Implement subscription-aware hub behavior

**Files:**
- Modify: `backend/internal/infrastructure/websocket/hub.go`

**Step 1: Add client subscription state**

Track one active collection subscription per client connection.

Add a minimal control-message parser for incoming websocket messages so
clients can send `subscribe` updates.

**Step 2: Route broadcasts only to matching clients**

Change the hub delivery path so collection file-change events go only
to clients subscribed to the matching collection.

Keep cleanup correct on disconnect and preserve current file-change
payload shape to the frontend.

**Step 3: Run focused backend tests**

Run:

```bash
cd backend && go test ./internal/infrastructure/websocket
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/internal/infrastructure/websocket/hub.go backend/internal/infrastructure/websocket/hub_test.go
git commit -m "feat(websocket): route events by collection"
```

### Task 3: Add frontend subscription behavior and narrow refreshes

**Files:**
- Modify: `frontend/src/hooks/use-websocket.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Step 1: Add a clean send path for websocket control messages**

Use the existing websocket hook to send subscribe messages once the
socket is connected and whenever `activeCollection` changes.

Ensure reconnects resubscribe automatically from current app state.

**Step 2: Narrow frontend invalidation behavior**

Keep:

- `environments/*` -> `fetchEnvironments`
- `collection.bru` -> `fetchCollectionVariables` unless self-echo
- other active-collection files -> `fetchCollectionTree`

Avoid `fetchCollections()` for ordinary in-collection file writes.
Reserve collection-list refresh only for top-level events that actually
change the collection list.

**Step 3: Add failing and then passing frontend tests**

Cover:

- subscribe message sent when active collection becomes available
- subscribe message resent on active collection change
- reconnect resubscription
- no broad collection-list refresh for ordinary active-collection file
  changes

**Step 4: Run focused frontend tests**

Run:

```bash
cd frontend && yarn test src/App.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/hooks/use-websocket.ts frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(app): subscribe websocket by collection"
```

### Task 4: Run regression coverage across frontend and backend

**Files:**
- Check: `backend/internal/infrastructure/websocket/hub.go`
- Check: `frontend/src/App.tsx`
- Check: `frontend/src/store/collections.ts`

**Step 1: Run backend and frontend regression slices**

Run:

```bash
cd backend && go test ./internal/infrastructure/websocket
cd frontend && yarn test src/App.test.tsx src/store/__tests__/collections-store.fetch-dedupe.test.ts src/store/__tests__/history-store.fetch-dedupe.test.ts src/components/request-builder/useRequestBuilderState.test.tsx
```

Expected: PASS.

**Step 2: Manual verification**

Run the app and verify:

- collection `A` updates live while active
- collection `B` changes do not trigger work while viewing `A`
- switching active collection causes later events for the new
  collection to arrive

**Step 3: Commit final adjustments**

```bash
git add backend/internal/infrastructure/websocket/hub.go backend/internal/infrastructure/websocket/hub_test.go frontend/src/hooks/use-websocket.ts frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "perf(websocket): scope live updates to active collection"
```
