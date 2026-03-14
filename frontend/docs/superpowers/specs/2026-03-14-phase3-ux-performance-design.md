# Phase 3: UX & Performance Design Spec

## Overview

Four improvements to the Rocket API frontend: skeleton loaders, responsive sidebar, tree virtualization, and tree keyboard navigation. Implementation order reflects dependencies — skeletons and sidebar are independent, virtualization provides the flat tree model that keyboard navigation consumes.

## Implementation Order

1. Skeleton loaders (independent)
2. Responsive sidebar (independent)
3. Tree flattening + virtualization (foundation)
4. Tree keyboard navigation (depends on #3)

---

## 1. Skeleton Loaders

### Skeleton Primitive

**File:** `src/components/ui/skeleton.tsx`

A styled div matching shadcn/ui conventions:

```tsx
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}
```

### Loading States

**Collections list skeleton** (replaces `Loader2` spinner gated by `isCollectionsLoading`):
- 4-5 rows, each: circle (16px, folder icon) + rectangle (collection name) + small rectangle (24px, count badge).
- Use a fixed set of cycling Tailwind widths (`w-24 w-32 w-36 w-28 w-32`) rather than runtime `Math.random()` to avoid hydration issues.
- Wrapped in same padding/spacing as real collection rows for zero layout shift.

**Collection tree skeleton** (replaces inline spinner gated by `isCollectionTreeLoading`):
- 6-8 rows with alternating indentation (0px, 0px, 16px, 16px, 32px, 16px, 0px, 16px) to suggest folder hierarchy.
- Each row: small chevron placeholder (12px) + circle (14px, icon) + rectangle using fixed cycling widths (`w-20 w-28 w-24 w-32 w-20 w-28 w-24 w-32`).

**History list skeleton** (replaces "Loading history..." spinner gated by `historyLoading`):
- 5 rows, each: small rectangle (36px, method badge) + circle (8px, status dot) + long rectangle (140-200px, URL) + small rectangle (60px, timestamp).

### Existing Skeleton Migration

Migrate the existing `CollectionOverview.tsx` manual `animate-pulse` divs to use the new `<Skeleton>` primitive for consistency.

---

## 2. Responsive Sidebar

### Layout States

| State | Condition | Sidebar Width | Behavior |
|-------|-----------|---------------|----------|
| Expanded | Wide screen (>768px), not collapsed | User-set (220-520px) | Full sidebar with tree, filter, tabs. Resizable drag handle. |
| Icon Rail | Collapsed manually OR screen <768px | 48px | Icons for Collections/History. Expand chevron at bottom. |
| Overlay | Icon in rail clicked | 280px overlay | Full sidebar as overlay next to rail, backdrop dims main content. |

### New Components and Hooks

**`useMediaQuery` hook** (`src/hooks/use-media-query.ts`):
- Accepts a CSS media query string, returns boolean.
- Uses `window.matchMedia` with event listener for changes.
- Guards with `typeof window !== 'undefined'` and returns `false` as default for test/SSR environments, matching the existing `getInitialSidebarWidth()` pattern.

**`useSidebarState` hook** (extracted from `WorkspaceShell.tsx`):
- Manages: `isCollapsed` (boolean, persisted to localStorage), `isOverlayOpen` (boolean, transient), `overlayTab` (`'collections' | 'history'`, transient), `sidebarWidth` (number, persisted).
- Reads `useMediaQuery('(max-width: 768px)')` to auto-collapse.
- Exposes: `toggle()`, `openOverlay(tab: 'collections' | 'history')`, `closeOverlay()`, `setSidebarWidth()`.
- When `openOverlay` is called while the overlay is already open with a different tab, it switches the tab without closing/reopening.

### Changes to Existing Files

**`WorkspaceShell.tsx`:**
- Add `position: relative` to the shell container to support absolute overlay positioning.
- Replace inline sidebar width state with `useSidebarState` hook.
- Conditionally render `<SidebarRail>` or full `<CollectionsSidebar>` based on `isCollapsed`.
- Add overlay rendering (sidebar + backdrop) when `isOverlayOpen`.
- Add `Ctrl+B` keyboard shortcut listener via `useEffect`. Must check `event.target` to skip when focus is inside Monaco Editor to avoid conflicting with the editor's bold shortcut.

**`CollectionsSidebar.tsx`:**
- No changes to sidebar internals — it renders the same regardless of how it's hosted (inline or overlay).
- Remove the `width` prop. The `<aside>` element drops its `style={{ width }}` and uses `w-full` instead. The parent container (expanded lane or overlay container) controls the width.
- Accept an optional `initialTab` prop so the overlay can open to the correct tab. Used as the `useState` initializer: `useState(initialTab ?? 'collections')`, not via `useEffect`.

### SidebarRail Component

**File:** `src/components/layout/SidebarRail.tsx`

- 48px wide, full height.
- Icon buttons: Collections (folder icon), History (clock icon).
- Each icon click calls `openOverlay('collections')` or `openOverlay('history')`.
- Expand chevron at bottom calls `toggle()`.
- Active tab icon has subtle highlight (matching current tab indicator style).

### Overlay Behavior

- Rendered as `position: absolute` within the shell container (which has `position: relative`). No portal needed.
- Positioned at `left: 48px` (next to the rail), `top: 0`, full height.
- Width: 280px, with drop shadow for depth.
- Backdrop: semi-transparent div covering the main content area, click to dismiss.
- Escape key dismisses.
- Transition: slide-in from left, 150ms ease-out.

### Persistence

- `isCollapsed` saved to `localStorage` key `rocket-api:sidebar-collapsed` (define as a named constant `SIDEBAR_COLLAPSED_STORAGE_KEY` alongside existing `SIDEBAR_WIDTH_STORAGE_KEY`).
- Existing `rocket-api:sidebar-width` key continues to store expanded width.
- On wide screen load: restore collapsed state from localStorage.
- On narrow screen load: always start collapsed regardless of stored state.

---

## 3. Tree Flattening + Virtualization

### Type Consolidation

`CollectionsSidebar.tsx` defines a local `TreeNode` interface that is structurally identical to `CollectionNode` from `@/lib/api`. Remove the local `TreeNode` alias and import `CollectionNode` from `@/lib/api` directly throughout `CollectionsSidebar`.

### Flat Tree Model

**`useFlatTree` hook** (`src/hooks/use-flat-tree.ts`):

Input:
- `tree: CollectionNode` — nested tree root for the active collection (single collection's subtree, not all collections)
- `expandedPaths: Set<string>` — set of expanded folder paths

Output:
- `flatTree: FlatTreeNode[]` — flat array of visible nodes

```ts
interface FlatTreeNode {
  node: CollectionNode
  depth: number
  parentIndex: number | null
  isExpanded: boolean
  path: string
  isFolder: boolean
  siblingCount: number   // aria-setsize
  positionInSet: number  // aria-posinset (1-based)
}
```

Algorithm:
- Depth-first traversal of the nested tree.
- Only descend into children of folders whose path is in `expandedPaths`.
- Track parent index for keyboard navigation (Arrow Left to parent).
- Compute `siblingCount` and `positionInSet` during traversal by tracking children count at each folder level.
- Memoized with `useMemo` — recomputes only when `tree` or `expandedPaths` identity changes.

### Expanded State Management

The sidebar currently has two expand-related state variables:
1. `expandedCollectionId: string | null` — which collection is open (top-level accordion). **This stays as-is.** The collection-level accordion is not part of the tree virtualizer — it sits above it.
2. `expandedFolders: Set<string>` — which folders within the active collection are expanded. **This is renamed to `expandedPaths`** and moved to the scope consumed by `useFlatTree`.

- `toggleExpand(path: string)` — adds or removes from set.
- Initial state: empty set (all collapsed).
- When switching collections (i.e., `expandedCollectionId` changes), clear `expandedPaths`.
- The existing `useEffect` hooks that auto-expand folders to reveal the active request must be updated to write into `expandedPaths` instead of the old `expandedFolders`.

### Virtualized Rendering

**Library:** `@tanstack/react-virtual` (new dependency)

**Scope:** The virtualizer applies only to the tree rows inside the expanded collection, not to the collection-level list. The top-level collection list (accordion headers like "Lockstep-Inbox (454)") is rendered normally outside the virtualizer. Only when a collection is expanded does its tree content render through the virtualizer.

In `CollectionsSidebar.tsx`:

```tsx
const virtualizer = useVirtualizer({
  count: flatTree.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 32, // fixed row height for tree items
  overscan: 10,
})
```

- Replace `collectionTree.children.map(child => renderTreeNode(...))` with virtualizer items.
- Each virtual row calls `renderFlatRow(flatTree[virtualItem.index])`.
- `renderFlatRow` is a non-recursive function — reads `depth` for `paddingLeft`, renders icon + name + context menu.
- Indentation: `paddingLeft: 12 + (depth * 16)` pixels.

**Note:** The History tab is not virtualized in this spec. History rows are taller (~64px) and have different structure. Virtualizing history is a separate concern.

### What Changes

- `renderTreeNode()` recursive function removed.
- Replaced by `renderFlatRow()` flat function.
- Scroll container gets a `ref` for the virtualizer.
- Visual appearance of each row is identical to current.

### What Stays the Same

- Collection-level accordion (expand one collection at a time).
- Context menus on each row.
- Chevron rotation on folders.
- Active request highlighting.
- All existing click handlers.

---

## 4. Tree Keyboard Navigation

### useTreeKeyboard Hook

**File:** `src/hooks/use-tree-keyboard.ts`

Input:
- `flatTree: FlatTreeNode[]` — from `useFlatTree`
- `expandedPaths: Set<string>` — for expand/collapse
- `toggleExpand: (path: string) => void`
- `onActivate: (node: CollectionNode) => void` — open request or toggle folder
- `virtualizer` — for `scrollToIndex`

State:
- `focusedIndex: number` — index into flat tree of currently focused item
- Reset to 0 whenever `flatTree` identity changes (collection switch, expand/collapse that changes the array).

Returns:
- `onKeyDown: (e: KeyboardEvent) => void` — attach to tree container
- `focusedIndex: number` — for styling and ARIA

### Key Bindings

| Key | Action |
|-----|--------|
| ArrowDown | `focusedIndex = min(focusedIndex + 1, flatTree.length - 1)` |
| ArrowUp | `focusedIndex = max(focusedIndex - 1, 0)` |
| ArrowRight | Folder collapsed: `toggleExpand(path)`. Folder expanded: `focusedIndex = focusedIndex + 1` (first child). Request: no-op. |
| ArrowLeft | Folder expanded: `toggleExpand(path)` (collapse). Folder collapsed or request node: if `parentIndex !== null`, `focusedIndex = parentIndex` (move to parent). If `parentIndex === null` (top-level node): no-op. |
| Home | `focusedIndex = 0` |
| End | `focusedIndex = flatTree.length - 1` |
| Enter | `onActivate(flatTree[focusedIndex].node)` |
| Space | If folder: `toggleExpand(path)`. If request: `onActivate(node)`. |

### Type-Ahead

- Buffer: string, cleared after 500ms of no typing (via `setTimeout`).
- On printable character: append to buffer, search forward from `focusedIndex + 1` (wrapping) for first node whose `node.name` starts with buffer (case-insensitive).
- If match found: `focusedIndex = matchIndex`.
- The timeout ref must be cleaned up on unmount and when `flatTree` changes to prevent stale callbacks.

### ARIA Attributes

Applied in `renderFlatRow`:

```tsx
// Tree container
<div role="tree" aria-label="Collection tree">

// Each row
<div
  role="treeitem"
  aria-level={depth + 1}
  aria-expanded={isFolder ? isExpanded : undefined}
  aria-selected={isActive}
  aria-setsize={siblingCount}
  aria-posinset={positionInSet}
  tabIndex={index === focusedIndex ? 0 : -1}
>
```

### Focus Management

- Roving tabindex: only the focused item has `tabIndex={0}`.
- When `focusedIndex` changes, call `virtualizer.scrollToIndex(focusedIndex)` and `element.focus()` via a ref callback or `useEffect`.
- On first Tab into the tree: focus goes to `focusedIndex` (defaults to 0 or the currently active request).
- Clicking a row sets `focusedIndex` to that row's index.

---

## File Summary

| File | Action |
|------|--------|
| `src/components/ui/skeleton.tsx` | New — skeleton primitive |
| `src/hooks/use-media-query.ts` | New — responsive media query hook |
| `src/hooks/use-flat-tree.ts` | New — tree flattening logic |
| `src/hooks/use-tree-keyboard.ts` | New — keyboard navigation + type-ahead |
| `src/components/layout/SidebarRail.tsx` | New — icon rail component |
| `src/features/workspace/components/WorkspaceShell.tsx` | Modified — sidebar state, responsive layout, overlay, Ctrl+B |
| `src/components/collections/CollectionsSidebar.tsx` | Modified — skeletons, virtualization, flat rendering, ARIA, keyboard, remove `width` prop, remove local `TreeNode` alias |
| `src/components/collections/CollectionOverview.tsx` | Modified — migrate manual pulse divs to `<Skeleton>` primitive |
| `package.json` | Modified — add `@tanstack/react-virtual` |

## Testing Strategy

**Skeleton loaders:** Visual verification — no logic to unit test.

**Responsive sidebar:**
- `src/hooks/__tests__/use-media-query.test.ts` — mock `window.matchMedia`, test listener attach/detach, test SSR guard.
- `src/hooks/__tests__/use-sidebar-state.test.ts` — toggle, auto-collapse on narrow screen, localStorage persistence, overlay open/close/tab switching.

**Tree virtualization:**
- `src/hooks/__tests__/use-flat-tree.test.ts` — correct flattening, respects expanded set, sibling count and position computation, memoization, empty tree edge case.

**Keyboard navigation:**
- `src/hooks/__tests__/use-tree-keyboard.test.ts` — all key bindings, type-ahead buffer and cleanup, focus index management, edge cases (first/last item, empty tree, parentIndex null, collection switch reset).

**Test environment note:** Tests for `useMediaQuery` and `useSidebarState` require a `window.matchMedia` mock. Add to `src/test/setup.ts` if not already present.
