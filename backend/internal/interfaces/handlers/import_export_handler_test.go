package handlers

import (
	"archive/zip"
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/yourusername/rocket-api/internal/infrastructure/repository"
	"github.com/yourusername/rocket-api/pkg/bru"
)

func TestImportBrunoZip_ImportsBrunoEnvironmentJSON(t *testing.T) {
	tempDir := t.TempDir()
	repo := repository.NewCollectionRepository(tempDir)
	handler := NewImportExportHandler(repo)

	const collectionName = "lockstep-inbox"
	if err := repo.CreateCollection(collectionName); err != nil {
		t.Fatalf("CreateCollection() error = %v", err)
	}

	zipBytes := buildTestZip(t, map[string]string{
		"collection.bru": "meta {\n  name: Lockstep Inbox\n}\n",
		"Accounts/Show.bru": "meta {\n  name: Show\n  type: http\n}\nhttp {\n  method: GET\n  url: https://example.com\n}\n",
		"environments/bruno-collection-environments.json": `{
  "info": { "type": "bruno-environment" },
  "environments": [
    {
      "name": "ADO QA EU",
      "variables": [
        { "name": "BASE_URL", "value": "https://qa.example.com", "enabled": true, "secret": false },
        { "name": "API_TOKEN", "value": "abc123", "enabled": true, "secret": true }
      ]
    }
  ]
}`,
	})

	if err := handler.importBrunoZip(collectionName, zipBytes); err != nil {
		t.Fatalf("importBrunoZip() error = %v", err)
	}

	envNames, err := repo.ListEnvironments(collectionName)
	if err != nil {
		t.Fatalf("ListEnvironments() error = %v", err)
	}

	if !slices.Contains(envNames, "ADO QA EU") {
		t.Fatalf("expected imported environment ADO QA EU, got %v", envNames)
	}

	// Import should replace scaffold dev env when Bruno environments are present.
	if slices.Contains(envNames, "dev") {
		t.Fatalf("did not expect default dev environment after import, got %v", envNames)
	}

	env, err := repo.ReadEnvironment(collectionName, "ADO QA EU")
	if err != nil {
		t.Fatalf("ReadEnvironment() error = %v", err)
	}

	var foundBaseURL bool
	var foundSecretToken bool
	for _, v := range env.Variables {
		if v.Key == "BASE_URL" && v.Value == "https://qa.example.com" && !v.Secret {
			foundBaseURL = true
		}
		if v.Key == "API_TOKEN" && v.Value == "abc123" && v.Secret {
			foundSecretToken = true
		}
	}

	if !foundBaseURL || !foundSecretToken {
		t.Fatalf("expected imported env vars with secret flag, got %+v", env.Variables)
	}
}

func buildTestZip(t *testing.T, files map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range files {
		w, err := zw.Create(filepath.ToSlash(name))
		if err != nil {
			t.Fatalf("zip create %q: %v", name, err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatalf("zip write %q: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	return buf.Bytes()
}

func TestImportBrunoZip_PreservesRequestScripts(t *testing.T) {
	tempDir := t.TempDir()
	repo := repository.NewCollectionRepository(tempDir)
	handler := NewImportExportHandler(repo)

	const collectionName = "script-import"
	if err := repo.CreateCollection(collectionName); err != nil {
		t.Fatalf("CreateCollection() error = %v", err)
	}

	zipBytes := buildTestZip(t, map[string]string{
		"Requests/Scripted.bru": `meta {
  name: Scripted
  type: http
  seq: 1
}

http {
  method: GET
  url: https://example.com/items
}

script {
  language: typescript
}

script:pre-request {
  pm.environment.set('token', 'abc')
}

script:post-response {
  pm.test('status 200', () => {})
}
`,
	})

	if err := handler.importBrunoZip(collectionName, zipBytes); err != nil {
		t.Fatalf("importBrunoZip() error = %v", err)
	}

	parsed, err := repo.ParseBruFile(collectionName, "Requests/Scripted.bru")
	if err != nil {
		t.Fatalf("ParseBruFile() error = %v", err)
	}

	if parsed.Scripts == nil {
		t.Fatalf("expected parsed scripts to be present")
	}
	if parsed.Scripts.Language != "typescript" {
		t.Fatalf("scripts.language=%q", parsed.Scripts.Language)
	}
	if !strings.Contains(parsed.Scripts.PreRequest, "pm.environment.set('token', 'abc')") {
		t.Fatalf("scripts.preRequest=%q", parsed.Scripts.PreRequest)
	}
	if !strings.Contains(parsed.Scripts.PostResponse, "pm.test('status 200'") {
		t.Fatalf("scripts.postResponse=%q", parsed.Scripts.PostResponse)
	}
}

func TestExportBruno_IncludesScriptBlocks(t *testing.T) {
	tempDir := t.TempDir()
	repo := repository.NewCollectionRepository(tempDir)
	handler := NewImportExportHandler(repo)

	const collectionName = "script-export"
	if err := repo.CreateCollection(collectionName); err != nil {
		t.Fatalf("CreateCollection() error = %v", err)
	}

	request := &bru.BruFile{}
	request.Meta.Name = "Script Export"
	request.Meta.Type = "http"
	request.Meta.Seq = 1
	request.HTTP.Method = "GET"
	request.HTTP.URL = "https://example.com/items"
	request.Body.Type = "none"
	request.Scripts = &bru.Scripts{
		Language:     "javascript",
		PreRequest:   "pm.environment.set('trace', '1')",
		PostResponse: "pm.test('ok', () => {})",
	}

	if err := repo.WriteBruFile(collectionName, "requests/export.bru", request); err != nil {
		t.Fatalf("WriteBruFile() error = %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/export/bruno?collection="+collectionName, nil)
	rec := httptest.NewRecorder()
	handler.ExportBruno(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("ExportBruno status=%d body=%s", rec.Code, rec.Body.String())
	}

	zipReader, err := zip.NewReader(bytes.NewReader(rec.Body.Bytes()), int64(rec.Body.Len()))
	if err != nil {
		t.Fatalf("zip.NewReader() error = %v", err)
	}

	found := false
	for _, f := range zipReader.File {
		if f.Name != "requests/export.bru" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open zip entry: %v", err)
		}
		content, _ := io.ReadAll(rc)
		_ = rc.Close()
		text := string(content)
		if !strings.Contains(text, "script:pre-request {") || !strings.Contains(text, "script:post-response {") {
			t.Fatalf("expected script blocks in exported .bru, got:\n%s", text)
		}
		found = true
	}

	if !found {
		t.Fatalf("expected requests/export.bru in export archive")
	}
}
