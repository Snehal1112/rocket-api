# Request Row Polish — Design

**Date:** 2026-03-02
**Status:** Approved

## Goal

Improve the visual look and feel of request rows in the collections sidebar to match the quality of Postman/Bruno, and add a More (`...`) dropdown with Rename and Delete actions.

---

## Section 1: Request Row Visual Polish

### Changes to `renderTreeNode` (request branch) in `CollectionsSidebar.tsx`

**Method pill** — replace the plain text label with a colored chip:

| Method | Classes |
|--------|---------|
| GET    | `bg-blue-100 text-blue-700` |
| POST   | `bg-green-100 text-green-700` |
| PUT    | `bg-yellow-100 text-yellow-700` |
| DELETE | `bg-red-100 text-red-700` |
| PATCH  | `bg-purple-100 text-purple-700` |
| other  | `bg-gray-100 text-gray-600` |

Pill markup: `<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded w-[42px] text-center shrink-0 {color classes}">`

**Remove the `FileText` icon** — it adds visual noise with no utility.

**Name** — always `text-foreground` (remove muted default and hover transition).

**Active state** — when `node.path` matches the active tab's `filePath` in `useTabsStore`, apply:
- `border-l-2 border-primary` on the row
- `bg-accent/60` background

**More (`...`) button** — `MoreHorizontal` icon, `h-6 w-6`, floated right, `opacity-0 group-hover:opacity-100 transition-opacity`, `e.stopPropagation()` on click.

---

## Section 2: More Dropdown, Rename Dialog, Delete

### More dropdown

Uses shadcn `DropdownMenu`. Items:
- **Rename** — normal style
- **Delete** — destructive style (red text)

### Rename flow

1. Clicking Rename sets `renameDialog: { isOpen: true, node }` and `renameValue: node.name`
2. A `Dialog` opens (same pattern as Create Collection dialog) with a text input pre-filled with `renameValue`
3. On confirm:
   - Call `apiService.getRequest(collection.name, node.path)` to get the current BruFile
   - Set `bruFile.meta.name = renameValue`
   - Call `apiService.saveRequest(collection.name, node.path, bruFile)`
   - Call `fetchCollectionTree(collection.name)` to refresh the sidebar
4. On cancel: close dialog, no changes

### Delete flow

1. Clicking Delete opens the existing `AlertDialog` with a confirmation message
2. On confirm:
   - Call `apiService.deleteRequest(collection.name, node.path)`
   - Call `fetchCollectionTree(collection.name)`
3. If the deleted request is open in a tab, that tab remains open (user closes manually — out of scope)

### New local state

```ts
const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; node: TreeNode | null }>({
  isOpen: false,
  node: null,
})
const [renameValue, setRenameValue] = useState('')
```

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/collections/CollectionsSidebar.tsx` | Polish request rows, add More dropdown, add Rename dialog and Delete wiring |
