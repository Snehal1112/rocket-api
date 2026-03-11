# Script Write-back Idempotency Design

## Summary

The send flow currently re-submits collection-variable saves even when a
script only changes an environment variable. The captured network
traffic shows repeated identical `POST /api/v1/collections/:name/variables`
requests with the unchanged collection-variable payload.

This design makes script write-back a one-pass, idempotent reconciliation
step so environment-only mutations do not trigger collection saves, and
collection-variable saves happen at most once per send for actual diffs.

## Current Problem

After `POST /api/v1/requests/send` completes,
`useRequestBuilderState.ts` merges script-written variables and writes
them back into frontend-managed environment or collection state.

The reported request trace shows:

- repeated `POST /api/v1/environments`
- repeated `POST /api/v1/collections/:name/variables`
- identical collection-variable payloads across those repeated posts

That means the frontend is not only over-refreshing. It is also
replaying the same persistence actions multiple times from one send
lifecycle.

## Root Cause

The script write-back path currently persists variables incrementally by
looping over script results and calling `handleSaveUrlVariable()` for
each key. That makes persistence vulnerable to:

- overlapping state updates while the send flow is still active
- repeated re-entry with stale snapshots
- collection-variable saves being re-issued even when values did not
  change

The write-back logic is doing "save as it iterates" instead of
"reconcile once, then persist diffs."

## Goals

- Persist only real variable changes after one send.
- Prevent repeated identical collection-variable saves from one send.
- Prevent collection-variable saves when the script only changed
  environment variables.
- Preserve current request/response and history behavior.

## Non-Goals

- Redesign the scripting runtime.
- Change `pm.environment.set(...)` or `pm.variables.set(...)` semantics.
- Add backend dedupe or transactional batching.

## Recommended Approach

### 1. Reconcile script changes once per send

After receiving the response, gather all script-written variables into a
single map and resolve them against the current store snapshot exactly
once.

Do not persist inside a per-variable loop with side effects on every
iteration.

### 2. Split environment and collection write-back paths

Classify each script-written key into one of:

- existing active environment variable
- existing collection variable
- new environment variable when an active environment exists
- new collection variable when no active environment exists

Build the final target state for each bucket before issuing saves.

### 3. Persist only diffs

Before saving:

- compare the proposed environment variables to current
  `activeEnvironment.variables`
- compare the proposed collection variables to current
  `collectionVariables`

If there is no real diff, skip the save entirely.

This ensures environment-only script mutations do not trigger collection
variable writes.

### 4. Make collection-variable save idempotent within one send

Guard the send lifecycle so the same logical collection-variable payload
cannot be posted repeatedly during the same send.

The minimal acceptable form is:

- compute the final payload once
- compare it to the latest store snapshot
- call `saveCollectionVariables()` at most once for that payload

## Expected Request Pattern

For the reported request where the script uses:

```js
pm.environment.set("userLength", 1001)
```

the frontend should produce:

- one `GET /health`
- one `POST /api/v1/requests/send`
- one `GET /api/v1/history?limit=50`
- at most one `POST /api/v1/environments`
- zero `POST /api/v1/collections/:name/variables`

For a request that uses `pm.variables.set(...)` to change a collection
variable:

- at most one `POST /api/v1/collections/:name/variables`
- no repeated identical collection-variable posts

## Error Handling

Existing send error behavior remains unchanged.

If one persistence path fails:

- the failure should surface as it does today
- the other path should not retry blindly
- repeated saves must not be used as accidental recovery behavior

## Testing

Add focused tests for:

- environment-only script mutation skips collection-variable save
- collection-only script mutation saves collection variables exactly once
- unchanged collection-variable values skip save
- unchanged environment values skip save
- repeated internal re-entry does not resubmit identical collection
  payloads

Manual verification should repeat the exact captured request and confirm
that repeated `POST /collections/:name/variables` traffic disappears.
