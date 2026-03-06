# Pre/Post Request Scripting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Bruno/Postman-style pre-request and post-response scripting in Rocket with sandboxed JS/TS execution and `pm.*` + `bru.*` APIs.

**Architecture:** Extend request schema and `.bru` parser to persist scripts, add backend sandbox runtime integrated into `/requests/send`, and expose UI editing through a single `Scripts` tab. Execute pre-script before dispatch and post-script after response capture, returning structured script results and errors.

**Tech Stack:** Go backend, existing Rocket handlers/repository/parser, frontend React/TypeScript + Monaco, Vitest, Go `testing`.

---

### Task 1: Add request script fields to shared models (TDD)

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `backend/pkg/bru/parser.go`
- Test: `backend/pkg/bru/parser_test.go`

**Step 1: Write failing parser test for script fields roundtrip**
- Add test case with pre/post script blocks and language.

**Step 2: Run test to verify fail**
Run: `cd backend && go test ./pkg/bru -run Script -v`
Expected: FAIL due to missing script fields parsing/generation.

**Step 3: Implement minimal model updates**
- Add `Scripts` struct to `BruFile`.
- Add TS/JS language enum-like string handling.

**Step 4: Implement parser/generator support**
- Parse script blocks and emit them in generated `.bru` content.

**Step 5: Re-run tests**
Run: `cd backend && go test ./pkg/bru -run Script -v`
Expected: PASS.

**Step 6: Commit**
```bash
git add backend/pkg/bru/parser.go backend/pkg/bru/parser_test.go frontend/src/types/index.ts
git commit -m "feat(scripting): add script fields to request models"
```

### Task 2: Create sandbox runtime with pm/bru aliases (TDD)

**Files:**
- Create: `backend/internal/app/scripting/runtime.go`
- Create: `backend/internal/app/scripting/runtime_test.go`
- Modify: `backend/go.mod` (if runtime dependency needed)

**Step 1: Write failing runtime tests**
- Test `pm.environment.get/set` and `bru.getVar/setVar` parity.
- Test request mutation from pre-script.
- Test response assertions from post-script.
- Test timeout/sandbox denial behavior.

**Step 2: Run tests to verify fail**
Run: `cd backend && go test ./internal/app/scripting -v`
Expected: FAIL (runtime not implemented).

**Step 3: Implement sandbox runtime minimal API**
- Build context object for request/response/variables.
- Map both alias APIs to shared state.
- Add JS execution with timeout.

**Step 4: Add TypeScript transpilation path**
- Transpile TS source before runtime execution.
- Ensure syntax/compile errors are returned as structured failures.

**Step 5: Re-run tests**
Run: `cd backend && go test ./internal/app/scripting -v`
Expected: PASS.

**Step 6: Commit**
```bash
git add backend/internal/app/scripting backend/go.mod backend/go.sum
git commit -m "feat(scripting): add sandbox runtime with pm and bru APIs"
```

### Task 3: Integrate scripts into request send lifecycle (TDD)

**Files:**
- Modify: `backend/internal/interfaces/handlers/request_handler.go`
- Test: `backend/internal/interfaces/handlers/request_handler_test.go`

**Step 1: Write failing handler integration tests**
- Pre-script mutates header/query/body before dispatch.
- Post-script receives response and records test result.
- Pre-script error blocks dispatch.
- Post-script error returns response plus script error payload.

**Step 2: Run tests to verify fail**
Run: `cd backend && go test ./internal/interfaces/handlers -run SendRequest -v`
Expected: FAIL for script scenarios.

**Step 3: Implement handler runtime integration**
- Extend `RequestPayload` with scripts.
- Run pre-script before building outbound request.
- Run post-script after response capture.
- Attach `scriptResult` in response envelope.

**Step 4: Re-run tests**
Run: `cd backend && go test ./internal/interfaces/handlers -run SendRequest -v`
Expected: PASS.

**Step 5: Commit**
```bash
git add backend/internal/interfaces/handlers/request_handler.go backend/internal/interfaces/handlers/request_handler_test.go
git commit -m "feat(scripting): execute pre and post scripts in send flow"
```

