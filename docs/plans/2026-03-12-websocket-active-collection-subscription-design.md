# WebSocket Active Collection Subscription Design

## Summary

Rocket should stop broadcasting every collection file change to every
connected frontend client. Instead, each client should subscribe only
to the active collection, and the backend should route file-change
events only to clients interested in that collection.

This keeps the current real-time sync behavior for the collection the
user is actually working in, while reducing websocket fan-out and
follow-up HTTP refresh work for unrelated collections.

## Current Problem

The current websocket path is global:

- the backend file watcher broadcasts every file change to all clients
- the frontend receives all events and filters them after the fact
- most non-`collection.bru` events still trigger broad invalidation in
  `App.tsx`

That creates two avoidable costs:

- every browser processes irrelevant websocket messages
- irrelevant messages can still trigger unnecessary store refresh work

## Goals

- Limit websocket file-change delivery to the active collection.
- Keep one websocket connection per app session.
- Preserve current targeted refresh behavior for relevant events.
- Reduce server broadcast fan-out as client count and collection count
  grow.
- Avoid a large protocol redesign.

## Non-Goals

- Fine-grained subscriptions by feature scope in this change.
- Multi-collection subscriptions per client.
- Replacing websockets with polling or server-sent events.
- Full removal of frontend refresh logic.

## Recommended Approach

### 1. Active-collection subscription model

Each websocket client should have one active collection subscription at
a time.

The frontend sends a `subscribe` message when the active collection is
set or changes. When there is no active collection, the client should
clear its subscription.

### 2. Lightweight client-to-server protocol

Add a minimal websocket control message format for the client:

- `subscribe` with collection name
- optional `unsubscribe`, or implicit replacement on a new subscribe

The server-to-client file-change payload can remain close to the
current structure so the frontend refresh handler stays simple.

### 3. Subscription-aware hub routing

The websocket hub should track the subscribed collection for each
client connection.

When the file watcher emits a collection-scoped change, the hub should
deliver that message only to clients whose current subscription matches
the collection.

### 4. Targeted frontend invalidation only

After subscription filtering is in place, the frontend should continue
to use targeted refresh logic for relevant events:

- `environments/*` -> refresh environments only
- `collection.bru` -> refresh collection variables unless consumed as
  self-echo
- other collection files -> refresh collection tree

Broad `fetchCollections()` should be reserved for top-level changes that
actually affect the collection list, not ordinary file writes inside an
active collection.

## Protocol

### Client to server

Recommended message shape:

```json
{
  "type": "subscribe",
  "collection": "snehal"
}
```

A later `subscribe` replaces the previous subscription for the same
connection.

### Server to client

Keep the current event structure:

```json
{
  "type": "file_change",
  "collection": "snehal",
  "data": {
    "type": "write",
    "path": "/abs/path/to/file",
    "relativePath": "requests/get-users.bru"
  }
}
```

This minimizes frontend churn.

## Frontend Flow

1. App creates one websocket connection.
2. When `activeCollection` becomes available, send `subscribe`.
3. When `activeCollection` changes, send a new `subscribe`.
4. When no collection is active, clear the subscription.
5. Process only relevant events delivered by the backend.
6. Use targeted refresh behavior instead of broad collection-list
   invalidation for ordinary collection file updates.

The width of the change should stay in `App.tsx`, because that is where
the websocket hook and active collection context already meet.

## Backend Flow

1. File watcher emits `FileChangeEvent` with collection and relative
   path.
2. Websocket hub receives the event as it does today.
3. Hub checks each client's subscribed collection.
4. Only matching clients receive the serialized file-change message.
5. Clients without a subscription receive no collection-scoped file
   events.

This shifts the filtering cost from every client to the server hub once
per event, which is the right tradeoff for this app shape.

## Error Handling

- Invalid or unknown websocket control messages should be ignored
  safely.
- If a client disconnects, its subscription state must be cleaned up.
- If a client has no active collection, the hub should treat it as
  unsubscribed.
- Reconnect behavior should resubscribe automatically from current
  frontend state after the websocket reconnects.

## Testing

Add targeted coverage for:

- backend hub routing only to subscribed clients
- replacing subscription when active collection changes
- frontend subscribe behavior on active collection changes
- no processing of unrelated collection events
- preservation of current targeted refresh behavior for active
  collection events

Manual verification should confirm:

- viewing collection `A` reacts to `A` file changes
- viewing collection `A` ignores `B` file changes
- switching to `B` causes later `B` changes to arrive live

The feature is complete when active-collection updates stay live and
irrelevant collection events no longer reach the browser.
