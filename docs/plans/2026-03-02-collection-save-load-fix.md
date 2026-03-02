# Collection Save/Load Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix requests loading as empty after save, and fix the sidebar not refreshing after save.

**Architecture:** Two bugs. (1) The bru parser uses `:` suffix section detection but the writer produces `section { }` block syntax — they have never been compatible. Fix: rewrite `ParseContent` to handle block syntax, and fix `GenerateContent` to use `Body.Data` instead of `HTTP.Body` as the body content source. (2) After save, the frontend never calls `fetchCollectionTree`, so new files don't appear in the sidebar until the user manually toggles the collection.

**Tech Stack:** Go (backend bru package), React + TypeScript + Zustand (frontend)

---

### Task 1: Write failing tests for `bru.ParseContent`

**Files:**
- Create: `backend/pkg/bru/parser_test.go`

**Step 1: Create the test file**

```go
package bru

import (
	"testing"
)

// TestParseContentRoundtrip verifies that a BruFile survives a write→parse roundtrip.
func TestParseContentRoundtrip(t *testing.T) {
	original := &BruFile{}
	original.Meta.Name = "Get Users"
	original.Meta.Type = "http"
	original.Meta.Seq = 1
	original.HTTP.Method = "GET"
	original.HTTP.URL = "https://api.example.com/users"
	original.HTTP.Headers = []Header{
		{Key: "Accept", Value: "application/json"},
	}
	original.HTTP.QueryParams = []QueryParam{
		{Key: "page", Value: "1", Enabled: true},
	}
	original.Body.Type = "none"

	content := GenerateContent(original)
	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.Meta.Name != original.Meta.Name {
		t.Errorf("meta.name: got %q, want %q", parsed.Meta.Name, original.Meta.Name)
	}
	if parsed.HTTP.Method != original.HTTP.Method {
		t.Errorf("http.method: got %q, want %q", parsed.HTTP.Method, original.HTTP.Method)
	}
	if parsed.HTTP.URL != original.HTTP.URL {
		t.Errorf("http.url: got %q, want %q", parsed.HTTP.URL, original.HTTP.URL)
	}
	if len(parsed.HTTP.Headers) != 1 || parsed.HTTP.Headers[0].Key != "Accept" {
		t.Errorf("http.headers: got %+v", parsed.HTTP.Headers)
	}
	if len(parsed.HTTP.QueryParams) != 1 || parsed.HTTP.QueryParams[0].Key != "page" {
		t.Errorf("http.queryParams: got %+v", parsed.HTTP.QueryParams)
	}
}

// TestParseContentWithBody verifies body data survives the roundtrip.
func TestParseContentWithBody(t *testing.T) {
	original := &BruFile{}
	original.Meta.Name = "Create User"
	original.Meta.Type = "http"
	original.HTTP.Method = "POST"
	original.HTTP.URL = "https://api.example.com/users"
	original.Body.Type = "json"
	original.Body.Data = `{"name":"Alice"}`

	content := GenerateContent(original)
	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.Body.Type != "json" {
		t.Errorf("body.type: got %q, want %q", parsed.Body.Type, "json")
	}
	if parsed.Body.Data != original.Body.Data {
		t.Errorf("body.data: got %q, want %q", parsed.Body.Data, original.Body.Data)
	}
}

// TestParseContentBearerAuth verifies bearer auth survives the roundtrip.
func TestParseContentBearerAuth(t *testing.T) {
	original := &BruFile{}
	original.Meta.Name = "Secure Request"
	original.Meta.Type = "http"
	original.HTTP.Method = "GET"
	original.HTTP.URL = "https://api.example.com/secure"
	original.HTTP.Auth = &AuthConfig{
		Type: "bearer",
		Bearer: &struct {
			Token string `json:"token"`
		}{Token: "my-secret-token"},
	}
	original.Body.Type = "none"

	content := GenerateContent(original)
	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.HTTP.Auth == nil {
		t.Fatal("http.auth is nil")
	}
	if parsed.HTTP.Auth.Type != "bearer" {
		t.Errorf("auth.type: got %q, want %q", parsed.HTTP.Auth.Type, "bearer")
	}
	if parsed.HTTP.Auth.Bearer == nil || parsed.HTTP.Auth.Bearer.Token != "my-secret-token" {
		t.Errorf("auth.bearer.token: got %+v", parsed.HTTP.Auth.Bearer)
	}
}
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/numericlabs/data/rocket-api/backend
go test ./pkg/bru/... -v -run TestParseContent
```

