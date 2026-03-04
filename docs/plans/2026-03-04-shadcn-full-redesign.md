# Shadcn Full UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the app look and feel with shadcn-style visual consistency across shell, sidebar, tabs, request builder, and dialogs, with equal quality in light and dark themes.

**Architecture:** Use token-driven theming (`globals.css`) and shadcn primitives to refactor visual structure while preserving behavior. Apply changes in slices (tokens -> shell/sidebar -> tabs -> request panels), validating after each slice.

**Tech Stack:** React, TypeScript, Tailwind, shadcn/ui components, next-themes, Yarn, ESLint, Vitest

---

### Task 1: Theme token refresh (light/dark parity)

**Files:**
- Modify: `frontend/src/globals.css`

**Step 1: Write the failing test**

No direct unit tests; establish visual token baseline and compile checks.

**Step 2: Run baseline checks**

Run: `cd frontend && yarn -s lint`
Expected: PASS before edits.

**Step 3: Write minimal implementation**

- Update semantic color tokens for both themes with same brand hue family.
- Keep accessibility-friendly contrast.
- Preserve existing token names to avoid functional breakage.

**Step 4: Run verification**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s build`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/globals.css
git commit -m "style(frontend): refresh theme tokens for light-dark parity"
```

### Task 2: App shell and sidebar visual refactor

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/collections/CollectionsSidebar.tsx`

**Step 1: Write the failing test**

No dedicated UI snapshot tests currently; rely on lint/build + smoke behavior checks.

**Step 2: Run baseline checks**

Run: `cd frontend && yarn -s lint`
Expected: PASS before edits.

**Step 3: Write minimal implementation**

- Restyle header and background surfaces.
- Improve sidebar grouping, row spacing, hover/active states, icon rhythm.
- Keep existing click handlers and state logic unchanged.

**Step 4: Run verification**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s test`
- `cd frontend && yarn -s build`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/collections/CollectionsSidebar.tsx
git commit -m "style(frontend): redesign shell and collections sidebar with shadcn surfaces"
```

### Task 3: Request tabs redesign

**Files:**
- Modify: `frontend/src/components/request-builder/RequestTabs.tsx`

**Step 1: Write the failing test**

No tab UI tests available; use lint/build and behavioral smoke checks.

**Step 2: Run baseline checks**

Run: `cd frontend && yarn -s lint`
Expected: PASS.

**Step 3: Write minimal implementation**

- Refine tab container, active state, dirty dot visibility, close affordance.
- Keep tab activation/close behavior unchanged.

**Step 4: Run verification**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s test`
- `cd frontend && yarn -s build`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/components/request-builder/RequestTabs.tsx
git commit -m "style(frontend): refresh request tabs visual hierarchy"
```

### Task 4: Request builder/response panel polish

**Files:**
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx`
- Modify (if needed): shared ui wrappers in `frontend/src/components/ui/*`

**Step 1: Write the failing test**

No dedicated visual tests; rely on lint/test/build and manual smoke behavior.

**Step 2: Run baseline checks**

Run: `cd frontend && yarn -s lint`
Expected: PASS.

**Step 3: Write minimal implementation**

- Normalize section surfaces with tokenized cards and spacing.
- Improve input/button group rhythm and readability.
- Preserve request send/save logic.

**Step 4: Run verification**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s test`
- `cd frontend && yarn -s build`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/components/request-builder/RequestBuilder.tsx frontend/src/components/ui
git commit -m "style(frontend): polish request builder and response panel surfaces"
```

### Task 5: Final QA pass and regression safety

**Files:**
- Verify only

**Step 1: Write the failing test**

No new tests.

**Step 2: Run full checks**

Run:
- `cd frontend && yarn -s lint`
- `cd frontend && yarn -s test`
- `cd frontend && yarn -s build`

Expected: all PASS.

**Step 3: Write minimal implementation**

Fix only regressions found in verification.

**Step 4: Re-run checks**

Run same commands until stable.

**Step 5: Commit**

```bash
# only if fixes were needed
git add -A
git commit -m "chore(frontend): finalize shadcn redesign verification"
```
