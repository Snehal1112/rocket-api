# Frontend Architecture Migration Design

## Summary

Rocket's frontend should move from app-centered orchestration toward a
route-driven, feature-owned architecture closer in spirit to
`e4a-manage`.

The target design keeps Rocket's current product behavior and `HashRouter`
deployment model, but changes ownership boundaries:

- routing becomes the primary source of active workspace context
- feature modules own their screens, server data access, and
  orchestration
- app shell code becomes layout composition only
- central Zustand stores shrink to UI-local state instead of acting as
  the default home for feature logic

This migration is intentionally incremental and should be delivered over
multiple low-risk PRs with a compatibility layer during the transition.

## Current Problem

Rocket's frontend currently concentrates too much behavior in a small
number of modules:

- `frontend/src/App.tsx` coordinates layout, websocket refreshes,
  collection context restoration, request-builder entry, and shell UI
- `frontend/src/store/collections.ts` carries collection list state,
  collection tree state, environment state, collection-variable state,
  local persistence, and refresh orchestration
- `frontend/src/store/history.ts` and
  `frontend/src/store/tabs-store.ts` also mix UI concerns with
  navigation and data-loading behavior
- route structure is shallow, while most screen switching happens in
  store state and component conditionals rather than through URLs

That creates several architectural costs:

- `App.tsx` is an orchestration hotspot
- features are harder to reason about in isolation
- route-based deep linking is limited
- tests often need large app context for feature behavior
- cross-feature state coupling makes performance and refresh work harder
  to control

## Reference Analysis: `e4a-manage`

`e4a-manage` is not a drop-in blueprint, but it demonstrates the
architectural properties Rocket should adopt:

- route definitions are nested and feature-oriented
- shell composition is separate from feature screens
- cross-cutting providers are narrow and explicit
- feature-local API modules keep server access close to the feature
- app bootstrap is thin compared to feature modules

Rocket should borrow those structural ideas without copying its exact
libraries or enterprise feature model.

## Goals

- Make routing the primary navigation model for collection and request
  context.
- Keep `HashRouter` to avoid backend deep-link fallback changes during
  the migration.
- Split app shell concerns from feature concerns.
- Move server-backed state ownership closer to each feature.
- Reduce the amount of orchestration inside `App.tsx`.
- Preserve current product behavior while migrating incrementally.
- Keep migration compatible with ongoing feature work.

## Non-Goals

- Full rewrite of the frontend in one pass.
- Immediate replacement of every Zustand store.
- Migration to `BrowserRouter` in this phase.
- Design-system overhaul as part of the architecture work.
- Changing backend APIs solely to satisfy frontend folder structure.

## Recommended Architecture

### 1. Route-driven workspace context

Rocket should derive active workspace context from the route first.

Target route shape:

- `#/`
- `#/collections/:collectionName`
- `#/collections/:collectionName/requests/*requestPath`
- `#/collections/:collectionName/history`
- `#/collections/:collectionName/settings`
- `#/*`

That means:

- active collection comes from route params
- active request comes from route params
- tabs become a UX layer synchronized with routes rather than the
  primary source of navigation truth

`HashRouter` remains the correct choice for this project now because it
avoids server deep-link fallback requirements and does not introduce a
security disadvantage relative to `BrowserRouter`.

### 2. Thin app shell

Introduce a dedicated workspace shell component that owns only shell
composition:

- app header
- sidebar region
- main content outlet
- console panel
- resize state
- theme controls

The shell should not own feature fetching, feature refresh behavior, or
request execution logic.

### 3. Feature-owned modules

Each feature should own:

- route fragments
- API/data access
- feature-specific hooks
- view components
- feature-local orchestration

Proposed top-level structure:

- `frontend/src/app/`
- `frontend/src/features/workspace/`
- `frontend/src/features/collections/`
- `frontend/src/features/request-builder/`
- `frontend/src/features/history/`
- `frontend/src/features/realtime/`
- `frontend/src/shared/`

### 4. Smaller cross-cutting state

Keep Zustand where it is still a good fit for client-local workspace
state:

- tabs
- console UI
- layout state
- other ephemeral client-only interactions

Move server-backed feature state behind feature-local hooks and services:

- collections list and collection tree
- environments and collection variables
- request loading and execution
- history
- realtime event routing

This allows the app shell and unrelated features to stop knowing
details about other features' fetch logic.

### 5. Realtime as a feature

Websocket behavior should move out of the shell and into a dedicated
realtime feature module.

Responsibilities:

- hold the websocket connection
- manage active-collection subscription
- translate incoming file-change events into feature-level invalidation
- keep self-echo suppression and similar behavior near feature owners

This keeps app shell code from becoming the default home for all
real-time behavior.

## Detailed Module Design

### `app/`

Responsibilities:

- bootstrap providers
- initialize router
- expose runtime config
- compose top-level shell route

Expected files:

- `frontend/src/app/routes.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/app/providers.tsx`
- `frontend/src/app/runtime.ts`

