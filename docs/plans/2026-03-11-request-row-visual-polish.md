# Request Row Visual Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the request rows in the collections sidebar with
better visual hierarchy while keeping the compact Postman-like density.

**Architecture:** Keep the existing request-row structure and behavior,
but add compact method chips, stronger active-row surface treatment, and
more stable internal alignment for labels and actions.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest

---

### Task 1: Add or update focused sidebar row tests if practical

**Files:**
- Check: `frontend/src/components/collections/CollectionsSidebar.tsx`
- Create or Modify: `frontend/src/components/collections/CollectionsSidebar.test.tsx`

**Step 1: Add narrow structural assertions if the harness is stable**

If an existing test harness is practical, add focused checks for request
row structure:

- method chip container exists
- active row class is stronger than hover-only state
- trailing action zone has stable width class

Avoid full snapshots.

**Step 2: Run the focused test**

Run:

```bash
cd frontend && yarn test src/components/collections/CollectionsSidebar.test.tsx
```

Expected: FAIL if the old row structure is still present, or skip if the
test harness cost outweighs the value.

**Step 3: Commit test-only updates if needed**

```bash
git add frontend/src/components/collections/CollectionsSidebar.test.tsx
git commit -m "test(sidebar): cover request row polish"
```

### Task 2: Implement compact method chips and stronger row surface

**Files:**
- Modify: `frontend/src/components/collections/CollectionsSidebar.tsx`

**Step 1: Upgrade method rendering**

Replace plain method text styling with a compact chip/pill treatment that
retains method-specific color coding while preserving density.

**Step 2: Strengthen active row styling**

Improve selected request row body styling so it reads as selected across
the row, not just from the left rail.

Hover state should remain lighter than active state.

**Step 3: Run regression tests**

Run:

```bash
cd frontend && yarn test src/lib/curl-parser.test.ts src/components/request-builder/VariableAwareUrlInput.test.tsx src/components/request-builder/useRequestBuilderState.test.tsx src/store/__tests__/collections-store.fetch-dedupe.test.ts src/App.test.tsx src/store/__tests__/history-store.fetch-dedupe.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add frontend/src/components/collections/CollectionsSidebar.tsx
git commit -m "style(sidebar): polish request rows"
```

### Task 3: Stabilize label/action alignment and manually verify

**Files:**
- Modify: `frontend/src/components/collections/CollectionsSidebar.tsx`

**Step 1: Tighten internal row alignment**

Ensure:

- method chip width is stable
- label truncation behaves cleanly
- action zone remains visually reserved
- no hover-induced horizontal jitter appears

**Step 2: Run regression tests again**

Run:

```bash
cd frontend && yarn test src/lib/curl-parser.test.ts src/components/request-builder/VariableAwareUrlInput.test.tsx src/components/request-builder/useRequestBuilderState.test.tsx src/store/__tests__/collections-store.fetch-dedupe.test.ts src/App.test.tsx src/store/__tests__/history-store.fetch-dedupe.test.ts
```

Expected: PASS.

**Step 3: Manual verification**

Run:

```bash
cd frontend && yarn dev --host 127.0.0.1 --port 5173
```

Verify:

- mixed methods are scannable
- active request row stands out clearly
- hover actions feel anchored
- narrow sidebar width still truncates cleanly

**Step 4: Commit final changes**

```bash
git add frontend/src/components/collections/CollectionsSidebar.tsx frontend/src/components/collections/CollectionsSidebar.test.tsx
git commit -m "style(sidebar): refine request row hierarchy"
```