Expected: all three tests FAIL — meta.name, http.method, http.url will be empty strings.

**Step 3: Commit the test file**

```bash
git add backend/pkg/bru/parser_test.go
git commit -m "test(bru): add failing roundtrip tests for ParseContent"
```

---

### Task 2: Fix `GenerateContent` to use `Body.Data` as body content source

**Files:**
- Modify: `backend/pkg/bru/parser.go` — `GenerateContent` function only

**Background:** The frontend sends body content as `body.data` (→ `BruFile.Body.Data`). `GenerateContent` currently reads `bru.HTTP.Body`, which is always empty when called from the save path. Fix: prefer `Body.Data`, fall back to `HTTP.Body`.

**Step 1: Edit `GenerateContent` in `backend/pkg/bru/parser.go`**

Find this block (around line 286):
```go
// Body section
if bru.Body.Type != "" && bru.Body.Type != "none" {
    content.WriteString("body {\n")
    content.WriteString(fmt.Sprintf("  type: %s\n", bru.Body.Type))
    if bru.HTTP.Body != "" {
        content.WriteString("  data {\n")
        // Indent body content
        lines := strings.Split(bru.HTTP.Body, "\n")
        for _, line := range lines {
            content.WriteString(fmt.Sprintf("    %s\n", line))
        }
        content.WriteString("  }\n")
    }
    content.WriteString("}\n\n")
}
```

Replace with:
```go
// Body section
if bru.Body.Type != "" && bru.Body.Type != "none" {
    content.WriteString("body {\n")
    content.WriteString(fmt.Sprintf("  type: %s\n", bru.Body.Type))
    // Body.Data is set by the frontend save path; HTTP.Body is the legacy field.
    bodyContent := bru.Body.Data
    if bodyContent == "" {
        bodyContent = bru.HTTP.Body
    }
    if bodyContent != "" {
        content.WriteString("  data {\n")
        lines := strings.Split(bodyContent, "\n")
        for _, line := range lines {
            content.WriteString(fmt.Sprintf("    %s\n", line))
        }
        content.WriteString("  }\n")
    }
    content.WriteString("}\n\n")
}
```

**Step 2: Run tests (still failing but body test may improve)**

```bash
cd /home/numericlabs/data/rocket-api/backend
go test ./pkg/bru/... -v -run TestParseContent
```

Expected: roundtrip tests still fail on name/method/url, but `TestParseContentWithBody` may now write the body to disk correctly (parse still broken).

**Step 3: Commit**

```bash
git add backend/pkg/bru/parser.go
git commit -m "fix(bru): use Body.Data as body content source in GenerateContent"
```

---

### Task 3: Rewrite `ParseContent` to handle block syntax

**Files:**
- Modify: `backend/pkg/bru/parser.go` — replace `ParseContent` function entirely

**Step 1: Replace `ParseContent` in `backend/pkg/bru/parser.go`**

Remove the entire existing `ParseContent` function (lines ~76–199) and replace with:

