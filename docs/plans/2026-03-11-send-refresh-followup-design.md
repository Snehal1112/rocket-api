# Send Refresh Follow-up Design

## Summary

Clicking `Send` for a request with a `post-response` script still causes
an excessive burst of follow-up reads even when the script writes only
one variable. The issue is not repeated script execution. The issue is
overlapping frontend refresh ownership combined with persistence paths
that reload broader environment state than the single variable update
requires.

This design keeps the existing send flow as the owner of send-side
updates, trims overlapping effect-driven refreshes, and reduces
environment refresh fan-out after a script-driven variable save.

## Observed Behavior

For one send action, the frontend legitimately performs:

- `GET /health`
- `POST /api/v1/requests/send`
- `GET /api/v1/history?limit=50`

The unexpected part is the repeated burst of:

- `GET /api/v1/environments`
- `GET /api/v1/environments?collection=:name`
- `GET /api/v1/environments?collection=:name&name=:env`
- `GET /api/v1/collections/:name/variables`
- `GET /api/v1/collections`
- `GET /api/v1/collections/:name`

With only one script-written variable, this traffic is disproportionately
high and indicates repeated refresh reactions rather than required work.

## Root Cause

The current send flow in
`frontend/src/components/request-builder/useRequestBuilderState.ts`
does the right top-level work:

- set the active tab response
- refresh history
- persist script-mutated variables

But multiple other UI paths also reload related data when the same state
changes ripple through the app:

- `frontend/src/App.tsx`
- `frontend/src/components/collections/CollectionsSidebar.tsx`
- `frontend/src/components/collections/CollectionOverview.tsx`

In addition, persisting one environment-backed variable currently calls
`saveEnvironment()`, which reloads the full environment list again. That
reload is broader than the immediate change requires and becomes noisy
when combined with the overlapping component effects.

## Goals

- Keep the send path explicit and easy to reason about.
- Reduce refresh fan-out after a single send.
- Preserve visible behavior for request response, history, and variable
  editing.
- Add regression coverage around duplicate read suppression.

## Non-Goals

- Rebuild frontend state management.
- Introduce long-lived caching.
- Change script semantics or variable precedence.

## Recommended Approach

### 1. Keep a single owner for send-side refresh

`useRequestBuilderState.ts` remains responsible for:

- sending the request
- refreshing history once after send
- saving script-mutated variables

No other mounted component should refetch the same collection or history
data as a generic reaction to that send lifecycle.

### 2. Keep one owner for collection tree loading

`CollectionsSidebar.tsx` should remain the primary owner for fetching the
active collection tree when `activeCollection` changes. `App.tsx` should
restore active collection context from the current tab, but should not
also become a second collection-tree refresh owner.

`CollectionOverview.tsx` should rely on store-owned data instead of
mount-time unconditional refetches when the same data is already kept
fresh elsewhere.

### 3. Narrow environment refresh after one variable save

For script-driven variable persistence, saving one variable should not
cause a broad environment reload unless that reload is necessary to keep
UI state correct.

Preferred order:

1. update store state locally when the saved environment is already
   available
2. fall back to a full environment reload only when local consistency
   cannot be maintained safely

This keeps the UI correct while avoiding a collection-wide refresh for a
single changed key.

### 4. Keep in-flight dedupe as a guardrail

Store-level in-flight dedupe for collection tree, environments,
collection variables, and history should stay in place so concurrent
identical reads collapse into one backend call.

## Expected Request Pattern

For one send with one script-written variable, the steady-state target
is:

- one `GET /health`
- one `POST /api/v1/requests/send`
- one `GET /api/v1/history?limit=50`
- only the minimum persistence follow-up needed for that one variable

Repeated collection/environment/history bursts should not happen.

## Testing

Add or keep regression tests for:

- collection store read dedupe
- history store read dedupe
- request-builder send flow behavior where practical

Manual verification should repeat the reported scenario and confirm that
the network panel no longer shows repeated environment, collection, and
variable refresh bursts from one send.
