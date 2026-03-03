# Bruno Feature Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Bruno-compatible dynamic variables, form body, docs tab, folder-level vars, JavaScript scripting (Goja), and a test framework to Rocket across four phases.

**Architecture:** Backend changes land in `pkg/bru` (parser/generator), `internal/app` (script executor), `internal/interfaces/handlers` (request handler + collection handler), and `cmd/server/main.go` (routes). Frontend changes land in `src/types`, `src/lib`, `src/store`, and `src/components/request-builder`. Each phase is independently shippable.

**Tech Stack:** Go 1.25 · Goja (pure-Go JS engine) · React + TypeScript · Monaco Editor (already wired) · Radix Tabs (already in use) · `go test` for backend · manual smoke-test for frontend

---

## Background reading

Before starting, read these files to understand existing patterns:

- `backend/pkg/bru/parser.go` — `BruFile` struct, `ParseContent`, `GenerateContent`
- `backend/internal/infrastructure/repository/collection_repository.go` — `parseCollectionVars`, `formatCollectionVars`, skip-guard pattern for `collection.bru`
- `backend/internal/interfaces/handlers/request_handler.go` — `RequestPayload`, `SendRequestHandler`, how `BodyType` controls body encoding
- `frontend/src/types/index.ts` — `RequestBody`, `FormDataField`, `BruFile`
- `frontend/src/lib/environment.ts` — `substituteRequestVariables`
- `frontend/src/components/request-builder/RequestBuilder.tsx` — tab structure, `handleSubmit` (around line 179), body rendering

---

## Phase 1 — Dynamic Variables + x-www-form-urlencoded

---

### Task 1: Dynamic variables in `substituteRequestVariables`

**Files:**
- Modify: `frontend/src/lib/environment.ts:60-64` (the `substitute` inner function)

**Context:** Bruno supports `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$randomInt}}`, `{{$uuid}}`, `{{$randomEmail}}` as client-side-only tokens resolved at send time. They use a `$` prefix, which is not a valid JS identifier character — the existing `\w+` regex won't match them.

**Step 1: Write the failing test (manual)**

Open `frontend/src/lib/environment.ts` and verify that calling `substituteRequestVariables` with URL `https://api.example.com/{{$uuid}}` leaves the token unreplaced. You can add a quick `console.log` in a test file or just confirm the regex `\w+` won't match `$uuid`.

**Step 2: Implement dynamic variable resolution**

Replace the `substitute` inner function inside `substituteRequestVariables` (currently lines 60-63) with one that intercepts `$`-prefixed tokens first:

```typescript
const resolveDynamic = (token: string): string | null => {
  switch (token) {
    case '$timestamp':    return String(Math.floor(Date.now() / 1000))
    case '$isoTimestamp': return new Date().toISOString()
    case '$randomInt':    return String(Math.floor(Math.random() * 1001))
    case '$uuid':         return crypto.randomUUID()
    case '$randomEmail':  return `user${Math.floor(Math.random() * 1e6)}@example.com`
    default:              return null
  }
}

const substitute = (text: string) =>
  text.replace(/\{\{([\w$]+)\}\}/g, (match, varName) => {
    const dynamic = resolveDynamic(varName)
    if (dynamic !== null) return dynamic
    return merged[varName] !== undefined ? merged[varName] : match
  })
```

Note: the regex is widened from `\w+` to `[\w$]+` to allow the `$` prefix.

**Step 3: Smoke test**

In RequestBuilder, set URL to `https://httpbin.org/get?ts={{$timestamp}}&id={{$uuid}}` and send. The actual request should have real values, not the literal tokens.

**Step 4: Commit**

```bash
git add frontend/src/lib/environment.ts
git commit -m "feat(frontend): resolve dynamic variables at send time"
```

---

### Task 2: `FormField` struct and `body:form` parser/generator in `pkg/bru`

**Files:**
- Modify: `backend/pkg/bru/parser.go`
- Modify: `backend/pkg/bru/parser_test.go`

**Context:** Bruno stores URL-encoded form fields as:
```
body:form {
  username: alice
  ~disabled_field: value
}
```
`~` prefix = disabled field. This is different from `body:form-data` (multipart).

**Step 1: Write the failing test** in `backend/pkg/bru/parser_test.go`:

```go
func TestFormBodyRoundtrip(t *testing.T) {
    original := &BruFile{}
    original.Meta.Name = "Login"
    original.Meta.Type = "http"
    original.HTTP.Method = "POST"
    original.HTTP.URL = "https://example.com/login"
    original.Body.Type = "form"
    original.FormFields = []FormField{
        {Key: "username", Value: "alice", Enabled: true},
        {Key: "remember", Value: "yes", Enabled: false},
    }

    content := GenerateContent(original)
    parsed, err := ParseContent(content)
    if err != nil {
        t.Fatalf("ParseContent error: %v", err)
    }

    if parsed.Body.Type != "form" {
        t.Errorf("body.type: got %q, want %q", parsed.Body.Type, "form")
    }
    if len(parsed.FormFields) != 2 {
        t.Fatalf("FormFields: got %d, want 2", len(parsed.FormFields))
    }
    if parsed.FormFields[0].Key != "username" || !parsed.FormFields[0].Enabled {
        t.Errorf("FormFields[0]: got %+v", parsed.FormFields[0])
    }
    if parsed.FormFields[1].Key != "remember" || parsed.FormFields[1].Enabled {
        t.Errorf("FormFields[1] disabled: got %+v", parsed.FormFields[1])
    }
}
```

**Step 2: Run test to confirm it fails**

```bash
cd backend && go test ./pkg/bru/... -run TestFormBodyRoundtrip -v
```

Expected: FAIL — `FormField` type does not exist.

**Step 3: Add `FormField` to `BruFile` in `parser.go`**

After the `AuthConfig` struct (around line 40), add:

```go
// FormField represents one x-www-form-urlencoded key-value pair.
type FormField struct {
    Key     string `json:"key"`
    Value   string `json:"value"`
    Enabled bool   `json:"enabled"`
}
```

Add to `BruFile` struct (inside `BruFile`, after the `Body` block, around line 62):

```go
FormFields []FormField `json:"formFields,omitempty"`
```

**Step 4: Add parser support for `body:form { ... }`**

In `ParseContent`, the parser handles contexts via `contextStack`. Add a new context branch. After the `case "body":` block (around line 234), add inside the `switch ctx` statement:

```go
case "body:form":
    // Each line is "key: value" or "~key: value" (disabled).
    parts := strings.SplitN(trimmed, ":", 2)
    if len(parts) == 2 {
        key := strings.TrimSpace(parts[0])
        enabled := true
        if strings.HasPrefix(key, "~") {
            key = key[1:]
            enabled = false
        }
        bru.FormFields = append(bru.FormFields, FormField{
            Key:     key,
            Value:   strings.TrimSpace(parts[1]),
            Enabled: enabled,
        })
    }
```

The block opener line is `body:form {` — the parser strips `{` and pushes `body:form` onto the context stack, so this branch will be hit automatically.

**Step 5: Add generator support in `GenerateContent`**

After the existing `body` block output (after the closing `content.WriteString("}\n\n")` of the body section, around line 352), add:

```go
// Form fields (x-www-form-urlencoded)
if bru.Body.Type == "form" && len(bru.FormFields) > 0 {
    content.WriteString("body:form {\n")
    for _, f := range bru.FormFields {
        if f.Enabled {
            fmt.Fprintf(&content, "  %s: %s\n", f.Key, f.Value)
        } else {
            fmt.Fprintf(&content, "  ~%s: %s\n", f.Key, f.Value)
        }
    }
    content.WriteString("}\n\n")
}
```

Also update the existing body-block condition so it doesn't emit an empty `body { type: form }` block:

Change the condition around line 337 from:
```go
if bru.Body.Type != "" && bru.Body.Type != "none" {
```
to:
```go
if bru.Body.Type != "" && bru.Body.Type != "none" && bru.Body.Type != "form" {
```

**Step 6: Run test to confirm it passes**

```bash
cd backend && go test ./pkg/bru/... -run TestFormBodyRoundtrip -v
```

Expected: PASS

**Step 7: Run all bru tests**

```bash
cd backend && go test ./pkg/bru/... -v
```

Expected: all PASS

**Step 8: Commit**

```bash
git add backend/pkg/bru/parser.go backend/pkg/bru/parser_test.go
git commit -m "feat(bru): parse and generate body:form blocks"
```

---

### Task 3: URL-encode form fields in `request_handler.go`

**Files:**
- Modify: `backend/internal/interfaces/handlers/request_handler.go`

