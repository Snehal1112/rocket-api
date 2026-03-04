# Non-Blocking Collection Tree Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent full sidebar loading mask when selecting a collection; show row-level spinner for selected collection tree loading.

**Architecture:** Split collection loading into list-level and tree-level flags in store, then bind sidebar rendering to the appropriate flag. Keep behavior and APIs unchanged.

**Tech Stack:** React, TypeScript, Zustand, Yarn, ESLint, Vitest

---

### Task 1: Split store loading state

**Files:**
- Modify: `frontend/src/store/collections.ts`

**Step 1: Write the failing test**

No existing store tests for this; proceed with compile/lint verification.

**Step 2: Run current checks**

Run: `cd frontend && yarn -s lint`
Expected: baseline green before change.

**Step 3: Write minimal implementation**

- Replace `isLoading` with:
  - `isCollectionsLoading`
  - `isCollectionTreeLoading`
- Update actions to toggle correct flag.

**Step 4: Run checks**

Run: `cd frontend && yarn -s lint`
Expected: pass.

**Step 5: Commit**

```bash
git add frontend/src/store/collections.ts
git commit -m "refactor(frontend): split collection list and tree loading states"
```

### Task 2: Update sidebar to non-blocking loading UX

**Files:**
- Modify: `frontend/src/components/collections/CollectionsSidebar.tsx`

**Step 1: Write the failing test**

No dedicated sidebar tests currently; use UI compile/lint/build verification.

**Step 2: Run current checks**

Run: `cd frontend && yarn -s lint`
Expected: baseline green.

**Step 3: Write minimal implementation**

- Consume new store fields.
- Use `isCollectionsLoading` for top-level content loading.
- Show inline `Loader2` in active collection row when `isCollectionTreeLoading`.

**Step 4: Run checks**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s test`
- `cd frontend && yarn -s build`

Expected: all pass.

**Step 5: Commit**

```bash
git add frontend/src/components/collections/CollectionsSidebar.tsx
git commit -m "fix(frontend): show row-level spinner for collection tree loading"
```

### Task 3: Final verification

**Files:**
- Verify only

**Step 1: Write the failing test**

No new tests.

**Step 2: Run full frontend checks**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s test`
- `cd frontend && yarn -s build`

Expected: all green.

**Step 3: Write minimal implementation**

Only apply fixes if regression appears.

**Step 4: Re-run checks**

Run same commands.

**Step 5: Commit**

```bash
# only if regression fixes were required
git add -A
git commit -m "chore(frontend): finalize non-blocking collection tree loading verification"
```
