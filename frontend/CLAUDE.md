# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev              # Start Vite dev server (proxies /api to localhost:8080)
yarn build            # Type-check then build (tsc -b && vite build)
yarn lint             # ESLint (flat config, v9)
yarn test             # Vitest single run
yarn test:watch       # Vitest in watch mode
```

Run a single test file: `yarn vitest run src/features/collections/__tests__/hooks.test.tsx`

## Architecture

React 19 + TypeScript frontend for the Rocket API desktop tool. Vite 7 bundler, Tailwind CSS 3, shadcn/ui (New York style) components. The Go backend runs at `localhost:8080`.

### State Management

Four Zustand stores — no Redux, no TanStack Query for primary data (QueryClient is provisioned but unused):

- **`useTabsStore`** (`store/tabs-store.ts`) — Multi-tab editor session. Persisted to sessionStorage. Tracks dirty state via JSON snapshot comparison (`lastSavedSnapshot`). Has load-version guards against race conditions.
- **`useCollectionsStore`** (`store/collections.ts`) — Active collection, environment, collection variables, tree. Uses module-scope `Map` objects for in-flight request deduplication.
- **`useHistoryStore`** (`store/history.ts`) — Request history list mirroring the backend.
- **`useConsoleStore`** (`store/console.ts`) — Ephemeral ring buffer (200 entries) of sent request/response pairs.

### Feature Organization (`src/features/`)

Each feature directory follows this convention:
- `api/` — Thin facades over the singleton `apiService`
- `hooks/` — Zustand store projection hooks (selectors, not state owners)
- `routes.tsx` — Feature route definitions
- `route-sync.tsx` — Headless components that sync URL params into store actions via `useEffect` (render `null`)

Features: `collections`, `history`, `realtime`, `request-builder`.

### API Layer

`src/lib/api.ts` exports a singleton `apiService` (Axios-based). All backend calls go through this class. Feature `api/` modules delegate to it. Health-check runs before `sendRequest`; falls back to `mockApiService` if backend is unavailable.

### Realtime / WebSocket

- `src/hooks/use-websocket.ts` — Low-level hook with 5-second auto-reconnect.
- `src/features/realtime/` — `useRealtimeSync` handles `file_change` events from the backend and routes them to the correct store action based on file path patterns. Self-echo suppression prevents re-fetching data the client just saved (2-second window).
- Subscription model: client sends `{type: 'subscribe', collection: name}` messages.

### Routing

HashRouter via react-router-dom 6. Routes are injected through a custom `RoutesProvider` context (`src/providers/Routes/`). Top-level config in `src/app/routes.tsx`.

### Key Conventions

- Path alias: `@/` maps to `src/`
- Environment variables: `VITE_API_BASE_URL` (default `http://localhost:8080/api/v1`), `VITE_WS_URL` (derived from API URL if unset). See `src/lib/runtime-config.ts`.
- Variable substitution: `{{varName}}` syntax resolved against active environment and collection variables (`src/lib/environment.ts`).
- Auth is per-request (Basic, Bearer, API Key), not application-level.
- UI primitives live in `src/components/ui/` (shadcn/ui). Domain components live in `src/components/{domain}/`.
