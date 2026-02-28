# Rocket API - Complete Implementation Design

**Date:** 2026-03-01
**Author:** Design Review
**Status:** Approved
**Approach:** Pure Bruno Philosophy (Thin Backend + Smart Frontend + File-Based Storage)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Models & File Format](#2-data-models--file-format)
3. [API Contracts](#3-api-contracts)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Data Flow & Execution Pipeline](#6-data-flow--execution-pipeline)
7. [Error Handling & Recovery](#7-error-handling--recovery)
8. [Testing Strategy](#8-testing-strategy)
9. [Performance & Security](#9-performance--security)
10. [Deployment & Development](#10-deployment--development)

---

## 1. Architecture Overview

### Core Principle: Pure Bruno Philosophy

**Backend:** Thin service layer providing file operations and HTTP proxying
**Frontend:** Smart client handling parsing, validation, and business logic
**Storage:** Plain .bru files on disk (no database, no proprietary formats)

### System Components

```
┌─────────────────────────────────────────────────┐
│           Frontend (React + TypeScript)         │
│  ┌──────────────────────────────────────────┐  │
│  │ Request Builder & Editor                  │  │
│  │ .bru File Parser/Writer                   │  │
│  │ Environment Variable Processor            │  │
│  │ Collection Navigator                      │  │
│  │ Response Viewer & Test Runner             │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↕ REST API
┌─────────────────────────────────────────────────┐
│            Backend (Go + Gorilla Mux)           │
│  ┌──────────────────────────────────────────┐  │
│  │ File System Operations (CRUD)             │  │
│  │ HTTP Request Proxy                        │  │
│  │ File Watcher (SSE notifications)          │  │
│  │ Static File Server                        │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↕ File I/O
┌─────────────────────────────────────────────────┐
│              Storage Layer                      │
│  collections/                                   │
│  ├── my-api/                                    │
│  │   ├── auth/                                  │
│  │   │   ├── login.bru                          │
│  │   │   └── logout.bru                         │
│  │   ├── users/                                 │
│  │   │   └── get-users.bru                      │
│  │   └── environments/                          │
│  │       ├── dev.env                            │
│  │       └── prod.env                           │
└─────────────────────────────────────────────────┘
```

### Communication Flow

- **Frontend ↔ Backend:** REST API for file operations and request execution
- **Backend ↔ File System:** Direct file I/O operations
- **Backend → Frontend:** Server-Sent Events (SSE) for file change notifications

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- React Query (server state)
- Zustand (UI state)
- Monaco Editor (code editing)

**Backend:**
- Go 1.21+
- Gorilla Mux (routing)
- DDD architecture
- fsnotify (file watching)
- logrus (structured logging)

---

## 2. Data Models & File Format

### Bruno .bru File Format

```yaml
meta {
  name: Get Users
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/users
  body: none
  auth: none
}

params:query {
  page: 1
  limit: 10
  ~archived: false
}

headers {
  Authorization: Bearer {{token}}
  Content-Type: application/json
  ~X-Debug: true
}

body:json {
  {
    "filter": "active"
  }
}

vars:pre-request {
  timestamp: {{$timestamp}}
}

vars:post-response {
  userId: res.body.data[0].id
  userToken: res.body.token
}

assert {
  res.status: eq 200
  res.body.data: isDefined
  res.responseTime: lt 1000
}

script:pre-request {
  // JavaScript executed before request
  bru.setVar("timestamp", Date.now());
}

script:post-response {
  // JavaScript executed after response
  if (res.status === 200) {
    bru.setVar("userToken", res.body.token);
  }
}

tests {
  test("Status is 200", function() {
    expect(res.status).to.equal(200);
  });

  test("Response has data", function() {
    expect(res.body.data).to.be.an('array');
  });
}

docs {
  This endpoint retrieves all users from the system.
  Supports pagination via query parameters.
}
```

### Environment File Format

```bash
# Development Environment
baseUrl=http://localhost:8080
token=dev-token-123
apiKey=dev-api-key
dbHost=localhost
dbPort=5432
```

### Frontend TypeScript Models

```typescript
interface BruRequest {
  meta: {
    name: string;
    type: 'http' | 'graphql' | 'websocket';
    seq?: number;
  };
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  url: string;
  params?: {
    query?: Record<string, string | boolean>;
    path?: Record<string, string>;
  };
  headers?: Record<string, string>;
  body?: {
    type: 'none' | 'json' | 'xml' | 'form' | 'multipart' | 'raw' | 'graphql';
    content?: string | object;
  };
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'apikey' | 'oauth2';
    credentials?: Record<string, string>;
  };
  vars?: {
    preRequest?: Record<string, string>;
    postResponse?: Record<string, string>;
  };
  assertions?: Array<{
    path: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'isDefined' | 'contains';
    value: any;
  }>;
  scripts?: {
    preRequest?: string;
    postResponse?: string;
  };
  tests?: string;
  docs?: string;
}

interface Collection {
  name: string;
  path: string;
  folders: Folder[];
  environments: Environment[];
}

interface Folder {
  name: string;
  path: string;
  requests: BruRequest[];
  subfolders: Folder[];
}

interface Environment {
  name: string;
  path: string;
  variables: Record<string, string>;
}

interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  size: number;
}
```

### Backend Go Domain Models

```go
type Collection struct {
    Name string
    Path string
}

type BruFile struct {
    Path     string
    Content  string
    ModTime  time.Time
}

type EnvFile struct {
    Name      string
    Path      string
    Variables map[string]string
}

type HttpRequest struct {
    Method  string
    URL     string
    Headers map[string]string
    Body    []byte
}

type HttpResponse struct {
    StatusCode   int
    Headers      map[string][]string
    Body         []byte
    ResponseTime int64
    Size         int64
}
```

---

## 3. API Contracts

**Base URL:** `http://localhost:8080/api/v1`

### File System Operations

```
GET    /collections
POST   /collections
DELETE /collections/:name
GET    /collections/:name/structure
GET    /collections/:name/files/:filepath
POST   /collections/:name/files
PUT    /collections/:name/files/:filepath
DELETE /collections/:name/files/:filepath
POST   /collections/:name/folders
DELETE /collections/:name/folders/:folderpath
```

### Environment Operations

```
GET    /collections/:name/environments
GET    /collections/:name/environments/:envname
POST   /collections/:name/environments
PUT    /collections/:name/environments/:envname
DELETE /collections/:name/environments/:envname
```

### HTTP Request Execution

```
POST   /execute
  Body: {
    method: string,
    url: string,
    headers: { key: value },
    body: string | object,
    timeout: number
  }
  Response: {
    status: number,
    statusText: string,
    headers: { key: value },
    body: any,
    responseTime: number,
    size: number
  }
```

### File Watching

```
GET    /watch/collections/:name
  SSE Events:
    - event: file-created
    - event: file-modified
    - event: file-deleted
    - event: folder-created
    - event: folder-deleted
```

### Health & Info

```
GET    /health
GET    /info
```

### Error Response Format

```json
{
  "error": {
    "code": "COLLECTION_NOT_FOUND",
    "message": "Collection 'my-api' does not exist",
    "details": {}
  }
}
```

---

## 4. Frontend Architecture

### Component Hierarchy

```
App
├── AppLayout
│   ├── Sidebar
│   │   ├── CollectionSelector
│   │   ├── CollectionTree
│   │   │   ├── FolderNode
│   │   │   └── RequestNode
│   │   ├── EnvironmentSelector
│   │   └── NewRequestButton
│   │
│   ├── MainPanel
│   │   ├── RequestTabs
│   │   ├── RequestEditor
│   │   │   ├── RequestHeader
│   │   │   │   ├── MethodSelector
│   │   │   │   ├── URLInput
│   │   │   │   └── SendButton
│   │   │   ├── RequestTabs
│   │   │   │   ├── ParamsTab
│   │   │   │   ├── HeadersTab
│   │   │   │   ├── BodyTab
│   │   │   │   ├── AuthTab
│   │   │   │   ├── ScriptsTab
│   │   │   │   ├── TestsTab
│   │   │   │   └── DocsTab
│   │   │   └── RequestActions
│   │   │
│   │   └── ResponseViewer
│   │       ├── ResponseHeader
│   │       ├── ResponseTabs
│   │       │   ├── BodyTab
│   │       │   ├── HeadersTab
│   │       │   ├── TestResultsTab
│   │       │   └── RawTab
│   │       └── ResponseActions
│   │
│   └── TopBar
│       ├── CollectionActions
│       ├── ThemeToggle
│       └── HelpButton
│
└── Modals & Dialogs
```

### Core Utilities

```typescript
// .bru file parsing
class BruParser {
  parse(content: string): BruRequest
  serialize(request: BruRequest): string
  validate(request: BruRequest): ValidationResult
}

// Environment variable substitution
class EnvironmentProcessor {
  substituteVariables(text: string, env: Environment): string
  extractVariables(text: string): string[]
  resolveValue(variableName: string, env: Environment): string
}

// HTTP request execution
class HttpClient {
  async execute(request: BruRequest, env: Environment): Promise<HttpResponse>
  async executeWithScripts(request: BruRequest, env: Environment): Promise<ExecutionResult>
}

// Script execution
class ScriptRunner {
  executePreRequest(script: string, context: ScriptContext): void
  executePostResponse(script: string, context: ScriptContext): void
  runTests(tests: string, response: HttpResponse): TestResult[]
}

// Assertion validation
class AssertionValidator {
  validate(assertions: Assertion[], response: HttpResponse): AssertionResult[]
}

// File watching
class FileWatcher {
  connect(collectionName: string): EventSource
  onFileChange(callback: (event: FileChangeEvent) => void): void
  disconnect(): void
}
```

### State Management

**Global State (Zustand):**
```typescript
interface AppStore {
  activeCollection: string | null;
  setActiveCollection: (name: string) => void;
  activeEnvironment: string | null;
  setActiveEnvironment: (name: string) => void;
  openRequests: OpenRequest[];
  openRequest: (path: string) => void;
  closeRequest: (path: string) => void;
  activeRequestTab: string | null;
  setActiveRequestTab: (path: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}
```

**Server State (React Query):**
```typescript
const useCollections = () => useQuery(['collections'], fetchCollections);
const useCollectionStructure = (name: string) => useQuery(['collection', name, 'structure'], () => fetchStructure(name));
const useFileContent = (collection: string, filepath: string) => useQuery(['file', collection, filepath], () => fetchFile(collection, filepath));
const useEnvironments = (collection: string) => useQuery(['environments', collection], () => fetchEnvironments(collection));
const useExecuteRequest = () => useMutation(executeRequest);
```

---

## 5. Backend Architecture

### Directory Structure (DDD)

```
backend/
├── cmd/
│   └── server/
│       └── main.go
│
├── internal/
│   ├── app/                           # Application layer
│   │   ├── collection_service.go
│   │   ├── file_service.go
│   │   ├── environment_service.go
│   │   ├── request_executor.go
│   │   └── file_watcher_service.go
│   │
│   ├── domain/                        # Domain layer
│   │   ├── collection/
│   │   │   ├── collection.go
│   │   │   ├── repository.go
│   │   │   └── errors.go
│   │   ├── request/
│   │   │   ├── request.go
│   │   │   └── validator.go
│   │   └── environment/
│   │       ├── environment.go
│   │       └── parser.go
│   │
│   ├── infrastructure/                # Infrastructure layer
│   │   ├── repository/
│   │   │   ├── file_collection_repo.go
│   │   │   └── file_env_repo.go
│   │   ├── http/
│   │   │   ├── client.go
│   │   │   └── proxy.go
│   │   ├── filesystem/
│   │   │   ├── watcher.go
│   │   │   └── operations.go
│   │   └── config/
│   │       └── config.go
│   │
│   └── interfaces/                    # Interface adapters
│       ├── http/
│       │   ├── router.go
│       │   ├── middleware/
│       │   │   ├── cors.go
│       │   │   ├── logger.go
│       │   │   └── recovery.go
│       │   └── handlers/
│       │       ├── collection_handler.go
│       │       ├── file_handler.go
│       │       ├── environment_handler.go
│       │       ├── execute_handler.go
│       │       ├── watch_handler.go
│       │       └── health_handler.go
│       └── dto/
│           ├── request.go
│           └── response.go
│
└── pkg/                               # Shared packages
    ├── logger/
    │   └── logger.go
    ├── validator/
    │   └── validator.go
    └── errors/
        └── errors.go
```

### Key Components

**Application Services:**
```go
type CollectionService struct {
    repo repository.CollectionRepository
    logger logger.Logger
}

func (s *CollectionService) ListCollections() ([]domain.Collection, error)
func (s *CollectionService) CreateCollection(name string) (*domain.Collection, error)
func (s *CollectionService) DeleteCollection(name string) error
func (s *CollectionService) GetStructure(name string) (*domain.CollectionStructure, error)
```

**Domain Repository Interface:**
```go
type CollectionRepository interface {
    List() ([]Collection, error)
    Create(collection *Collection) error
    Delete(name string) error
    Exists(name string) (bool, error)
    GetStructure(name string) (*CollectionStructure, error)
    ReadFile(collection, filepath string) ([]byte, error)
    WriteFile(collection, filepath string, content []byte) error
    DeleteFile(collection, filepath string) error
    CreateFolder(collection, path string) error
    DeleteFolder(collection, path string) error
}
```

**HTTP Router (Gorilla Mux):**
```go
func NewRouter(handlers ...Handler) *mux.Router {
    r := mux.NewRouter()

    r.Use(middleware.CORS)
    r.Use(middleware.Logger)
    r.Use(middleware.Recovery)

    api := r.PathPrefix("/api/v1").Subrouter()

    // Collections
    api.HandleFunc("/collections", collectionHandler.ListCollections).Methods("GET")
    api.HandleFunc("/collections", collectionHandler.CreateCollection).Methods("POST")
    api.HandleFunc("/collections/{name}", collectionHandler.DeleteCollection).Methods("DELETE")

    // Files
    api.HandleFunc("/collections/{name}/files/{filepath:.*}", fileHandler.ReadFile).Methods("GET")
    api.HandleFunc("/collections/{name}/files", fileHandler.CreateFile).Methods("POST")

    // Execute
    api.HandleFunc("/execute", executeHandler.Execute).Methods("POST")

    // Watch (SSE)
    api.HandleFunc("/watch/collections/{name}", watchHandler.WatchCollection).Methods("GET")

    return r
}
```

---

## 6. Data Flow & Execution Pipeline

### Request Execution Flow

```
1. User clicks "Send"
   ↓
2. RequestEditor captures state
   ↓
3. EnvironmentProcessor substitutes {{variables}}
   ↓
4. ScriptRunner executes pre-request script
   ↓
5. Variables updated in environment context
   ↓
6. HttpClient.execute() sends POST /api/v1/execute
   ↓
7. Backend ExecuteHandler receives request
   ↓
8. RequestExecutor makes actual HTTP call to target API
   ↓
9. Response captured (status, headers, body, time, size)
   ↓
10. Response returned to frontend
    ↓
11. ScriptRunner executes post-response script
    ↓
12. AssertionValidator validates assertions
    ↓
13. TestRunner executes test scripts
    ↓
14. ResponseViewer displays results
```

### File Watching & Auto-Refresh Flow

```
Backend FileWatcher monitors collections directory
   ↓
File system event detected (create/modify/delete)
   ↓
SSE event sent to connected frontend clients
   ↓
Frontend FileWatcher receives event
   ↓
React Query invalidates relevant queries
   ↓
Components re-fetch and re-render
   ↓
User sees updated content
```

### Environment Variable Substitution

```
Request URL: {{baseUrl}}/api/users
Environment: { baseUrl: "http://localhost:8080" }
   ↓
EnvironmentProcessor.substituteVariables()
   ↓
Result: http://localhost:8080/api/users
```

---

## 7. Error Handling & Recovery

### Error Categories

**1. File System Errors:**
- Collection not found → 404, suggest creating
- Permission denied → 403, show fix guide
- File corrupted → Recovery mode with raw content
- Disk full → 507, prevent further writes

**2. Network & HTTP Errors:**
- Timeout → Show elapsed time, retry option
- Connection refused → Check URL, verify server
- DNS failure → Validate URL format
- SSL/TLS error → Show certificate details
- 4xx/5xx responses → Context-specific guidance

**3. Validation Errors:**
- Invalid URL → Block send, show inline error
- Invalid JSON → Highlight syntax error
- Missing headers → Warning with suggestion
- Unresolved variables → Warning, option to send anyway

**4. Parser Errors (.bru files):**
- Strict parsing attempt
- Fallback to lenient parsing
- Show raw content if complete failure
- Offer auto-correction for common issues

**5. Script Execution Errors:**
- Timeout (5s limit)
- Syntax errors with line numbers
- Runtime errors with stack trace
- Sandboxing violations

### Recovery Mechanisms

**Auto-Save:**
```typescript
// Save unsaved changes every 30 seconds
useEffect(() => {
  const interval = setInterval(() => {
    if (hasUnsavedChanges) {
      saveToLocalStorage(currentRequest);
    }
  }, 30000);
}, [hasUnsavedChanges]);
```

**Graceful Degradation:**
```typescript
// Monaco editor fails → use textarea
// Syntax highlighting fails → show plain text
// Backend unavailable → read-only mode
// SSE fails → fallback to polling
```

**Logging Strategy:**
```go
logger.WithFields(logrus.Fields{
    "collection": "my-api",
    "file": "auth/login.bru",
    "operation": "update",
    "error": err.Error(),
}).Error("Failed to update file")
```

---

## 8. Testing Strategy

### Testing Pyramid

```
E2E Tests (10%) - Playwright
Integration Tests (30%) - React Testing Library + Go integration tests
Unit Tests (60%) - Vitest + Go testing
```

### Frontend Tests

**Unit Tests:**
```typescript
// Component tests
describe('URLInput', () => {
  it('should highlight unresolved variables', () => {
    render(<URLInput value="{{baseUrl}}/users" onChange={vi.fn()} />);
    expect(screen.getByText('baseUrl')).toHaveClass('variable-unresolved');
  });
});

// Parser tests
describe('BruParser', () => {
  it('should parse valid .bru file', () => {
    const result = parser.parse(validContent);
    expect(result.meta.name).toBe('Get Users');
  });
});

// Environment processor tests
describe('EnvironmentProcessor', () => {
  it('should substitute variables', () => {
    const result = processor.substituteVariables('{{baseUrl}}/users', env);
    expect(result).toBe('http://localhost:8080/users');
  });
});
```

**E2E Tests:**
```typescript
test('should create and execute a request', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('text=New Collection');
  await page.fill('input[name="collection-name"]', 'Test API');
  await page.selectOption('select[name="method"]', 'GET');
  await page.fill('input[name="url"]', 'https://jsonplaceholder.typicode.com/users');
  await page.click('button:has-text("Send")');
  await expect(page.locator('text=200')).toBeVisible();
});
```

### Backend Tests

**Unit Tests:**
```go
func TestNewCollection(t *testing.T) {
    col, err := collection.NewCollection("my-api", "/collections")
    assert.NoError(t, err)
    assert.Equal(t, "my-api", col.Name)
}

func TestBruParser(t *testing.T) {
    req, err := bru.Parse(validContent)
    assert.NoError(t, err)
    assert.Equal(t, "GET", req.Method)
}
```

**Integration Tests:**
```go
func TestFileCollectionRepository(t *testing.T) {
    tmpDir := t.TempDir()
    repo := repository.NewFileCollectionRepository(tmpDir, logger.NewNoop())

    err := repo.Create(&domain.Collection{Name: "test-api"})
    assert.NoError(t, err)
    assert.DirExists(t, filepath.Join(tmpDir, "test-api"))
}
```

### Coverage Targets

```yaml
frontend:
  unit_tests: 80%
  integration_tests: 60%
  critical_paths: 95%

backend:
  unit_tests: 85%
  integration_tests: 70%
  handlers: 90%
  domain_logic: 95%
```

---

## 9. Performance & Security

### Performance Optimization

**Frontend:**
- Code splitting and lazy loading
- Virtual scrolling for large collections
- Debounced auto-save (1s delay)
- Memoization for expensive operations
- React Query caching (5min stale time)

**Backend:**
- Connection pooling for HTTP client
- Efficient directory walking (filepath.WalkDir)
- Response compression
- File size validation (10MB limit)

**Performance Targets:**
```yaml
response_times:
  file_read: < 50ms
  file_write: < 100ms
  collection_list: < 100ms
  ui_interaction: < 100ms

resource_usage:
  frontend_bundle: < 500KB (gzipped)
  backend_memory_idle: < 50MB
  backend_memory_load: < 200MB
```

### Security Strategy

**1. Input Validation:**
```go
// Path traversal prevention
func validatePath(filepath string) error {
    if strings.Contains(filepath, "..") {
        return errors.New("invalid path: contains ..")
    }
    if path.IsAbs(filepath) {
        return errors.New("invalid path: absolute paths not allowed")
    }
    return nil
}
```

**2. Script Sandboxing:**
```typescript
// Restricted environment - no access to:
// - File system, Network (except via bru.request)
// - Global process/require, eval, Function constructor
const sandbox = {
  bru: context.bru,
  res: context.res,
  console: createSafeConsole(),
};
```

**3. CORS Configuration:**
```go
// Allow only localhost in development
if strings.HasPrefix(origin, "http://localhost:") {
    w.Header().Set("Access-Control-Allow-Origin", origin)
}
```

**4. Sensitive Data Protection:**
```typescript
// Mask sensitive environment variables
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'apikey', 'auth'];
function isSensitive(key: string): boolean {
  return SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s));
}
```

**5. File System Security:**
```go
// Ensure operations stay within collections directory
absPath, _ := filepath.Abs(fullPath)
if !strings.HasPrefix(absPath, absBasePath) {
    return errors.New("path traversal detected")
}
```

---

## 10. Deployment & Development

### Development Setup

**Prerequisites:**
- Node.js 18+
- Go 1.21+
- Yarn 1.22+

**Initial Setup:**
```bash
# Frontend
cd frontend
yarn install
cp .env.example .env.local

# Backend
cd backend
go mod download
cp config.example.yaml config.yaml

# Collections
mkdir -p collections/example-api
```

**Development Scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext ts,tsx",
    "type-check": "tsc --noEmit"
  }
}
```

### Build & Deployment

**Production Build:**
```bash
# Frontend
cd frontend && yarn build
# Output: frontend/dist/

# Backend
cd backend && go build -ldflags="-s -w" -o bin/rocket-api cmd/server/main.go
# Output: backend/bin/rocket-api
```

**Deployment Options:**

1. **Local Development Server** (Primary)
   - Run backend (serves frontend + API)
   - Access at http://localhost:8080
   - Collections from ./collections directory

2. **Docker** (Team environments)
   - docker-compose.yml provided
   - Separate frontend and backend containers
   - Volume mount for collections

3. **Desktop App** (Future - Electron)
   - Standalone packaged app
   - Windows .exe, macOS .dmg, Linux .AppImage

**Configuration:**
```yaml
# backend/config.yaml
server:
  address: "0.0.0.0:8080"
  read_timeout: 15s
  write_timeout: 15s

collections:
  path: "../collections"
  max_file_size: 10485760  # 10MB

logging:
  level: "info"
  format: "json"

request:
  timeout: 30s
  max_redirects: 5
```

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
jobs:
  - frontend-test (lint, type-check, test, build)
  - backend-test (lint, test, build)
  - e2e-test (playwright)
  - release (multi-platform binaries)
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)
✅ **Scope:**
- Project setup (React + Vite, Go + Gorilla Mux)
- Bruno file system (.bru parser, file operations)
- Basic request builder (method, URL, headers, body)
- Response display (status, headers, body, syntax highlighting)
- Collection management (create, load, save)
- Environment variables (basic substitution)

**Deliverables:**
- Working request execution
- File-based storage
- Basic UI with dark mode
- Health check endpoint

### Phase 2: Collections & Organization
✅ **Scope:**
- Advanced collection management (folders, nesting)
- File watching and auto-refresh (SSE)
- Environment file management
- Import/export Bruno collections
- Request duplication and organization
- Template variable processing
- Request dependency management

**Deliverables:**
- Full collection navigation
- Real-time file updates
- Multiple environment support
- Git-friendly workflow

### Phase 3: Advanced Features
✅ **Scope:**
- Scripting (pre-request, post-response)
- Assertions and test framework
- Request history tracking
- Response analysis tools
- Bulk operations
- Keyboard shortcuts
- Request tabs interface
- Advanced search and filtering

**Deliverables:**
- Complete scripting support
- Test runner with assertions
- Performance metrics
- Production-ready application

---

## Success Criteria

### MVP (Phase 1-2)
- ✅ Send HTTP requests with all common methods
- ✅ Collections created, saved, and loaded locally
- ✅ Environment variables with substitution
- ✅ Clean, intuitive UI (Bruno/Postman-like)
- ✅ Fast performance (sub-second execution)

### Enhanced (Phase 3)
- ✅ Scripting capabilities (pre/post request)
- ✅ Assertion and test framework
- ✅ Request history and search
- ✅ Theme customization (light/dark)

### Production Ready
- ✅ Comprehensive error handling
- ✅ Performance optimization
- ✅ Cross-platform compatibility
- ✅ Documentation and examples
- ✅ 80%+ test coverage

---

## Conclusion

This design provides a complete blueprint for implementing Rocket API using the Pure Bruno Philosophy. The architecture emphasizes:

1. **Simplicity:** Thin backend, smart frontend, no database
2. **Transparency:** Human-readable .bru files, git-friendly
3. **Performance:** Local operations, efficient file I/O
4. **Maintainability:** Clean architecture, comprehensive testing
5. **User Ownership:** No vendor lock-in, complete data control

**Next Steps:**
1. Review and approve this design
2. Create detailed implementation plan (task breakdown)
3. Begin Phase 1 implementation
4. Iterate based on feedback and testing

**Key Risks & Mitigations:**
- **Risk:** File watching performance on large collections
  **Mitigation:** Debouncing, selective watching, polling fallback

- **Risk:** Script execution security
  **Mitigation:** Web Worker sandboxing, timeout limits, restricted APIs

- **Risk:** Browser file access limitations
  **Mitigation:** Backend file serving layer, SSE for updates

**Questions for Implementation:**
- Should we support browser extension for direct file system access?
- Desktop app via Electron or Tauri?
- Team collaboration features (future)?
- Plugin architecture for extensibility?