**Context:** `RequestPayload` already has `BodyType`. When `BodyType == "form"`, enabled form fields must be encoded as `application/x-www-form-urlencoded`.

**Step 1: Add `FormFields` to `RequestPayload`**

In the `RequestPayload` struct (around line 58), add after the existing `FormData` field:

```go
FormFields []struct {
    Key     string `json:"key"`
    Value   string `json:"value"`
    Enabled bool   `json:"enabled"`
} `json:"formFields,omitempty"`
```

**Step 2: Write the encoding logic**

In `SendRequestHandler`, before the existing body-encoding block (the `if payload.BodyType == "form-data"` chain, around line 182), add a new branch **first**:

```go
if payload.BodyType == "form" && len(payload.FormFields) > 0 {
    params := url.Values{}
    for _, f := range payload.FormFields {
        if f.Enabled && f.Key != "" {
            params.Set(f.Key, f.Value)
        }
    }
    encoded := params.Encode()
    req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
    req.Body = io.NopCloser(strings.NewReader(encoded))
    req.ContentLength = int64(len(encoded))
} else if payload.BodyType == "form-data" && len(payload.FormData) > 0 {
    // ... existing multipart code
```

Add `"net/url"` to the import block.

**Step 3: Build to confirm no compile errors**

```bash
cd backend && go build ./...
```

Expected: no errors.

**Step 4: Commit**

```bash
git add backend/internal/interfaces/handlers/request_handler.go
git commit -m "feat(backend): encode form fields as application/x-www-form-urlencoded"
```

---

### Task 4: Frontend form body UI