```go
// ParseContent parses .bru file content from string.
// The format uses section { } blocks as produced by GenerateContent.
func ParseContent(content string) (*BruFile, error) {
	bru := &BruFile{
		HTTP: struct {
			Method      string       `json:"method"`
			URL         string       `json:"url"`
			Headers     []Header     `json:"headers"`
			QueryParams []QueryParam `json:"queryParams,omitempty"`
			Body        string       `json:"body,omitempty"`
			Auth        *AuthConfig  `json:"auth,omitempty"`
		}{
			Headers:     []Header{},
			QueryParams: []QueryParam{},
		},
		Vars:       make(map[string]interface{}),
		Assertions: []string{},
	}

	scanner := bufio.NewScanner(strings.NewReader(content))
	// contextStack tracks nested block names, e.g. ["http", "headers"].
	var contextStack []string
	// dataLines accumulates indented lines inside a data { } block.
	var dataLines []string
	inDataBlock := false

	currentContext := func() string {
		if len(contextStack) == 0 {
			return ""
		}
		return contextStack[len(contextStack)-1]
	}

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		// Collect body data lines (preserve relative indentation by stripping 4-space prefix).
		if inDataBlock {
			if trimmed == "}" {
				inDataBlock = false
				contextStack = contextStack[:len(contextStack)-1]
				bru.Body.Data = strings.TrimRight(strings.Join(dataLines, "\n"), "\n")
				dataLines = nil
				continue
			}
			stripped := line
			if strings.HasPrefix(line, "    ") {
				stripped = line[4:]
			}
			dataLines = append(dataLines, stripped)
			continue
		}

		// Skip empty lines and comments outside data blocks.
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// Block close.
		if trimmed == "}" {
			if len(contextStack) > 0 {
				contextStack = contextStack[:len(contextStack)-1]
			}
			continue
		}

		// Block open: a line ending with " {" or just "{".
		if strings.HasSuffix(trimmed, "{") {
			blockName := strings.TrimSpace(strings.TrimSuffix(trimmed, "{"))
			contextStack = append(contextStack, blockName)
			if blockName == "data" {
				inDataBlock = true
			}
			continue
		}

		// Key-value line: parse based on current context.
		ctx := currentContext()
		switch ctx {
		case "meta":
			parseMetaLine(trimmed, bru)

		case "http":
			if strings.HasPrefix(trimmed, "method:") {
				bru.HTTP.Method = strings.TrimSpace(strings.TrimPrefix(trimmed, "method:"))
			} else if strings.HasPrefix(trimmed, "url:") {
				bru.HTTP.URL = strings.TrimSpace(strings.TrimPrefix(trimmed, "url:"))
			}

		case "headers":
			// "Key: Value" — split on first colon only.
			if parts := strings.SplitN(trimmed, ":", 2); len(parts) == 2 {
				bru.HTTP.Headers = append(bru.HTTP.Headers, Header{
					Key:   strings.TrimSpace(parts[0]),
					Value: strings.TrimSpace(parts[1]),
				})
			}

		case "query":
			if parts := strings.SplitN(trimmed, ":", 2); len(parts) == 2 {
				bru.HTTP.QueryParams = append(bru.HTTP.QueryParams, QueryParam{
					Key:     strings.TrimSpace(parts[0]),
					Value:   strings.TrimSpace(parts[1]),
					Enabled: true,
				})
			}

		case "auth":
			if strings.HasPrefix(trimmed, "type:") {
				authType := strings.TrimSpace(strings.TrimPrefix(trimmed, "type:"))
				bru.HTTP.Auth = &AuthConfig{Type: authType}
				// Pre-allocate sub-struct so later lines can fill it in.
				switch authType {
				case "basic":
					bru.HTTP.Auth.Basic = &struct {
						Username string `json:"username"`
						Password string `json:"password"`
					}{}
				case "bearer":
					bru.HTTP.Auth.Bearer = &struct {
						Token string `json:"token"`
					}{}
				case "api-key":
					bru.HTTP.Auth.APIKey = &struct {
						Key   string `json:"key"`
						Value string `json:"value"`
						In    string `json:"in"`
					}{}
				}
			} else if bru.HTTP.Auth != nil {
				switch bru.HTTP.Auth.Type {
				case "basic":
					if bru.HTTP.Auth.Basic != nil {
						if strings.HasPrefix(trimmed, "username:") {
							bru.HTTP.Auth.Basic.Username = strings.TrimSpace(strings.TrimPrefix(trimmed, "username:"))
						} else if strings.HasPrefix(trimmed, "password:") {
							bru.HTTP.Auth.Basic.Password = strings.TrimSpace(strings.TrimPrefix(trimmed, "password:"))
						}
					}
				case "bearer":
					if bru.HTTP.Auth.Bearer != nil && strings.HasPrefix(trimmed, "token:") {
						bru.HTTP.Auth.Bearer.Token = strings.TrimSpace(strings.TrimPrefix(trimmed, "token:"))
					}
				case "api-key":
					if bru.HTTP.Auth.APIKey != nil {
						if strings.HasPrefix(trimmed, "key:") {
							bru.HTTP.Auth.APIKey.Key = strings.TrimSpace(strings.TrimPrefix(trimmed, "key:"))
						} else if strings.HasPrefix(trimmed, "value:") {
							bru.HTTP.Auth.APIKey.Value = strings.TrimSpace(strings.TrimPrefix(trimmed, "value:"))
						} else if strings.HasPrefix(trimmed, "in:") {
							bru.HTTP.Auth.APIKey.In = strings.TrimSpace(strings.TrimPrefix(trimmed, "in:"))
						}
					}
				}
			}

		case "body":
			if strings.HasPrefix(trimmed, "type:") {
				bru.Body.Type = strings.TrimSpace(strings.TrimPrefix(trimmed, "type:"))
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading content: %w", err)
	}

	if bru.Body.Type == "" {
		bru.Body.Type = "none"
	}

	return bru, nil
}
```

