# Non-Blocking Collection Tree Loading Design

## Context
The collections sidebar currently uses a single global loading state. Clicking a collection to load its tree can show a blocking loading mask over the sidebar, which interrupts navigation.

## Goal
Keep the sidebar interactive during tree loading, and show loading only at the selected collection row.

## Decision
Split loading states in the collections store:
- `isCollectionsLoading` for collection list fetch
- `isCollectionTreeLoading` for selected tree fetch

Use a small row-level spinner for the selected collection while tree loads.

## UX Contract
- Initial collection list load: full content area loader is acceptable.
- Tree load on collection click: no full-mask blocking.
- While tree is loading for active collection, show spinner next to that collection row.
- Existing expand/select/open-tab behavior remains unchanged.

## Technical Design
- Update `frontend/src/store/collections.ts`:
  - replace single `isLoading` with two flags
  - `fetchCollections` toggles only `isCollectionsLoading`
  - `fetchCollectionTree` toggles only `isCollectionTreeLoading`
  - create/delete/import flows use `isCollectionsLoading`

- Update `frontend/src/components/collections/CollectionsSidebar.tsx`:
  - use `isCollectionsLoading` for full list loading condition
  - show inline `Loader2` in active collection row when `isCollectionTreeLoading` is true

## Acceptance Criteria
- Clicking collection does not replace the whole sidebar with spinner.
- Selected collection row shows inline spinner while tree loads.
- Lint/tests/build remain green.