**Files:**
- Modify: `frontend/src/types/index.ts` — add `'form'` to `RequestBody.type`, add `FormField` interface
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx` — form body editor tab, payload construction

**Context:** `RequestBody.type` currently allows `'none' | 'json' | 'form-data' | 'raw' | 'binary'`. We add `'form'` for x-www-form-urlencoded. The form editor is a simple key/value table — same pattern as the existing query params editor.

**Step 1: Update `types/index.ts`**

Add a `FormField` interface (distinct from `FormDataField` which is multipart):

```typescript
export interface FormField {
  key: string
  value: string
  enabled: boolean
}
```

Update `RequestBody`:

```typescript
export interface RequestBody {
  type: 'none' | 'json' | 'form-data' | 'raw' | 'binary' | 'form'
  content: string
  formData?: FormDataField[]
  formFields?: FormField[]       // ← new, for x-www-form-urlencoded
  fileName?: string
}
```

**Step 2: Add form body selector option in `RequestBuilder.tsx`**

Find the body type selector (look for `<SelectItem value="none">` pattern). Add:

```tsx
<SelectItem value="form">Form URL-encoded</SelectItem>
```

**Step 3: Add form fields state**

In `RequestBuilder.tsx`, inside the component, add state for form fields:

```tsx
const [formFields, setFormFields] = useState<FormField[]>([])
```

In the `useEffect` that syncs from `currentRequest` (around line 122), add:

```tsx
setFormFields(currentRequest.body.formFields ?? [])
```

**Step 4: Add form fields editor (inside the Body tab)**

After the existing body type cases in the JSX body tab section, add a new block for `body.type === 'form'`:

```tsx
{body.type === 'form' && (
  <div className="space-y-2">
    {formFields.map((field, i) => (
      <div key={i} className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={field.enabled}
          onChange={e => {
            const next = [...formFields]
            next[i] = { ...next[i], enabled: e.target.checked }
            setFormFields(next)
          }}
          className="h-4 w-4"
        />
        <Input
          placeholder="Key"
          value={field.key}
          onChange={e => {
            const next = [...formFields]
            next[i] = { ...next[i], key: e.target.value }
            setFormFields(next)
          }}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Value"
          value={field.value}
          onChange={e => {
            const next = [...formFields]
            next[i] = { ...next[i], value: e.target.value }
            setFormFields(next)
          }}
          className="h-7 text-xs flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setFormFields(formFields.filter((_, idx) => idx !== i))}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    ))}
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      onClick={() => setFormFields([...formFields, { key: '', value: '', enabled: true }])}
    >
      <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
    </Button>
  </div>
)}
```

**Step 5: Wire form fields into the request payload sent to the backend**

In `handleSubmit` (around line 197), where the body payload is constructed for the API call, add:

```typescript
formFields: body.type === 'form' ? formFields.filter(f => f.enabled && f.key) : undefined,
```

Include `bodyType: body.type` (which already sends `body.type`). The `BodyType == "form"` case on the backend will handle it.

**Step 6: Wire form fields into save/load**

In `handleSaveRequest`, ensure `body` state includes `formFields`. Update the `body` state merging so that when body type is changed back to `form`, the `formFields` array is preserved in `body.formFields`.

In the `useEffect` sync block, add:
```tsx
setFormFields(currentRequest.body.formFields ?? [])
```
(Already done in Step 3.)

When calling `updateActiveBody`, pass the updated body including formFields:
```tsx
updateActiveBody({ ...body, formFields })
```

**Step 7: Build and smoke test**

```bash
cd frontend && yarn build
```

Expected: no TypeScript errors.

Test manually: create a POST request, select "Form URL-encoded" body type, add `username=alice&password=secret`, send to `https://httpbin.org/post`. Response body should show `"form": {"username": "alice", "password": "secret"}`.

**Step 8: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/request-builder/RequestBuilder.tsx
git commit -m "feat(frontend): add x-www-form-urlencoded body type editor"
```

---

## Phase 2 — Docs Tab + Folder-level Variables

---

### Task 5: `Docs` field in `BruFile` — parser + generator

**Files:**
- Modify: `backend/pkg/bru/parser.go`
- Modify: `backend/pkg/bru/parser_test.go`

**Context:** Bruno stores per-request docs as:
```
docs {
  # My Request

  This request fetches all users.
}
```
The content is raw text/markdown inside the braces.

**Step 1: Write the failing test**

```go
func TestDocsRoundtrip(t *testing.T) {
    original := &BruFile{}
    original.Meta.Name = "Get Users"
    original.Meta.Type = "http"
    original.HTTP.Method = "GET"
    original.HTTP.URL = "https://example.com/users"
    original.Body.Type = "none"
    original.Docs = "# Get Users\n\nFetches all users from the API."

    content := GenerateContent(original)
    parsed, err := ParseContent(content)
    if err != nil {
        t.Fatalf("ParseContent error: %v", err)
    }

    if parsed.Docs != original.Docs {
        t.Errorf("Docs: got %q, want %q", parsed.Docs, original.Docs)
    }
}
```

**Step 2: Run to confirm fail**

```bash
cd backend && go test ./pkg/bru/... -run TestDocsRoundtrip -v
```

Expected: FAIL — `Docs` field does not exist.

**Step 3: Add `Docs string` to `BruFile`**

In `parser.go`, inside the `BruFile` struct, add after `FormFields`:

```go
Docs string `json:"docs,omitempty"`
```

**Step 4: Add parser support for `docs { ... }` block**

The `docs` block content is raw multi-line text (not key:value pairs). Use the same `dataLines` accumulation pattern that the `data` block already uses.

Declare a separate accumulation mechanism alongside `inDataBlock`. Add:

```go
inDocsBlock := false
var docsLines []string
```

Before the existing `if inDataBlock {` check, add:

```go
if inDocsBlock {
    if trimmed == "}" {
        inDocsBlock = false
        contextStack = contextStack[:len(contextStack)-1]
        bru.Docs = strings.TrimRight(strings.Join(docsLines, "\n"), "\n")
        docsLines = nil
        continue
    }
    stripped := line
    if strings.HasPrefix(line, "  ") {
        stripped = line[2:] // docs uses 2-space indent
    }
    docsLines = append(docsLines, stripped)
    continue
}
```

In the block-open handling (where `blockName` is pushed to `contextStack`), add:

```go
if blockName == "docs" {
    inDocsBlock = true
}
```

**Step 5: Add generator support in `GenerateContent`**

At the end of `GenerateContent`, before `strings.TrimSpace(content.String())`, add:

```go
if bru.Docs != "" {
    content.WriteString("\ndocs {\n")
    for line := range strings.SplitSeq(bru.Docs, "\n") {
        fmt.Fprintf(&content, "  %s\n", line)
    }
    content.WriteString("}\n")
}
```

**Step 6: Run all tests**

```bash
cd backend && go test ./pkg/bru/... -v
```

Expected: all PASS.

**Step 7: Commit**

```bash
git add backend/pkg/bru/parser.go backend/pkg/bru/parser_test.go
git commit -m "feat(bru): parse and generate docs block"
```

---

### Task 6: Docs tab in frontend request builder

**Files:**
- Modify: `frontend/src/types/index.ts` — extend `BruFile` with `docs`
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx` — add Docs tab

**Context:** The request builder has a tab list (`Params`, `Headers`, `Body`, `Auth`). We add a `Docs` tab with a split view: markdown textarea on the left, rendered preview on the right.

**Step 1: Add `docs` to `BruFile` in types**

In `frontend/src/types/index.ts`, inside the `BruFile` interface, add:

```typescript
docs?: string
```

**Step 2: Add docs state in `RequestBuilder.tsx`**

```tsx
const [docs, setDocs] = useState('')
```

In the `useEffect` sync block:
```tsx
setDocs(currentRequest.body.docs ?? '')  // see note below
```

Note: `docs` is a top-level field on `BruFile`, but `HttpRequest` doesn't have it yet. Add `docs?: string` to `HttpRequest` in `types/index.ts`. Then store/load it there.

Updated `HttpRequest`:
```typescript
export interface HttpRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: Header[]
  body: RequestBody
  queryParams: QueryParam[]
  auth: AuthConfig
  docs?: string   // ← new
}
```

Sync from currentRequest:
```tsx
setDocs(currentRequest.docs ?? '')
```

**Step 3: Add Docs tab trigger**

In the `TabsList` that renders `Params`, `Headers`, `Body`, `Auth`, add:

```tsx
<TabsTrigger value="docs">Docs</TabsTrigger>
```

**Step 4: Add Docs tab content**

```tsx
<TabsContent value="docs" className="flex-1 overflow-hidden">
  <div className="flex h-full gap-0">
    {/* Editor */}
    <div className="flex-1 overflow-hidden border-r border-border">
      <textarea
        value={docs}
        onChange={e => setDocs(e.target.value)}
        placeholder="Write markdown documentation for this request..."
        className="w-full h-full resize-none p-3 text-xs font-mono bg-transparent focus:outline-none"
      />
    </div>
    {/* Preview */}
    <div className="flex-1 overflow-auto p-3 text-xs prose prose-sm dark:prose-invert max-w-none">
      {docs ? (
        <pre className="whitespace-pre-wrap font-sans">{docs}</pre>
      ) : (
        <p className="text-muted-foreground italic">Preview appears here...</p>
      )}
    </div>
  </div>
</TabsContent>
```

Note: For a richer preview, install `react-markdown` (`yarn add react-markdown`) and replace the `<pre>` with `<ReactMarkdown>{docs}</ReactMarkdown>`. Keep it simple if markdown rendering isn't a priority.

**Step 5: Wire docs into save/load**

In `handleSaveRequest`, include `docs` when flushing to the store. The store's `saveActiveTab` will serialize the tab's `request` object, which includes `docs`. Ensure it's passed:

After `updateActiveAuth(auth)`, add:
```tsx
updateActiveDocs(docs)
```

You'll need to add `updateActiveDocs` to the tabs store. In `frontend/src/store/tabs-store.ts`, add a new action `updateActiveDocs(docs: string)` that sets `activeTab.request.docs = docs` (follow the pattern of `updateActiveName`).

**Step 6: Build**

```bash
cd frontend && yarn build
```

Expected: no TypeScript errors.

**Step 7: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/request-builder/RequestBuilder.tsx frontend/src/store/tabs-store.ts
git commit -m "feat(frontend): add Docs tab to request builder"
```

---

### Task 7: `ReadFolderVars`/`WriteFolderVars` in repository + skip `folder.bru` in tree

**Files:**
- Modify: `backend/internal/infrastructure/repository/collection_repository.go`
- Modify: `backend/internal/infrastructure/repository/collection_vars_test.go` (or create a new test file)

**Context:** Each folder can have a `folder.bru` file at its root with `vars {}` and `vars:secret []` blocks — identical format to `collection.bru`. `GetCollectionStructure` must skip `folder.bru` files (same as it skips `collection.bru`).

**Step 1: Write failing tests**

In `backend/internal/infrastructure/repository/collection_vars_test.go` (or a new `folder_vars_test.go`), add:

```go
func TestReadFolderVars_Missing(t *testing.T) {
    repo := NewCollectionRepository(t.TempDir())
    vars, err := repo.ReadFolderVars("mycol", "somefolder")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if len(vars) != 0 {
        t.Errorf("expected empty vars, got %v", vars)
    }
}

func TestWriteReadFolderVars_Roundtrip(t *testing.T) {
    base := t.TempDir()
    repo := NewCollectionRepository(base)
    os.MkdirAll(filepath.Join(base, "mycol", "auth"), 0755)

    input := []CollectionVar{
        {Key: "base_url", Value: "https://auth.example.com", Enabled: true, Secret: false},
        {Key: "token",    Value: "secret123",                Enabled: true, Secret: true},
    }
    if err := repo.WriteFolderVars("mycol", "auth", input); err != nil {
        t.Fatalf("WriteFolderVars: %v", err)
    }

    got, err := repo.ReadFolderVars("mycol", "auth")
    if err != nil {
        t.Fatalf("ReadFolderVars: %v", err)
    }
    if len(got) != 2 {
        t.Fatalf("expected 2 vars, got %d", len(got))
    }
    if got[0].Key != "base_url" || !got[0].Enabled {
        t.Errorf("var[0]: %+v", got[0])
    }
    if got[1].Key != "token" || !got[1].Secret {
        t.Errorf("var[1]: %+v", got[1])
    }
}
```

**Step 2: Run to confirm fail**

```bash
cd backend && go test ./internal/infrastructure/repository/... -run "TestReadFolderVars|TestWriteReadFolderVars" -v
```

Expected: FAIL — methods don't exist.

**Step 3: Add `ReadFolderVars` and `WriteFolderVars` to `collection_repository.go`**

Add after `WriteCollectionVars`:

```go
// ReadFolderVars reads folder-level variables from <folderPath>/folder.bru.
// Returns an empty slice when the file does not exist yet.
func (r *CollectionRepository) ReadFolderVars(collectionName, folderPath string) ([]CollectionVar, error) {
    path := filepath.Join(r.basePath, collectionName, folderPath, "folder.bru")
    content, err := os.ReadFile(path)
    if os.IsNotExist(err) {
        return []CollectionVar{}, nil
    }
    if err != nil {
        return nil, fmt.Errorf("failed to read folder.bru: %w", err)
    }
    return parseCollectionVars(string(content)), nil
}

// WriteFolderVars writes folder-level variables to <folderPath>/folder.bru.
func (r *CollectionRepository) WriteFolderVars(collectionName, folderPath string, vars []CollectionVar) error {
    content := formatCollectionVars(vars)
    return r.WriteFile(collectionName, filepath.Join(folderPath, "folder.bru"), []byte(content))
}
```

**Step 4: Skip `folder.bru` in `GetCollectionStructure`**

In `GetCollectionStructure`, after the existing `collection.bru` skip guard (around line 194), add:

```go
// Skip folder.bru — it holds folder-level vars, not a request.
if !info.IsDir() && info.Name() == "folder.bru" {
    return nil
}
```

**Step 5: Run all repository tests**

```bash
cd backend && go test ./internal/infrastructure/repository/... -v
```

Expected: all PASS.

**Step 6: Commit**

```bash
git add backend/internal/infrastructure/repository/collection_repository.go \
        backend/internal/infrastructure/repository/collection_vars_test.go
git commit -m "feat(backend): ReadFolderVars/WriteFolderVars + skip folder.bru in tree"
```

---

### Task 8: Folder vars API handler + routes

**Files:**
- Modify: `backend/internal/interfaces/handlers/collection_handler.go`
- Modify: `backend/cmd/server/main.go`

**Context:** New endpoints:
- `GET  /api/v1/collections/{name}/folder-vars?path=<relPath>` → returns vars for that folder
- `POST /api/v1/collections/{name}/folder-vars?path=<relPath>` → saves vars for that folder

**Step 1: Add `GetFolderVars` handler** (after `SaveCollectionVars`):

```go
// GetFolderVars handles GET /api/v1/collections/{name}/folder-vars?path=<relPath>
func (h *CollectionHandler) GetFolderVars(w http.ResponseWriter, r *http.Request) {
    if r.Method == "OPTIONS" {
        w.WriteHeader(http.StatusOK)
        return
    }

    vars := mux.Vars(r)
    name := vars["name"]
    folderPath := r.URL.Query().Get("path")

    if name == "" {
        http.Error(w, "Collection name is required", http.StatusBadRequest)
        return
    }
    if folderPath == "" {
        http.Error(w, "path query parameter is required", http.StatusBadRequest)
        return
    }

    collVars, err := h.repo.ReadFolderVars(name, folderPath)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to read folder variables: %v", err), http.StatusInternalServerError)
        return
    }

    // Mask secret values before sending to the client.
    masked := make([]repository.CollectionVar, len(collVars))
    for i, v := range collVars {
        masked[i] = v
        if v.Secret {
            masked[i].Value = ""
        }
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "data":    masked,
        "success": true,
        "message": "Folder variables retrieved successfully",
    })
}

// SaveFolderVars handles POST /api/v1/collections/{name}/folder-vars?path=<relPath>
func (h *CollectionHandler) SaveFolderVars(w http.ResponseWriter, r *http.Request) {
    if r.Method == "OPTIONS" {
        w.WriteHeader(http.StatusOK)
        return
    }

    vars := mux.Vars(r)
    name := vars["name"]
    folderPath := r.URL.Query().Get("path")

    if name == "" {
        http.Error(w, "Collection name is required", http.StatusBadRequest)
        return
    }
    if folderPath == "" {
        http.Error(w, "path query parameter is required", http.StatusBadRequest)
        return
    }

    var payload struct {
        Variables []repository.CollectionVar `json:"variables"`
    }
    if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
        http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
        return
    }

    // Preserve stored secret values when the client sends an empty placeholder.
    existing, err := h.repo.ReadFolderVars(name, folderPath)
    if err == nil && len(existing) > 0 {
        existingByKey := make(map[string]string, len(existing))
        for _, v := range existing {
            if v.Secret {
                existingByKey[v.Key] = v.Value
            }
        }
        for i, v := range payload.Variables {
            if v.Secret && v.Value == "" {
                if stored, ok := existingByKey[v.Key]; ok {
                    payload.Variables[i].Value = stored
                }
            }
        }
    }

    if err := h.repo.WriteFolderVars(name, folderPath, payload.Variables); err != nil {
        http.Error(w, fmt.Sprintf("Failed to save folder variables: %v", err), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "success": true,
        "message": "Folder variables saved successfully",
    })
}
```

**Step 2: Register routes in `main.go`**

After the existing collection variables routes, add:

```go
// Folder variable routes
api.HandleFunc("/collections/{name}/folder-vars", collectionHandler.GetFolderVars).Methods("GET", "OPTIONS")
api.HandleFunc("/collections/{name}/folder-vars", collectionHandler.SaveFolderVars).Methods("POST", "OPTIONS")
```

**Step 3: Build**

```bash
cd backend && go build ./...
```

Expected: no errors.

**Step 4: Commit**

```bash
git add backend/internal/interfaces/handlers/collection_handler.go \
        backend/cmd/server/main.go
git commit -m "feat(backend): add folder-vars GET and POST endpoints"
```

---

### Task 9: Folder vars in frontend variable resolution

**Files:**
- Modify: `frontend/src/lib/api.ts` — add `getFolderVars`, `saveFolderVars`
- Modify: `frontend/src/store/collections.ts` — add `folderVariables` state + `fetchFolderVars`
- Modify: `frontend/src/lib/environment.ts` — accept folder vars in substitution
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx` — fetch folder vars when request loads, merge into send

**Context:** When a request is inside a folder (its path contains `/`), fetch that folder's vars. Merge order: collection vars < folder vars < env vars.

**Step 1: Add API methods in `api.ts`**

Following the pattern of `getCollectionVariables`/`saveCollectionVariables`, add:

```typescript
async getFolderVars(collection: string, folderPath: string): Promise<CollectionVar[]> {
  const encoded = encodeURIComponent(folderPath)
  const response = await this.request<CollectionVar[]>(
    `/collections/${collection}/folder-vars?path=${encoded}`
  )
  return response.data
},

async saveFolderVars(collection: string, folderPath: string, variables: CollectionVar[]): Promise<void> {
  await this.request(`/collections/${collection}/folder-vars?path=${encodeURIComponent(folderPath)}`, {
    method: 'POST',
    body: JSON.stringify({ variables }),
  })
},
```

**Step 2: Add `folderVariables` to collections store**

In `frontend/src/store/collections.ts`, add to the state interface and initial state:

```typescript
folderVariables: CollectionVar[]
fetchFolderVars: (collection: string, folderPath: string) => Promise<void>
```

Implementation:

```typescript
folderVariables: [],

fetchFolderVars: async (collection: string, folderPath: string) => {
  try {
    const vars = await apiService.getFolderVars(collection, folderPath)
    set({ folderVariables: vars })
  } catch {
    set({ folderVariables: [] })
  }
},
```

Reset `folderVariables: []` in `setActiveCollection` alongside `collectionVariables: []`.

**Step 3: Update `substituteRequestVariables` merge order**

In `frontend/src/lib/environment.ts`, update the signature:

```typescript
export function substituteRequestVariables(
  url: string,
  headers: Array<{ key: string; value: string; enabled: boolean }>,
  body: string,
  environment: Environment | null,
  collectionVars?: CollectionVar[],
  folderVars?: CollectionVar[]      // ← new
)
```

Update the merge block — insert folder vars between collection vars and env vars:

```typescript
// 1. Collection vars (lowest priority)
if (collectionVars) {
  for (const v of collectionVars) {
    if (v.enabled && v.key) merged[v.key] = v.value
  }
}
// 2. Folder vars (override collection vars)
if (folderVars) {
  for (const v of folderVars) {
    if (v.enabled && v.key) merged[v.key] = v.value
  }
}
// 3. Env vars (highest priority)
if (environment?.variables) {
  for (const v of environment.variables) {
    if (v.enabled) merged[v.key] = v.value
  }
}
```

**Step 4: Fetch folder vars and pass to substitution in `RequestBuilder.tsx`**

When the active request changes and it has a path with a folder component, fetch folder vars. Add a `useEffect` that fires when `currentRequest` changes:

```tsx
useEffect(() => {
  if (!currentRequest || !activeCollection) return
  // Extract folder path from the request's stored path.
  // currentRequest is loaded from the store; path is stored in tabs-store.
  const tab = tabs.find(t => t.id === activeTabId)
  const reqPath = tab?.kind === 'request' ? tab.filePath : undefined
  if (reqPath && reqPath.includes('/')) {
    const folderPath = reqPath.substring(0, reqPath.lastIndexOf('/'))
    useCollectionsStore.getState().fetchFolderVars(activeCollection.name, folderPath)
  } else {
    useCollectionsStore.setState({ folderVariables: [] })
  }
}, [currentRequest?.id, activeCollection?.name])
```

Note: `tab.filePath` is the relative path of the `.bru` file (e.g. `auth/login.bru`). Check your tabs-store to confirm the field name — look for where the path is stored when a request tab is opened from the sidebar.

In `handleSubmit`, pass `folderVariables` as the 6th argument:

```typescript
const { activeEnvironment, collectionVariables, folderVariables } = useCollectionsStore.getState()

const substituted = substituteRequestVariables(
  url,
  headers,
  body.content,
  activeEnvironment,
  collectionVariables,
  folderVariables
)
```

**Step 5: Build**

```bash
cd frontend && yarn build
```

Expected: no TypeScript errors.

**Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/store/collections.ts \
        frontend/src/lib/environment.ts frontend/src/components/request-builder/RequestBuilder.tsx
git commit -m "feat(frontend): resolve folder-level variables in request substitution"
```

---

## Phase 3 — Scripting Engine (Goja)

---

### Task 10: Script fields in `BruFile` — parser + generator

**Files:**
- Modify: `backend/pkg/bru/parser.go`
- Modify: `backend/pkg/bru/parser_test.go`

**Context:** Bruno stores scripts as:
```
script:pre-request {
  bru.setVar("token", bru.getEnvVar("API_KEY"))
}

script:post-response {
  const body = JSON.parse(res.body)
  bru.setVar("userId", body.id)
}
```

**Step 1: Write the failing test**

```go
func TestScriptRoundtrip(t *testing.T) {
    original := &BruFile{}
    original.Meta.Name = "Login"
    original.Meta.Type = "http"
    original.HTTP.Method = "POST"
    original.HTTP.URL = "https://example.com/login"
    original.Body.Type = "none"
    original.Scripts.PreRequest = `bru.setVar("token", "abc")`
    original.Scripts.PostResponse = `const b = JSON.parse(res.body); bru.setVar("id", b.id)`

    content := GenerateContent(original)
    parsed, err := ParseContent(content)
    if err != nil {
        t.Fatalf("ParseContent error: %v", err)
    }

    if parsed.Scripts.PreRequest != original.Scripts.PreRequest {
        t.Errorf("Scripts.PreRequest: got %q, want %q", parsed.Scripts.PreRequest, original.Scripts.PreRequest)
    }
    if parsed.Scripts.PostResponse != original.Scripts.PostResponse {
        t.Errorf("Scripts.PostResponse: got %q, want %q", parsed.Scripts.PostResponse, original.Scripts.PostResponse)
    }
}
```

**Step 2: Run to confirm fail**

```bash
cd backend && go test ./pkg/bru/... -run TestScriptRoundtrip -v
```

**Step 3: Add `Scripts` to `BruFile`**

In `parser.go`, inside `BruFile` struct, add after `Docs`:

```go
Scripts struct {
    PreRequest   string `json:"preRequest,omitempty"`
    PostResponse string `json:"postResponse,omitempty"`
} `json:"scripts,omitempty"`
Tests string `json:"tests,omitempty"`
```

(Add `Tests` now too so Task 15 is a smaller diff.)

**Step 4: Parser — handle `script:pre-request` and `script:post-response` blocks**

These blocks contain raw JavaScript — use the same raw-accumulation pattern as `docs`. Add state variables:

```go
inScriptPreBlock  := false
inScriptPostBlock := false
var scriptPreLines  []string
var scriptPostLines []string
```

In the scanner loop, before the `inDataBlock` check, add:

```go
if inScriptPreBlock {
    if trimmed == "}" {
        inScriptPreBlock = false
        contextStack = contextStack[:len(contextStack)-1]
        bru.Scripts.PreRequest = strings.TrimRight(strings.Join(scriptPreLines, "\n"), "\n")
        scriptPreLines = nil
        continue
    }
    stripped := line
    if strings.HasPrefix(line, "  ") { stripped = line[2:] }
    scriptPreLines = append(scriptPreLines, stripped)
    continue
}

if inScriptPostBlock {
    if trimmed == "}" {
        inScriptPostBlock = false
        contextStack = contextStack[:len(contextStack)-1]
        bru.Scripts.PostResponse = strings.TrimRight(strings.Join(scriptPostLines, "\n"), "\n")
        scriptPostLines = nil
        continue
    }
    stripped := line
    if strings.HasPrefix(line, "  ") { stripped = line[2:] }
    scriptPostLines = append(scriptPostLines, stripped)
    continue
}
```

In the block-open section, add:

```go
if blockName == "script:pre-request" {
    inScriptPreBlock = true
}
if blockName == "script:post-response" {
    inScriptPostBlock = true
}
```

**Step 5: Generator — emit script blocks**

In `GenerateContent`, after the docs block, add:

```go
if bru.Scripts.PreRequest != "" {
    content.WriteString("\nscript:pre-request {\n")
    for line := range strings.SplitSeq(bru.Scripts.PreRequest, "\n") {
        fmt.Fprintf(&content, "  %s\n", line)
    }
    content.WriteString("}\n")
}

if bru.Scripts.PostResponse != "" {
    content.WriteString("\nscript:post-response {\n")
    for line := range strings.SplitSeq(bru.Scripts.PostResponse, "\n") {
        fmt.Fprintf(&content, "  %s\n", line)
    }
    content.WriteString("}\n")
}
```

**Step 6: Run all tests**

```bash
cd backend && go test ./pkg/bru/... -v
```

Expected: all PASS.

**Step 7: Commit**

```bash
git add backend/pkg/bru/parser.go backend/pkg/bru/parser_test.go
git commit -m "feat(bru): parse and generate script blocks"
```

---

### Task 11: Script executor using Goja

**Files:**
- Create: `backend/internal/app/script_executor.go`
- Create: `backend/internal/app/script_executor_test.go`

**Context:** Goja is a pure-Go JavaScript engine — no CGO. Install it with `go get github.com/dop251/goja`.

**Step 1: Add Goja dependency**

```bash
cd backend && go get github.com/dop251/goja
```

Verify `go.mod` now lists `github.com/dop251/goja`.

**Step 2: Write a failing test** in `script_executor_test.go`:

```go
package app

import (
    "testing"
)

func TestRunPreRequest_SetVar(t *testing.T) {
    ex := NewScriptExecutor(
        map[string]string{"API_KEY": "secret"},  // env vars
        map[string]string{},                      // initial script vars
    )
    result := ex.RunPreRequest(`bru.setVar("token", bru.getEnvVar("API_KEY"))`)
    if result.Error != "" {
        t.Fatalf("script error: %s", result.Error)
    }
    if result.Vars["token"] != "secret" {
        t.Errorf("Vars[token]: got %q, want %q", result.Vars["token"], "secret")
    }
}

func TestRunPostResponse_ExtractVar(t *testing.T) {
    ex := NewScriptExecutor(
        map[string]string{},
        map[string]string{},
    )
    result := ex.RunPostResponse(
        `const b = JSON.parse(res.body); bru.setVar("userId", String(b.id))`,
        ScriptResponse{
            Status:      200,
            Headers:     map[string]string{"Content-Type": "application/json"},
            Body:        `{"id": 42}`,
            ResponseTime: 120,
        },
    )
    if result.Error != "" {
        t.Fatalf("script error: %s", result.Error)
    }
    if result.Vars["userId"] != "42" {
        t.Errorf("Vars[userId]: got %q, want %q", result.Vars["userId"], "42")
    }
}
```

**Step 3: Run to confirm fail**

```bash
cd backend && go test ./internal/app/... -run "TestRunPreRequest|TestRunPostResponse" -v
```

Expected: FAIL — `ScriptExecutor` does not exist.

**Step 4: Implement `script_executor.go`**

```go
package app

import (
    "fmt"
    "strings"

    "github.com/dop251/goja"
)

// ScriptResult holds the output of a script run.
type ScriptResult struct {
    Vars          map[string]string // variables set via bru.setVar
    UpdatedEnvVars map[string]string // env vars mutated via bru.setEnvVar
    ConsoleOutput []string
    Error         string
}

// ScriptResponse is the response object exposed to post-response scripts.
type ScriptResponse struct {
    Status       int
    Headers      map[string]string
    Body         string
    ResponseTime int64
}

// ScriptExecutor runs pre-request and post-response scripts in a Goja VM.
type ScriptExecutor struct {
    envVars  map[string]string // read-only snapshot of env vars
    scriptVars map[string]string // runtime vars set by scripts
}

// NewScriptExecutor creates a new executor with the given environment and initial script vars.
func NewScriptExecutor(envVars map[string]string, initialVars map[string]string) *ScriptExecutor {
    vars := make(map[string]string)
    for k, v := range initialVars {
        vars[k] = v
    }
    return &ScriptExecutor{
        envVars:    envVars,
        scriptVars: vars,
    }
}

// RunPreRequest executes a pre-request script and returns the result.
func (e *ScriptExecutor) RunPreRequest(script string) ScriptResult {
    return e.run(script, nil)
}

// RunPostResponse executes a post-response script with access to the response.
func (e *ScriptExecutor) RunPostResponse(script string, resp ScriptResponse) ScriptResult {
    return e.run(script, &resp)
}

func (e *ScriptExecutor) run(script string, resp *ScriptResponse) ScriptResult {
    result := ScriptResult{
        Vars:           make(map[string]string),
        UpdatedEnvVars: make(map[string]string),
    }

    vm := goja.New()
    updatedEnv := make(map[string]string)

    // Inject bru object.
    bruObj := vm.NewObject()
    bruObj.Set("setVar", func(call goja.FunctionCall) goja.Value {
        if len(call.Arguments) >= 2 {
            key := call.Arguments[0].String()
            val := call.Arguments[1].String()
            e.scriptVars[key] = val
        }
        return goja.Undefined()
    })
    bruObj.Set("getVar", func(call goja.FunctionCall) goja.Value {
        if len(call.Arguments) >= 1 {
            key := call.Arguments[0].String()
            if v, ok := e.scriptVars[key]; ok {
                return vm.ToValue(v)
            }
            if v, ok := e.envVars[key]; ok {
                return vm.ToValue(v)
            }
        }
        return goja.Undefined()
    })
    bruObj.Set("getEnvVar", func(call goja.FunctionCall) goja.Value {
        if len(call.Arguments) >= 1 {
            key := call.Arguments[0].String()
            if v, ok := e.envVars[key]; ok {
                return vm.ToValue(v)
            }
        }
        return goja.Undefined()
    })
    bruObj.Set("setEnvVar", func(call goja.FunctionCall) goja.Value {
        if len(call.Arguments) >= 2 {
            key := call.Arguments[0].String()
            val := call.Arguments[1].String()
            updatedEnv[key] = val
        }
        return goja.Undefined()
    })
    vm.Set("bru", bruObj)

    // Inject console.log.
    consoleObj := vm.NewObject()
    consoleObj.Set("log", func(call goja.FunctionCall) goja.Value {
        parts := make([]string, len(call.Arguments))
        for i, a := range call.Arguments {
            parts[i] = a.String()
        }
        result.ConsoleOutput = append(result.ConsoleOutput, strings.Join(parts, " "))
        return goja.Undefined()
    })
    vm.Set("console", consoleObj)

    // Inject res object if this is a post-response script.
    if resp != nil {
        resObj := vm.NewObject()
        resObj.Set("status", resp.Status)
        resObj.Set("body", resp.Body)
        resObj.Set("responseTime", resp.ResponseTime)
        headersObj := vm.NewObject()
        for k, v := range resp.Headers {
            headersObj.Set(k, v)
        }
        resObj.Set("headers", headersObj)
        resObj.Set("getHeader", func(call goja.FunctionCall) goja.Value {
            if len(call.Arguments) >= 1 {
                key := call.Arguments[0].String()
                if v, ok := resp.Headers[key]; ok {
                    return vm.ToValue(v)
                }
            }
            return goja.Undefined()
        })
        vm.Set("res", resObj)
    }

    // Run the script.
    if _, err := vm.RunString(script); err != nil {
        result.Error = fmt.Sprintf("script error: %v", err)
        return result
    }

    // Collect vars set during this run.
    for k, v := range e.scriptVars {
        result.Vars[k] = v
    }
    result.UpdatedEnvVars = updatedEnv

    return result
}
```

**Step 5: Run all tests**

```bash
cd backend && go test ./internal/app/... -v
```

Expected: all PASS.

**Step 6: Commit**

```bash
git add backend/internal/app/script_executor.go backend/internal/app/script_executor_test.go
git commit -m "feat(backend): Goja-based script executor with bru/req/res API"
```

---

### Task 12: Wire script execution into `SendRequestHandler`

**Files:**
- Modify: `backend/internal/interfaces/handlers/request_handler.go`

**Context:** The request flow becomes:
1. Receive payload (which now includes `preRequestScript`, `postResponseScript`)
2. Run pre-request script → apply any `scriptVars` mutations by substituting into URL/headers/body
3. Send HTTP request
4. Run post-response script → collect updated vars and console output
5. Return response envelope enriched with `scriptOutput` and `updatedVars`

**Step 1: Add script fields to `RequestPayload`**

In `RequestPayload` struct, add:

```go
PreRequestScript  string `json:"preRequestScript,omitempty"`
PostResponseScript string `json:"postResponseScript,omitempty"`
EnvVars           map[string]string `json:"envVars,omitempty"` // active env vars for bru.getEnvVar
```

**Step 2: Add script execution before and after the HTTP call**

After the `payload.URL == ""` guard, add pre-request execution:

```go
// Import the app package at the top of the file.
// "github.com/yourusername/rocket-api/internal/app"

scriptVars := map[string]string{}
envVars := payload.EnvVars
if envVars == nil {
    envVars = map[string]string{}
}

if payload.PreRequestScript != "" {
    executor := app.NewScriptExecutor(envVars, scriptVars)
    preResult := executor.RunPreRequest(payload.PreRequestScript)
    if preResult.Error == "" {
        // Merge script vars into the final var map for substitution.
        scriptVars = preResult.Vars
        // Apply updated env vars.
        for k, v := range preResult.UpdatedEnvVars {
            envVars[k] = v
        }
    }
    // Note: pre-request script errors are non-fatal — log and continue.
}
```

After reading `resp.Body` and before building `responsePayload`, add post-response execution:

```go
var scriptOutput []string
var postScriptError string
var updatedVars map[string]string

if payload.PostResponseScript != "" {
    executor := app.NewScriptExecutor(envVars, scriptVars)
    postResult := executor.RunPostResponse(
        payload.PostResponseScript,
        app.ScriptResponse{
            Status:       resp.StatusCode,
            Headers:      headers,
            Body:         string(bodyBytes),
            ResponseTime: duration.Milliseconds(),
        },
    )
    scriptOutput = postResult.ConsoleOutput
    postScriptError = postResult.Error
    updatedVars = postResult.Vars
}
```

**Step 3: Include script output in the response envelope**

Update the final `json.NewEncoder(w).Encode(...)` call to include:

```go
json.NewEncoder(w).Encode(map[string]interface{}{
    "data":          responsePayload,
    "success":       true,
    "message":       "Request completed successfully",
    "scriptOutput":  scriptOutput,
    "scriptError":   postScriptError,
    "updatedVars":   updatedVars,
})
```

**Step 4: Build**

```bash
cd backend && go build ./...
```

Expected: no errors.

**Step 5: Commit**

```bash
git add backend/internal/interfaces/handlers/request_handler.go
git commit -m "feat(backend): run pre/post-response scripts around HTTP request"
```

---

### Task 13: Script types + API wiring in frontend

**Files:**
- Modify: `frontend/src/types/index.ts` — add script fields to `BruFile`, add `ScriptResult`
- Modify: `frontend/src/lib/api.ts` — include `preRequestScript`, `postResponseScript`, `envVars` in `sendRequest` payload; parse `scriptOutput` and `updatedVars` from response
- Modify: `frontend/src/store/tabs-store.ts` — add `scriptOutput` to tab response state

**Step 1: Add types**

In `types/index.ts`:

```typescript
export interface ScriptResult {
  consoleOutput: string[]
  error?: string
  updatedVars?: Record<string, string>
}
```

Extend `BruFile`:
```typescript
scripts?: {
  preRequest?: string
  postResponse?: string
}
```

Extend `HttpResponse` with optional script output:
```typescript
export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  size: number
  time: number
  scriptOutput?: string[]     // ← new
  scriptError?: string        // ← new
  updatedVars?: Record<string, string>  // ← new
}
```

**Step 2: Pass script content and env vars in `apiService.sendRequest`**

In `api.ts`, update the `sendRequest` call to include:
```typescript
preRequestScript: requestData.preRequestScript ?? '',
postResponseScript: requestData.postResponseScript ?? '',
envVars: requestData.envVars ?? {},
```

The `requestData` object is constructed in `RequestBuilder.tsx`'s `handleSubmit`. You'll expand it in Task 14.

**Step 3: Parse script output from API response**

In the response parsing code in `api.ts` (or in `RequestBuilder.tsx` where the response is handled), extract:
```typescript
const scriptOutput: string[] = response.scriptOutput ?? []
const scriptError: string | undefined = response.scriptError ?? undefined
const updatedVars = response.updatedVars ?? {}
```

Pass `scriptOutput` and `scriptError` into the `HttpResponse` object stored in the tab state.

**Step 4: Build**

```bash
cd frontend && yarn build
```

**Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts frontend/src/store/tabs-store.ts
git commit -m "feat(frontend): add script types and wire script output through API"
```

