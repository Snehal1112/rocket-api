# Collection Tab Selection, Save Target, and Dirty-State Design

## Goal

Fix request-tab and collection-list workflow mismatches so send/save/dirty behavior is consistent and save actions always target the actual active tab request.

## Reported Issues

1. Sending a request marks it dirty in cases where no persisted request fields changed.
2. Saving from one request tab can update the wrong request when another request is selected in the collection list.
3. Collection list selection/highlight can drift from the currently active request tab, creating ambiguity.

## Clarified Expected Behavior

- On **Send**, dirty should update only when persisted request fields actually changed.
- On **Save**, the target request file must always be the active tab's request (`tabId` + `filePath`), not sidebar selection state.
- Selecting a request tab should sync collection-list selection/highlight to that tab's request path.
- Sidebar selection is navigation/visual state only; it is not save source-of-truth.

## Approaches Considered

### 1. UI-sync only

Sync sidebar highlight with active tab but keep existing save/dirty logic.

Pros:
- Fast and small change.

Cons:
- Risky: does not fully solve incorrect save targeting and dirty semantics.

### 2. Tab-scoped source-of-truth (recommended)

Use active request tab state as the sole source for send/save/dirty behavior and keep sidebar strictly presentational.

Pros:
- Fixes both issues at root cause.
- Clear ownership model per tab.
- Better resilience during async operations.

Cons:
- Requires modest store refactor and targeted tests.

### 3. Interaction lock during save/send

Prevent switching/selection changes while operations are in progress.

Pros:
- Simple guard against race conditions.

Cons:
- Degrades UX and still avoids addressing core architecture issues.

## Recommended Design

Adopt **tab-scoped source-of-truth**:

- Track per-tab saved snapshot for dirty evaluation.
- Compute dirty from tab request model vs tab's last saved snapshot.
- Capture `activeTabId` and tab snapshot at async operation start; apply completion updates by captured tab id only.
- Sync collection-list highlight from active tab file path on tab activation.

## Architecture and Data Flow

### Request tab state (`tabs-store`)

Add per-request-tab metadata:

- `lastSavedSnapshot` (serialized persisted request model)
- `saveState` (clean/dirty/saving/save_failed)
- `filePath` remains tab-owned and authoritative for save target

### Dirty-state logic

- Update tab dirty by comparing tab's persisted model against `lastSavedSnapshot`.
- On send:
  - Generate effective request for runtime execution (substitution/auth)
  - Do not mark dirty solely from runtime-only send transforms
  - Mark dirty only if persisted tab fields changed

### Save logic

- At save start:
  - capture `tabId`
  - read request/filePath from that tab
- Execute `saveRequest` with captured tab request/filePath.
- On completion (success/failure): update only captured tab id, even if active tab changed.

### Sidebar sync

- On tab activation, derive selected request path from active tab and update collection-list highlight.
- Prevent sidebar-selected node from being used as save target input.

## Error Handling

- Save failure on tab A updates only tab A state (`save_failed`, error message).
- Tab switch during save does not change save target.
- New unsaved requests without file path bind returned file path only to originating tab.

## Testing Strategy

### Unit/store tests

- Send without persisted-field changes should not mark dirty.
- Save from tab A must not mutate tab B when sidebar selection changes.
- Async save completion updates captured tab id only.
- Tab activation synchronizes sidebar highlight by file path.

### Manual regression sequence

1. Open Request A.
2. Send request.
3. Confirm tab A dirty behavior matches persisted-change semantics.
4. Open Request B from collection list.
5. Switch back to Request A tab and click save.
6. Confirm saved file corresponds to Request A, not Request B.
7. Confirm collection highlight follows active tab after tab switches.

## Scope

In scope:
- Dirty-state correction for send flow
- Save target correction for tab-vs-sidebar mismatch
- Sidebar highlight sync with active tab
- Tests for repro and async-tab switching

Out of scope:
- Full autosave redesign
- New tab model UI/UX features unrelated to save-target correctness

