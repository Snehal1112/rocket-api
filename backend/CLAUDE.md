# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run

```bash
# Build the server
go build -o rocket-api-server ./cmd/server

# Run the server (listens on :8080)
go run ./cmd/server/main.go

# Run all tests
go test ./...

# Run tests for a specific package
go test ./pkg/bru/
go test ./internal/app/...
go test ./internal/infrastructure/websocket/

# Run a single test by name
go test ./pkg/bru/ -run TestParseBruFile

# Run tests with verbose output
go test -v ./...
```

## Architecture

This is the Go backend for Rocket API, an API client similar to Bruno/Postman. It follows a clean architecture / hexagonal pattern:

- **`cmd/server/main.go`** - Entry point. Wires up all repositories, handlers, file watcher, and WebSocket hub. Serves on `:8080` with CORS middleware.
- **`internal/domain/`** - Pure domain models (`Collection`, `Request`, `Environment`) with no external dependencies. `collection.Repository` defines the persistence interface.
- **`internal/app/`** - Application services (e.g., `CollectionService`) that orchestrate domain logic. Contains the `scripting/` subpackage which runs pre-request/post-response JavaScript/TypeScript scripts using the Goja VM.
- **`internal/infrastructure/`** - Infrastructure implementations:
  - `repository/` - Filesystem-based persistence for collections, history, templates, and cookies. Collections are stored as directories of `.bru` files under `~/.rocket-api/collections/`.
  - `websocket/` - Hub-and-client broadcast system for real-time file change notifications. Clients can subscribe to specific collections.
  - `storage/` - `FileWatcher` using fsnotify with debouncing, watches collection directories and triggers WebSocket broadcasts on changes.
  - `config/` - Environment-based configuration (`COLLECTIONS_PATH`, `LOG_LEVEL`, `SERVER_ADDRESS`).
- **`internal/interfaces/`** - HTTP layer:
  - `handlers/` - Gorilla Mux route handlers for collections, requests, environments, history, templates, cookies, and import/export. All API routes are under `/api/v1/`.
  - `dto/` - Request/response data transfer objects.
  - `http/handlers/` - Alternative collection handler (appears to be an older or parallel implementation).
- **`pkg/bru/`** - Parser and generator for the `.bru` file format (Bruno-compatible). Handles meta, HTTP method/URL, headers, query/path params, auth, body, scripts, vars, and assertions.
- **`pkg/logger/`** - Logger interface wrapping logrus with a noop implementation for tests.

## Key Patterns

- **Storage model**: All data lives on the filesystem under `~/.rocket-api/` (collections, history, templates, cookies). No database.
- **`.bru` file format**: Requests are stored as `.bru` files with a block-based syntax (`meta {}`, `http {}`, `body:json {}`, `script:pre-request {}`, etc.). The parser is in `pkg/bru/parser.go`.
- **Scripting engine**: Pre-request and post-response scripts run in a sandboxed Goja (JavaScript) VM with 200ms timeout. Exposes `pm` and `bru` objects compatible with Postman/Bruno scripting APIs. Minimal TypeScript transpilation strips type annotations.
- **WebSocket**: Endpoint at `/ws`. Clients send `subscribe`/`unsubscribe` control messages with a collection name. The hub broadcasts `file_change` events scoped to the subscribed collection.
- **API response envelope**: Most handlers wrap responses in `{"data": ..., "success": bool, "message": string}`.
- **Environment files**: Stored as `<name>.env` and `<name>.env.secret` under `<collection>/environments/`. Collection-level variables use `collection.bru` with `vars {}` and `vars:secret []` blocks.
- **Two handler sets**: `internal/interfaces/handlers/` contains the active route handlers wired in `main.go`. The `request_handler.go` file also has legacy placeholder handlers (`GetCollectionsHandler`, `CreateCollectionHandler`, `GetEnvironmentsHandler`) that are not routed.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `COLLECTIONS_PATH` | `~/.rocket-api/collections` | Override set in config but main.go hardcodes `~/.rocket-api/collections` |
| `LOG_LEVEL` | `info` | Logrus log level |
| `SERVER_ADDRESS` | `0.0.0.0:8080` | Server bind address (config only, main.go hardcodes `:8080`) |