---

### Task 14: Pre-request + Post-response script editor tabs

**Files:**
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx`

**Context:** Add two Monaco editor tabs — "Pre-request" and "Post-response" — to the request builder. Below each editor, show a collapsible console output panel when there is output. The script content is saved alongside the request.

**Step 1: Add script state**

```tsx
const [preRequestScript, setPreRequestScript] = useState('')
const [postResponseScript, setPostResponseScript] = useState('')
```

In the `useEffect` sync block:
```tsx
setPreRequestScript(currentRequest.preRequestScript ?? '')
setPostResponseScript(currentRequest.postResponseScript ?? '')
```

Add `preRequestScript?: string` and `postResponseScript?: string` to `HttpRequest` in `types/index.ts`.

**Step 2: Add tab triggers**

```tsx
<TabsTrigger value="pre-request">Pre-request</TabsTrigger>
<TabsTrigger value="post-response">Post-response</TabsTrigger>
```

**Step 3: Add tab content**

```tsx
<TabsContent value="pre-request" className="flex-1 flex flex-col overflow-hidden">
  <div className="flex-1 overflow-hidden">
    <MonacoEditor
      value={preRequestScript}
      onChange={v => setPreRequestScript(v ?? '')}
      language="javascript"
      className="h-full"
    />
  </div>
  {/* Console output shown after send */}
  {response?.scriptOutput && response.scriptOutput.length > 0 && (
    <div className="border-t border-border bg-muted/30 p-2 max-h-32 overflow-auto text-xs font-mono">
      {response.scriptOutput.map((line, i) => (
        <div key={i} className="text-muted-foreground">{line}</div>
      ))}
    </div>
  )}