### `features/workspace/`

Responsibilities:

- workspace shell
- shell layout state
- route/tab synchronization
- welcome-state handling

Expected files:

- `frontend/src/features/workspace/components/WorkspaceShell.tsx`
- `frontend/src/features/workspace/hooks/useWorkspaceTabs.ts`
- `frontend/src/features/workspace/routes.tsx`

### `features/collections/`

Responsibilities:

- collection list and tree
- collection overview
- environments and collection variables
- collection route helpers
- collection mutations

Expected files:

- `frontend/src/features/collections/api/collectionsApi.ts`
- `frontend/src/features/collections/hooks/useCollections.ts`
- `frontend/src/features/collections/hooks/useCollectionTree.ts`
- `frontend/src/features/collections/hooks/useCollectionSettings.ts`
- `frontend/src/features/collections/routes.tsx`
- `frontend/src/features/collections/components/*`

### `features/request-builder/`

Responsibilities:

- request editor screen
- request loading from route
- request execution
- cURL import
- script write-back reconciliation

Expected files:

- `frontend/src/features/request-builder/api/requestExecutionApi.ts`
- `frontend/src/features/request-builder/hooks/useRequestRouteState.ts`
- `frontend/src/features/request-builder/hooks/useRequestExecution.ts`
- `frontend/src/features/request-builder/routes.tsx`
- `frontend/src/features/request-builder/components/*`

### `features/history/`

Responsibilities:

- history list and detail UI
- history fetch and mutation hooks
- history routes

### `features/realtime/`

Responsibilities:

- websocket connection lifecycle
- active-collection subscription
- event filtering and routing
- feature invalidation callbacks

## Data Flow

### Route-driven navigation

1. Router resolves current route.
2. Route params determine active collection and active request.
3. Feature route hooks load only the data required by that route.
4. Workspace shell composes the UI around the active feature route.

### Feature refresh

1. Realtime feature receives a collection-scoped event.
2. Event is translated into feature-specific refresh action.
3. The owning feature hook decides whether to refetch, update local
   state, or suppress as self-echo.
4. App shell remains uninvolved.

### Tab synchronization

1. User action navigates to a route.
2. Workspace feature updates tabs to reflect that route.
3. Restoring a tab navigates back to the associated route.
4. Tabs remain a secondary representation of navigation state.

## Compatibility Strategy

The migration should not require freezing feature work.

Use a compatibility layer:

- keep current stores operational while extracting new feature hooks
- let route handlers temporarily delegate to existing store actions
- migrate feature by feature, then delete the compatibility seams once
  a feature is fully moved

Examples:

- collection routes may initially call into `useCollectionsStore`
- request routes may initially continue using the existing tabs store
- websocket invalidation may initially call existing store actions, but
  from a new realtime module instead of from `App.tsx`

This keeps each PR reviewable and reduces regression risk.

## Migration Sequence

### Phase 1: Shell and route seams

- split `App.tsx` into bootstrap plus shell concerns
- introduce a dedicated workspace shell
- preserve current behavior

### Phase 2: Real route hierarchy

- add nested collection and request routes
- make route params the primary source for active collection/request
- keep tab compatibility during the transition

### Phase 3: Collections feature extraction

- extract collection APIs and hooks into feature-owned modules
- shrink `collections.ts`
- move collection screens under feature ownership

### Phase 4: Request-builder feature extraction

- extract request-route state and execution hooks
- move request-builder orchestration out of shell/store hotspots

### Phase 5: History and realtime extraction

- move websocket orchestration into the realtime feature
- move history behavior into feature-local modules

### Phase 6: Cleanup

- remove obsolete compatibility code
- leave only UI-local state in shared stores
- reduce `App.tsx` to bootstrap-only code

## Error Handling

Error handling should move closer to feature routes and hooks:

- route screens handle feature load failures
- mutation hooks expose feature-scoped failure state
- shell only surfaces global connection/workspace status
- realtime connection status is exposed as workspace status, not mixed
  into unrelated app logic

## Testing Strategy

The migration should improve test seams:

- route tests for collection and request routes
- shell tests for layout composition and resize behavior
- feature hook tests for collections, request-builder, history, and
  realtime
- compatibility tests during the migration to prove old and new paths
  agree

The test goal is to stop requiring full-app rendering for every feature
behavior.

## Risks

- dual navigation truth during migration if tabs and routes diverge
- over-migration of shared helpers into `shared/` without clear
  ownership
- partial feature extraction that only moves files but not
  responsibilities
- trying to replace all stores before route seams are stable

These are controlled by keeping migration incremental and ensuring each
PR changes one ownership boundary at a time.

## Success Criteria

The architecture migration is successful when:

- routes identify the active collection and request
- shell composition is separated from feature orchestration
- feature modules own their server-backed data flow
- realtime behavior is not wired through `App.tsx`
- old global stores are reduced to UI-local state or removed
- feature tests no longer need broad app context for common behavior