### Task 4: Wire scripts through collection load/save and import/export (TDD)

**Files:**
- Modify: `backend/internal/interfaces/handlers/collection_handler.go`
- Modify: `backend/internal/interfaces/handlers/import_export_handler.go`
- Test: `backend/internal/interfaces/handlers/import_export_handler_test.go`

**Step 1: Write failing tests for persistence/import/export**
- Save request with scripts then load request and verify unchanged.
- Import Bruno zip with script blocks and verify API response includes scripts.
- Export Bruno retains script blocks.

**Step 2: Run tests to verify fail**
Run: `cd backend && go test ./internal/interfaces/handlers -run "Import|Export|Request" -v`
Expected: FAIL.

**Step 3: Implement persistence wiring**
- Ensure request JSON payload and `.bru` parser paths carry script fields end-to-end.

**Step 4: Re-run tests**
Run: `cd backend && go test ./internal/interfaces/handlers -run "Import|Export|Request" -v`
Expected: PASS.

**Step 5: Commit**
```bash
git add backend/internal/interfaces/handlers/collection_handler.go backend/internal/interfaces/handlers/import_export_handler.go backend/internal/interfaces/handlers/import_export_handler_test.go
git commit -m "fix(import-export): preserve request scripts in Bruno workflows"
```

### Task 5: Add frontend Scripts tab with two panes (TDD)

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/components/request-builder/RequestBuilderTabs.tsx`
- Modify: `frontend/src/components/request-builder/useRequestBuilderState.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/components/request-builder/RequestBuilderTabs.test.tsx`
- Test: `frontend/src/components/request-builder/useRequestBuilderState.test.ts`

**Step 1: Write failing frontend tests**
- Scripts tab renders with pre/post panes.
- Language selector toggles JS/TS.
- Editor updates persist in active request state.
- Save payload includes scripts.

**Step 2: Run tests to verify fail**
Run: `cd frontend && yarn test RequestBuilderTabs useRequestBuilderState`
Expected: FAIL.

**Step 3: Implement UI and state wiring**
- Add `Scripts` tab.
- Add Monaco editors for pre/post script.
- Add language selector.
- Include scripts in tab serialization/deserialization.

**Step 4: Re-run tests**
Run: `cd frontend && yarn test RequestBuilderTabs useRequestBuilderState`
Expected: PASS.

**Step 5: Commit**
```bash
git add frontend/src/components/request-builder/RequestBuilderTabs.tsx frontend/src/components/request-builder/useRequestBuilderState.ts frontend/src/lib/api.ts frontend/src/types/index.ts frontend/src/components/request-builder/RequestBuilderTabs.test.tsx frontend/src/components/request-builder/useRequestBuilderState.test.ts
git commit -m "feat(frontend): add scripts editor with pre and post panes"
```

### Task 6: End-to-end verification and documentation update

**Files:**
- Modify: `docs/user-manual.md`
- Modify: `docs/admin-developer-manual.md`

**Step 1: Run backend full tests**
Run: `cd backend && go test ./...`
Expected: PASS.

**Step 2: Run frontend validation**
Run: `cd frontend && yarn lint && yarn test && yarn build`
Expected: PASS.

**Step 3: Update docs for scripting usage and constraints**
- Add user-facing section for Scripts tab.
- Add admin/dev notes on sandbox runtime and limits.

**Step 4: Commit docs**
```bash
git add docs/user-manual.md docs/admin-developer-manual.md
git commit -m "docs(scripting): document scripts workflow and sandbox limits"
```

### Task 7: Final quality pass

**Files:**
- Verify all modified files.

**Step 1: Placeholder scan**
Run: `rg -n "TODO|TBD|\[\]" backend frontend/src docs`
Expected: no new placeholders in scripting changes.

**Step 2: Confirm git status**
Run: `git status --short`
Expected: clean or only intentionally uncommitted changes.

**Step 3: Prepare branch completion**
- Use `superpowers:finishing-a-development-branch` after implementation and verification are complete.
