# Hide Environments Folder from Collection Tree — Design

**Date:** 2026-03-02
**Status:** Approved

## Problem

Every collection has an `environments/` subdirectory created automatically on disk. `GetCollectionStructure` uses `filepath.Walk`, which includes this directory as a `folder` node and its `.env` files as `environment` nodes. The result: the environments folder appears in the sidebar request tree alongside request files, which is confusing and serves no purpose — environments are already managed through the environments dropdown.

## Design

**One file:** `backend/internal/infrastructure/repository/collection_repository.go`

**One change:** In the `filepath.Walk` callback inside `GetCollectionStructure`, add two guards at the top of the callback body:

```go
// Skip the environments directory and all its contents.
if info.IsDir() && info.Name() == "environments" {
    return filepath.SkipDir
}
// Skip any stray .env files outside environments/.
if !info.IsDir() && strings.HasSuffix(info.Name(), ".env") {
    return nil
}
```

`filepath.SkipDir` prevents Walk from descending into `environments/`, excluding both the folder node and all files inside it. The second guard handles `.env` files that may exist outside the environments directory.

## What is unaffected

- `ListEnvironments` / `ReadEnvironment` / `WriteEnvironment` — read the filesystem directly, not via `GetCollectionStructure`
- The environments dropdown and EnvironmentsPanel
- All other collection structure logic

## Files Changed

| File | Change |
|------|--------|
| `backend/internal/infrastructure/repository/collection_repository.go` | Skip `environments` dir and `.env` files in `GetCollectionStructure` Walk callback |
