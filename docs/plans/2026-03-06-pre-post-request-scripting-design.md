# Pre/Post Request Scripting Design

## Problem
Rocket currently sends HTTP requests without a script execution layer. Bruno/Postman parity requires request-level scripting to mutate outbound requests and validate responses.

## Goal
Add Bruno/Postman-style scripting with:
- Pre-request and post-response execution.
- Sandboxed runtime.
- JavaScript + TypeScript support from day one.
- Both `pm.*` and `bru.*` APIs.

## Scope
In scope:
- Request model/persistence updates for scripts.
- Backend script runtime integration in request execution flow.
- Request Builder UI support via one `Scripts` tab with two panes.
- Parser/import/export support for scripts in `.bru` content.
- Test coverage for parser, runtime, handler integration, and UI state.

Out of scope (v1):
- Filesystem/network access from scripts.
- Third-party module import in scripts.
- Collection-level/global scripts.

## Architecture
Rocket will execute scripts on the backend inside a sandboxed JavaScript runtime.

Execution flow:
1. Load request + variables + scripts.
2. Run pre-request script.
3. Apply resulting request mutations.
4. Send HTTP request.
5. Build response context.
6. Run post-response script.
7. Return response + script results/errors.

TypeScript scripts are transpiled to JavaScript before execution.

## Data Model
Add request script fields:
- `scripts.language`: `javascript | typescript`
- `scripts.preRequest`: string
- `scripts.postResponse`: string

Compatibility rules:
- Missing script fields default to empty strings.
- Existing requests remain valid.

## API Surface in Scripts
Expose both aliases in one runtime context:
- Postman-style: `pm.environment`, `pm.variables`, `pm.request`, `pm.response`, `pm.test`
- Bruno-style: `bru.getVar/setVar`, `bru.req`, `bru.res`, `bru.test`

## Sandbox Rules
- Disallow direct filesystem/process/network access.
- Disallow arbitrary module imports.
- Enforce execution timeout and runtime limits.
- Fail scripts with structured error payloads; do not crash request handler.

## Persistence and Bruno Compatibility
- Update parser/generator to read/write script blocks in `.bru` files.
- Preserve scripts on Bruno zip import and Bruno export.
- Keep JSON API request payloads aligned with new script fields.

## UI Design
Request Builder gets a single `Scripts` tab containing:
- Pre-request editor pane.
- Post-response editor pane.
- Shared language selector (`JavaScript`, `TypeScript`).

Scripts are restored from active tab state and saved with request.

## Error Handling
- Script compile/runtime failures return structured script metadata in API response.
- Pre-request error: prevent request dispatch.
- Post-response error: keep HTTP response, attach script error details.

## Testing Strategy
Backend:
- Parser/generator tests for script roundtrip.
- Runtime tests for mutation, assertions, alias parity, timeout, and sandbox enforcement.
- Handler integration tests for request lifecycle.

Frontend:
- Scripts tab rendering/state tests.
- Save/load serialization tests.

## Success Criteria
- Users can create/edit/save pre/post scripts in Rocket.
- Scripts execute in sandbox during request lifecycle.
- Both `pm.*` and `bru.*` APIs work in JS and TS scripts.
- `.bru` import/export preserves scripts.
- Existing non-script requests continue to work unchanged.