</TabsContent>

<TabsContent value="post-response" className="flex-1 flex flex-col overflow-hidden">
  <div className="flex-1 overflow-hidden">
    <MonacoEditor
      value={postResponseScript}
      onChange={v => setPostResponseScript(v ?? '')}
      language="javascript"
      className="h-full"
    />
  </div>
  {response?.scriptError && (
    <div className="border-t border-border bg-red-50 dark:bg-red-950/30 p-2 text-xs font-mono text-red-600 dark:text-red-400">
      {response.scriptError}
    </div>
  )}
  {response?.scriptOutput && response.scriptOutput.length > 0 && (
    <div className="border-t border-border bg-muted/30 p-2 max-h-32 overflow-auto text-xs font-mono">
      {response.scriptOutput.map((line, i) => (
        <div key={i} className="text-muted-foreground">{line}</div>
      ))}
    </div>
  )}
</TabsContent>
```

**Step 4: Pass scripts in `handleSubmit`**

In the `sendRequest` call inside `handleSubmit`, add:
```typescript
preRequestScript,
postResponseScript,
envVars: Object.fromEntries(
  (activeEnvironment?.variables ?? [])
    .filter(v => v.enabled)
    .map(v => [v.key, v.value])
),
```

**Step 5: Wire scripts into save/load**

Add `updateActiveScripts` to the tabs store (similar pattern to `updateActiveName`). Call it in `handleSaveRequest`. In the tabs-store serialization path where the `BruFile` is built for the backend, include `scripts.preRequest` and `scripts.postResponse`.

**Step 6: Build and smoke test**

```bash
cd frontend && yarn build
```

Test: write `console.log("hello from pre-request")` in the Pre-request tab. Send a request. The console panel should show the log line.

**Step 7: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/request-builder/RequestBuilder.tsx frontend/src/store/tabs-store.ts
git commit -m "feat(frontend): add Pre-request and Post-response script editor tabs"
```

