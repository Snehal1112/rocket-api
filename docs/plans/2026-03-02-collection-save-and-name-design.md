# Collection Save & Request Name Design

**Date**: 2026-03-02
**Status**: Approved

## Problem

Three related bugs in the collection + tab-name flow:

1. **Save creates duplicates** — `saveActiveTab` always passes `path: undefined` to the API.
   The backend falls back to `name.bru`, so saving an existing request creates a new file
   instead of updating the original.

2. **`filePath` not persisted after first save** — even after saving a new request successfully,
   the tab's `filePath` is never set, so every subsequent save creates another new file.

3. **No way to edit the request name** — `updateActiveName` does not exist in the store,
   there is no name input in the UI, and the name is never flushed before saving.
   New tabs are permanently "Untitled Request".

## Fix Design

### Section 1: Save path fix (`tabs-store.ts` — `saveActiveTab`)

Fall back to `activeTab.filePath` when no explicit path is passed:

```typescript
const effectivePath = path ?? activeTab.filePath
const result = await apiService.saveRequest(collectionName, effectivePath, bruFile)
```

After a successful save, update `filePath`, `collectionName`, and `isDirty` in one atomic set
(replaces the old `markActiveTabSaved()` call):

```typescript
set(state => ({
  tabs: state.tabs.map(t =>
    t.id === activeTabId
      ? { ...t, isDirty: false, filePath: result.path, collectionName }
      : t
  ),
}))
```

### Section 2: `updateActiveName` store action (`tabs-store.ts`)

New action — same pattern as `updateActiveUrl`:

```typescript
updateActiveName: (name: string) => void

// implementation
updateActiveName: (name) =>
  set(state => ({
    tabs: state.tabs.map(t =>
      t.id === state.activeTabId
        ? { ...t, request: { ...t.request, name }, isDirty: true }
        : t
    ),
  })),
```

### Section 3: Name field in `RequestBuilder.tsx`

**3a** — Add `name` to local state and sync it in the existing sync effect:
```typescript
const [name, setName] = useState('Untitled Request')
// inside sync useEffect:
setName(currentRequest.name)
```

**3b** — Slim underlined name input above the method/URL row:
```tsx
<div className="px-4 pt-2 pb-0">
  <Input
    value={name}
    onChange={(e) => { setName(e.target.value); updateActiveName(e.target.value) }}
    placeholder="Untitled Request"
    className="h-7 text-sm font-medium border-0 border-b border-transparent
               hover:border-border focus:border-primary rounded-none bg-transparent
               px-0 focus-visible:ring-0 shadow-none"
  />
</div>
```

**3c** — Flush `name` in `handleSaveRequest` before calling `saveActiveTab`:
```typescript
updateActiveName(name)
```

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/store/tabs-store.ts` | Fix `saveActiveTab` path + add `updateActiveName` |
| `frontend/src/components/request-builder/RequestBuilder.tsx` | Add name local state, sync, UI input, flush |