Also remove the old `parseMetaLine` helper — it is still needed and unchanged, keep it.

**Step 2: Run tests**

```bash
cd /home/numericlabs/data/rocket-api/backend
go test ./pkg/bru/... -v -run TestParseContent
```

Expected: all three tests PASS.

**Step 3: Run the full test suite**

```bash
cd /home/numericlabs/data/rocket-api/backend
go test ./... 2>&1
```

Expected: all packages pass (or show `[no test files]`). No compilation errors.

**Step 4: Commit**

```bash
git add backend/pkg/bru/parser.go
git commit -m "fix(bru): rewrite ParseContent to handle block-syntax .bru files"
```

---

### Task 4: Refresh collection tree after save (frontend)

**Files:**
- Modify: `frontend/src/components/request-builder/RequestBuilder.tsx` — `handleSaveRequest` callback

**Background:** `useCollectionsStore` is already imported. `getState()` is used to avoid adding store state as a `useCallback` dependency.

**Step 1: Edit `handleSaveRequest` in `RequestBuilder.tsx`**

Find this block (around line 151):
```ts
    await saveActiveTab(activeCollection.name)
  }, [activeCollection, name, method, url, headers, queryParams, body, auth, updateActiveName, updateActiveMethod, updateActiveUrl, updateActiveHeaders, updateActiveQueryParams, updateActiveBody, updateActiveAuth, saveActiveTab])
```

Replace with:
```ts
    await saveActiveTab(activeCollection.name)
    // Refresh the sidebar tree so the saved request appears immediately.
    useCollectionsStore.getState().fetchCollectionTree(activeCollection.name)
  }, [activeCollection, name, method, url, headers, queryParams, body, auth, updateActiveName, updateActiveMethod, updateActiveUrl, updateActiveHeaders, updateActiveQueryParams, updateActiveBody, updateActiveAuth, saveActiveTab])
```

**Step 2: Build to verify no TypeScript errors**

```bash
cd /home/numericlabs/data/rocket-api/frontend && npm run build 2>&1
```

Expected: `✓ built in X.XXs` with no errors.

**Step 3: Commit**

```bash
git add frontend/src/components/request-builder/RequestBuilder.tsx
git commit -m "fix(request-builder): refresh collection tree after saving a request"
```

---

### Task 5: Push and verify

**Step 1: Push**

```bash
git push
```

**Step 2: Manual smoke test checklist**

1. Open the app — select a collection.
2. Create a new request: set a name, method (POST), and URL.
3. Hit Save (Ctrl+S or the Save button).
4. Verify the request appears in the sidebar tree immediately (no toggle needed).
5. Click the request in the sidebar — verify name, method, and URL load correctly into the builder.
6. Edit the URL, save again — verify the file is updated in place (not duplicated).