---

## Phase 4 — Test Framework

---

### Task 15: `Tests` field in `BruFile` — parser + generator

**Files:**
- Modify: `backend/pkg/bru/parser.go` (if `Tests` wasn't added in Task 10, add it now)
- Modify: `backend/pkg/bru/parser_test.go`

**Context:** The `tests {}` block stores raw JavaScript. It was already added to the `BruFile` struct in Task 10. This task adds the parser and generator for it.

**Step 1: Write the failing test**

```go
func TestTestsBlockRoundtrip(t *testing.T) {
    original := &BruFile{}
    original.Meta.Name = "Get Users"
    original.Meta.Type = "http"
    original.HTTP.Method = "GET"
    original.HTTP.URL = "https://example.com/users"
    original.Body.Type = "none"
    original.Tests = `test("status is 200", function() {
  expect(res.status).to.equal(200)
})`

    content := GenerateContent(original)
    parsed, err := ParseContent(content)
    if err != nil {
        t.Fatalf("ParseContent error: %v", err)
    }

    if parsed.Tests != original.Tests {
        t.Errorf("Tests: got %q, want %q", parsed.Tests, original.Tests)
    }
}
```

**Step 2: Run to confirm fail or pass**

```bash
cd backend && go test ./pkg/bru/... -run TestTestsBlockRoundtrip -v
```

If `Tests string` was added in Task 10 but the parser/generator wasn't, it will fail here.

**Step 3: Add parser support for `tests { ... }` block**

Add alongside the script block variables in `ParseContent`:

```go
inTestsBlock  := false
var testsLines []string
```

Before `inDataBlock` check:

```go
if inTestsBlock {
    if trimmed == "}" {
        inTestsBlock = false
        contextStack = contextStack[:len(contextStack)-1]
        bru.Tests = strings.TrimRight(strings.Join(testsLines, "\n"), "\n")
        testsLines = nil
        continue
    }
    stripped := line
    if strings.HasPrefix(line, "  ") { stripped = line[2:] }
    testsLines = append(testsLines, stripped)
    continue
}
```

In block-open:

```go
if blockName == "tests" {
    inTestsBlock = true
}
```

**Step 4: Add generator support**

After the script blocks in `GenerateContent`:

```go
if bru.Tests != "" {
    content.WriteString("\ntests {\n")
    for line := range strings.SplitSeq(bru.Tests, "\n") {
        fmt.Fprintf(&content, "  %s\n", line)
    }
    content.WriteString("}\n")
}
```

**Step 5: Run all tests**

```bash
cd backend && go test ./pkg/bru/... -v
```

Expected: all PASS.

**Step 6: Commit**

```bash
git add backend/pkg/bru/parser.go backend/pkg/bru/parser_test.go
git commit -m "feat(bru): parse and generate tests block"
```

---

### Task 16: Test runner in `ScriptExecutor`

**Files:**
- Modify: `backend/internal/app/script_executor.go`
- Modify: `backend/internal/app/script_executor_test.go`

**Context:** Tests run after `script:post-response` in the same Goja VM. The `test()` function records pass/fail. The `expect()` function implements Bruno's assertion API.

**Step 1: Write the failing test**

```go
func TestRunTests_PassAndFail(t *testing.T) {
    ex := NewScriptExecutor(map[string]string{}, map[string]string{})
    testsBlock := `
test("status is 200", function() {
    expect(res.status).to.equal(200)
})
test("body has error", function() {
    expect(res.body).to.include("error")
})`
    results := ex.RunTests(
        testsBlock,
        ScriptResponse{Status: 200, Body: `{"ok": true}`, Headers: map[string]string{}, ResponseTime: 10},
    )

    if len(results) != 2 {
        t.Fatalf("expected 2 results, got %d", len(results))
    }
    if !results[0].Passed {
        t.Errorf("test[0] should pass: %s", results[0].Error)
    }
    if results[1].Passed {
        t.Errorf("test[1] should fail")
    }
}
```

**Step 2: Run to confirm fail**

```bash
cd backend && go test ./internal/app/... -run TestRunTests -v
```

**Step 3: Add `TestResult` and `RunTests` to `script_executor.go`**

```go
// TestResult holds the result of a single test() call.
type TestResult struct {
    Name   string `json:"name"`
    Passed bool   `json:"passed"`
    Error  string `json:"error,omitempty"`
}

// RunTests runs the tests {} block after a response.
func (e *ScriptExecutor) RunTests(testsBlock string, resp ScriptResponse) []TestResult {
    var results []TestResult

    vm := goja.New()

    // Inject res object.
    resObj := vm.NewObject()
    resObj.Set("status", resp.Status)
    resObj.Set("body", resp.Body)
    resObj.Set("responseTime", resp.ResponseTime)
    headersObj := vm.NewObject()
    for k, v := range resp.Headers {
        headersObj.Set(k, v)
    }
    resObj.Set("headers", headersObj)
    resObj.Set("getHeader", func(call goja.FunctionCall) goja.Value {
        if len(call.Arguments) >= 1 {
            if v, ok := resp.Headers[call.Arguments[0].String()]; ok {
                return vm.ToValue(v)
            }
        }
        return goja.Undefined()
    })
    vm.Set("res", resObj)

    // Inject expect() — returns a chainable assertion object.
    vm.Set("expect", func(call goja.FunctionCall) goja.Value {
        var actual interface{}
        if len(call.Arguments) > 0 {
            actual = call.Arguments[0].Export()
        }
        return buildExpect(vm, actual)
    })

    // Inject test().
    vm.Set("test", func(call goja.FunctionCall) goja.Value {
        if len(call.Arguments) < 2 {
            return goja.Undefined()
        }
        name := call.Arguments[0].String()
        fn, ok := goja.AssertFunction(call.Arguments[1])
        if !ok {
            results = append(results, TestResult{Name: name, Passed: false, Error: "second argument is not a function"})
            return goja.Undefined()
        }

        tr := TestResult{Name: name}
        func() {
            defer func() {
                if r := recover(); r != nil {
                    tr.Passed = false
                    tr.Error = fmt.Sprintf("%v", r)
                }
            }()
            if _, err := fn(goja.Undefined()); err != nil {
                tr.Passed = false
                tr.Error = err.Error()
            } else {
                tr.Passed = true
            }
        }()
        results = append(results, tr)
        return goja.Undefined()
    })

    vm.RunString(testsBlock) // ignore top-level error; individual test errors are captured
    return results
}

// buildExpect creates the chainable expect() assertion object.
func buildExpect(vm *goja.Runtime, actual interface{}) goja.Value {
    obj := vm.NewObject()

    // .to property — returns same object for chaining
    obj.Set("to", obj)
    obj.Set("be", obj)
    obj.Set("a", obj)
    obj.Set("an", obj)

    // .equal(expected)
    obj.Set("equal", func(call goja.FunctionCall) goja.Value {
        expected := call.Arguments[0].Export()
        if fmt.Sprintf("%v", actual) != fmt.Sprintf("%v", expected) {
            panic(fmt.Sprintf("expected %v to equal %v", actual, expected))
        }
        return goja.Undefined()
    })

    // .include(substr)
    obj.Set("include", func(call goja.FunctionCall) goja.Value {
        substr := call.Arguments[0].String()
        s := fmt.Sprintf("%v", actual)
        if !strings.Contains(s, substr) {
            panic(fmt.Sprintf("expected %q to include %q", s, substr))
        }
        return goja.Undefined()
    })

    // .a("type") / .an("type")
    obj.Set("a", func(call goja.FunctionCall) goja.Value {
        typeName := call.Arguments[0].String()
        switch typeName {
        case "number":
            switch actual.(type) {
            case int64, float64, int:
            default:
                panic(fmt.Sprintf("expected %v to be a number", actual))
            }
        case "string":
            if _, ok := actual.(string); !ok {
                panic(fmt.Sprintf("expected %v to be a string", actual))
            }
        case "array":
            if _, ok := actual.([]interface{}); !ok {
                panic(fmt.Sprintf("expected %v to be an array", actual))
            }
        case "object":
            if _, ok := actual.(map[string]interface{}); !ok {
                panic(fmt.Sprintf("expected %v to be an object", actual))
            }
        }
        return obj
    })

    // .greaterThan(n)
    obj.Set("greaterThan", func(call goja.FunctionCall) goja.Value {
        expected, _ := call.Arguments[0].Export().(int64)
        var got int64
        switch v := actual.(type) {
        case int64: got = v
        case float64: got = int64(v)
        }
        if got <= expected {
            panic(fmt.Sprintf("expected %v to be greater than %v", actual, expected))
        }
        return goja.Undefined()
    })

    // .lessThan(n)
    obj.Set("lessThan", func(call goja.FunctionCall) goja.Value {
        expected, _ := call.Arguments[0].Export().(int64)
        var got int64
        switch v := actual.(type) {
        case int64: got = v
        case float64: got = int64(v)
        }
        if got >= expected {
            panic(fmt.Sprintf("expected %v to be less than %v", actual, expected))
        }
        return goja.Undefined()
    })

    // .null / .true / .false / .undefined (accessor-style via getter workaround)
    // Simplest approach: set as boolean properties.
    obj.Set("null", func(call goja.FunctionCall) goja.Value {
        if actual != nil {
            panic(fmt.Sprintf("expected %v to be null", actual))
        }
        return goja.Undefined()
    })
    obj.Set("true", func(call goja.FunctionCall) goja.Value {
        if actual != true {
            panic(fmt.Sprintf("expected %v to be true", actual))
        }
        return goja.Undefined()
    })
    obj.Set("false", func(call goja.FunctionCall) goja.Value {
        if actual != false {
            panic(fmt.Sprintf("expected %v to be false", actual))
        }
        return goja.Undefined()
    })

    return obj
}
```

Note: `.null`, `.true`, `.false`, `.undefined` in Bruno are property accessors (getters), not method calls. The simplest Go-side approach is to expose them as functions and document that callers write `expect(x).to.null()`. Full getter-based support requires `Object.defineProperty` calls via Goja, which is more complex — implement function-style first and document it.

**Step 4: Run all tests**

```bash
cd backend && go test ./internal/app/... -v
```

Expected: all PASS.

**Step 5: Wire `RunTests` into `SendRequestHandler`**

In `request_handler.go`, after the post-response script block (Task 12), add:

```go
var testResults []app.TestResult
if payload.TestsScript != "" {
    testResults = executor.RunTests(payload.TestsScript, app.ScriptResponse{
        Status:       resp.StatusCode,
        Headers:      headers,
        Body:         string(bodyBytes),
        ResponseTime: duration.Milliseconds(),
    })
}
```

Add `TestsScript string` to `RequestPayload`.

Include `testResults` in the response envelope:

```go
"tests": testResults,
```

**Step 6: Commit**

```bash
git add backend/internal/app/script_executor.go backend/internal/app/script_executor_test.go \
        backend/internal/interfaces/handlers/request_handler.go
git commit -m "feat(backend): test runner with test() and expect() API"
```

---

### Task 17: Tests tab in response panel

**Files:**
- Modify: `frontend/src/types/index.ts` — add `TestResult`, `tests` to `HttpResponse`
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx` — Tests response tab

**Step 1: Add `TestResult` type and `tests` to `HttpResponse`**

In `types/index.ts`:

```typescript
export interface TestResult {
  name: string
  passed: boolean
  error?: string
}
```

Extend `HttpResponse`:

```typescript
tests?: TestResult[]
```

**Step 2: Parse `tests` from API response**

In the response-parsing code, extract:
```typescript
const tests: TestResult[] = response.tests ?? []
```

Pass into `HttpResponse` stored in tab state.

**Step 3: Add Tests tab to response panel**

The response panel currently has tabs: `body`, `headers`, `raw`. Find the response `TabsList` and add:

```tsx
<TabsTrigger value="tests">
  Tests {response.tests && response.tests.length > 0 && (
    <span className="ml-1 text-[10px] font-mono">
      ({response.tests.filter(t => t.passed).length}/{response.tests.length})
    </span>
  )}
</TabsTrigger>
```

Add the tab content:

```tsx
<TabsContent value="tests" className="flex-1 overflow-auto p-3">
  {!response?.tests || response.tests.length === 0 ? (
    <p className="text-xs text-muted-foreground italic">No tests ran for this request.</p>
  ) : (
    <div className="space-y-1">
      {response.tests.map((test, i) => (
        <div key={i} className={`flex items-start gap-2 py-1.5 px-2 rounded text-xs ${
          test.passed ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'
        }`}>
          <span className={`shrink-0 font-semibold ${test.passed ? 'text-green-600' : 'text-red-600'}`}>
            {test.passed ? '✓' : '✗'}
          </span>
          <div>
            <span className="font-medium">{test.name}</span>
            {test.error && (
              <p className="text-muted-foreground mt-0.5 font-mono">{test.error}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )}
</TabsContent>
```

**Step 4: Build**

```bash
cd frontend && yarn build
```

**Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/request-builder/RequestBuilder.tsx
git commit -m "feat(frontend): add Tests tab to response panel"
```

---

### Task 18: Tests editor tab in request builder

**Files:**
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx`

**Step 1: Add tests script state**

```tsx
const [testsScript, setTestsScript] = useState('')
```

In sync `useEffect`:
```tsx
setTestsScript(currentRequest.testsScript ?? '')
```

Add `testsScript?: string` to `HttpRequest` in `types/index.ts`.

**Step 2: Add Tests tab trigger**

```tsx
<TabsTrigger value="tests">Tests</TabsTrigger>
```

**Step 3: Add Tests tab content**

```tsx
<TabsContent value="tests" className="flex-1 overflow-hidden">
  <MonacoEditor
    value={testsScript}
    onChange={v => setTestsScript(v ?? '')}
    language="javascript"
    className="h-full"
  />
</TabsContent>
```

**Step 4: Pass tests in `handleSubmit`**

```typescript
testsScript,
```

(The backend `TestsScript` field added in Task 16 picks this up.)

**Step 5: Wire into save/load**

In `handleSaveRequest` / tabs-store, include `testsScript` alongside the other script fields.

**Step 6: Build**

```bash
cd frontend && yarn build
```

Smoke test: write a simple test (`test("always passes", function() { expect(1).to.equal(1) })`), send any request. The response Tests tab should show ✓.

**Step 7: Final commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/request-builder/RequestBuilder.tsx \
        frontend/src/store/tabs-store.ts
git commit -m "feat(frontend): add Tests script editor tab to request builder"
```

---

## Final verification

Run all backend tests:

```bash
cd backend && go test ./... -v
```

Build the frontend:

```bash
cd frontend && yarn build
```

Both must pass before declaring any phase complete.

---

## Updated request builder tab layout (after all phases)

```
Request tabs:          Response tabs:
  Params                 Body
  Headers                Headers
  Body                   Raw
  Auth                   Tests  ← Phase 4
  Pre-request  ← Ph 3
  Post-response ← Ph 3
  Tests  ← Phase 4
  Docs   ← Phase 2
```
