# Collection vs Folder Icon Differentiation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make collection rows visually distinct from folder rows by using a different icon for collections in the sidebar.

**Architecture:** Keep behavior unchanged and limit the implementation to a presentational icon swap in the collections sidebar component. Validate with lint/build/tests to ensure no regressions.

**Tech Stack:** React, TypeScript, Lucide icons, Yarn, ESLint, Vitest

---

### Task 1: Add a focused UI test/assertion baseline

**Files:**
- Modify: `frontend/src/components/collections/CollectionsSidebar.tsx` (no behavior change yet)
- Optional Test (if existing suite available): `frontend/src/components/collections/__tests__/CollectionsSidebar.test.tsx`

**Step 1: Write the failing test**

If sidebar tests exist, add assertion that collection rows render `Database` icon while folder rows render folder icons.

**Step 2: Run test to verify it fails**

Run: `cd frontend && yarn -s test src/components/collections --run`
Expected: FAIL for icon assertion (or skip if no sidebar tests exist yet).

**Step 3: Write minimal implementation**

No implementation in this task.

**Step 4: Run test to confirm red state**

Run same command.
Expected: red state only for the new assertion.

**Step 5: Commit**

```bash
git add frontend/src/components/collections/__tests__/CollectionsSidebar.test.tsx
git commit -m "test(frontend): cover collection vs folder icon differentiation"
```

### Task 2: Implement collection icon swap

**Files:**
- Modify: `frontend/src/components/collections/CollectionsSidebar.tsx`

**Step 1: Write the failing test**

Use Task 1 baseline (if present).

**Step 2: Run test to verify it fails**

Run: `cd frontend && yarn -s test src/components/collections --run`
Expected: FAIL before icon swap.

**Step 3: Write minimal implementation**

- Import `Database` from `lucide-react`
- Replace collection row icon instances (currently folder-style icons) with `Database`
- Keep folder node icon rendering untouched

**Step 4: Run test to verify it passes**

Run: `cd frontend && yarn -s test src/components/collections --run`
Expected: PASS (or N/A if sidebar tests do not exist).

**Step 5: Commit**

```bash
git add frontend/src/components/collections/CollectionsSidebar.tsx
git commit -m "feat(frontend): differentiate collection icon from folder icon"
```

### Task 3: Verification and regression checks

**Files:**
- Verify only

**Step 1: Write the failing test**

No new tests.

**Step 2: Run quality checks**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s test`
- `cd frontend && yarn -s build`

Expected: all commands pass.

**Step 3: Write minimal implementation**

Apply only regression fixes if found.

**Step 4: Re-run verification**

Run same commands until stable.

**Step 5: Commit**

```bash
# only if verification fixes are needed
git add -A
git commit -m "chore(frontend): finalize icon differentiation verification"
```
