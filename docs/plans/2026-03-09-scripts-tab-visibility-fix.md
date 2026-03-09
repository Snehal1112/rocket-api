# Scripts Tab Visibility Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent the Language selector and script editors from rendering visibly when the Scripts tab is inactive.

**Architecture:** Add `data-[state=inactive]:hidden` to the Scripts `TabsContent` in `RequestBuilderTabs.tsx`. Radix UI sets `data-state="inactive"` on hidden panels; this Tailwind variant maps that to `display: none`. The existing `forceMount` prop stays in place so Monaco editors remain mounted and don't lose state on tab switch.

**Tech Stack:** React, TypeScript, Tailwind CSS, Radix UI Tabs (via shadcn/ui), Vitest + Testing Library

---

### Task 1: Fix Scripts tab visibility

**Files:**
- Modify: `frontend/src/components/request-builder/RequestBuilderTabs.tsx:490`

**Step 1: Open the file and locate line 490**

The line reads:
```tsx
<TabsContent value="scripts" className="mt-0 h-full" forceMount>
```

**Step 2: Update the className**

Change to:
```tsx
<TabsContent value="scripts" className="mt-0 h-full data-[state=inactive]:hidden" forceMount>
```

**Step 3: Run existing tests to verify nothing is broken**

```bash
cd frontend && yarn test src/components/request-builder/RequestBuilderTabs.test.tsx --reporter=verbose
```

Expected: all tests PASS (the test suite covers script pane rendering and `setScripts` callbacks).

**Step 4: Commit**

```bash
git add frontend/src/components/request-builder/RequestBuilderTabs.tsx
git commit -m "fix(frontend): hide scripts tab content when inactive"
```
