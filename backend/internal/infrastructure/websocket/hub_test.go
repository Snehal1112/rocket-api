package websocket

import (
	"encoding/json"
	"testing"
	"time"
)

func TestHubBroadcastsOnlyToSubscribedCollection(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	subscribed := &Client{hub: hub, send: make(chan []byte, 1)}
	subscribed.subscription = "alpha"
	other := &Client{hub: hub, send: make(chan []byte, 1)}
	other.subscription = "beta"
	unsubscribed := &Client{hub: hub, send: make(chan []byte, 1)}

	hub.register <- subscribed
	hub.register <- other
	hub.register <- unsubscribed

	hub.Broadcast("file_change", "alpha", map[string]any{
		"relativePath": "collection.bru",
	})

	assertReceivesCollectionMessage(t, subscribed.send, "alpha")
	assertNoMessage(t, other.send)
	assertNoMessage(t, unsubscribed.send)

	hub.unregister <- subscribed
	hub.unregister <- other
	hub.unregister <- unsubscribed
}

func TestHubReplacesClientSubscription(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{hub: hub, send: make(chan []byte, 2)}
	hub.register <- client

	client.updateSubscription("alpha")
	hub.Broadcast("file_change", "alpha", map[string]any{"relativePath": "requests/a.bru"})
	assertReceivesCollectionMessage(t, client.send, "alpha")

	client.updateSubscription("beta")
	hub.Broadcast("file_change", "alpha", map[string]any{"relativePath": "requests/a.bru"})
	assertNoMessage(t, client.send)

	hub.Broadcast("file_change", "beta", map[string]any{"relativePath": "requests/b.bru"})
	assertReceivesCollectionMessage(t, client.send, "beta")

	hub.unregister <- client
}

func TestHubSkipsUnsubscribedClients(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{hub: hub, send: make(chan []byte, 1)}
	hub.register <- client

	hub.Broadcast("file_change", "alpha", map[string]any{"relativePath": "requests/a.bru"})
	assertNoMessage(t, client.send)

	hub.unregister <- client
}

func assertReceivesCollectionMessage(t *testing.T, ch <-chan []byte, want string) {
	t.Helper()

	select {
	case raw := <-ch:
		var msg Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("failed to unmarshal message: %v", err)
		}
		if msg.Collection != want {
			t.Fatalf("expected collection %q, got %q", want, msg.Collection)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("expected message for collection %q", want)
	}
}

func assertNoMessage(t *testing.T, ch <-chan []byte) {
	t.Helper()

	select {
	case raw := <-ch:
		t.Fatalf("expected no message, got %s", string(raw))
	case <-time.After(50 * time.Millisecond):
	}
}
