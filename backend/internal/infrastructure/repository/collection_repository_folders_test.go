package repository

import (
	"os"
	"path/filepath"
	"testing"
)

func setupCollectionRepo(t *testing.T) *CollectionRepository {
	t.Helper()
	base := t.TempDir()
	repo := NewCollectionRepository(base)
	if err := repo.EnsureBasePath(); err != nil {
		t.Fatalf("failed to ensure base path: %v", err)
	}
	if err := repo.CreateCollection("test"); err != nil {
		t.Fatalf("failed to create collection: %v", err)
	}
	return repo
}

func TestCreateFolder(t *testing.T) {
	repo := setupCollectionRepo(t)

	path, err := repo.CreateFolder("test", "", "users")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if path != "users" {
		t.Fatalf("expected path users, got %s", path)
	}

	nested, err := repo.CreateFolder("test", "users", "v1")
	if err != nil {
		t.Fatalf("expected no error for nested folder, got %v", err)
	}
	if nested != "users/v1" {
		t.Fatalf("expected path users/v1, got %s", nested)
	}

	if _, err := os.Stat(filepath.Join(repo.basePath, "test", "users", "v1")); err != nil {
		t.Fatalf("expected nested folder to exist: %v", err)
	}
}

func TestCreateFolderRejectsDuplicateAndTraversal(t *testing.T) {
	repo := setupCollectionRepo(t)
	if _, err := repo.CreateFolder("test", "", "users"); err != nil {
		t.Fatalf("expected initial create to pass: %v", err)
	}
	if _, err := repo.CreateFolder("test", "", "users"); err == nil {
		t.Fatalf("expected duplicate folder error")
	}

	if _, err := repo.CreateFolder("test", "../bad", "oops"); err == nil {
		t.Fatalf("expected traversal path to fail")
	}
}

func TestCreateRequest(t *testing.T) {
	repo := setupCollectionRepo(t)
	if _, err := repo.CreateFolder("test", "", "users"); err != nil {
		t.Fatalf("failed to create folder: %v", err)
	}

	path, err := repo.CreateRequest("test", "users", "list-users", "GET")
	if err != nil {
		t.Fatalf("expected request create success, got %v", err)
	}
	if path != "users/list-users.bru" {
		t.Fatalf("expected users/list-users.bru, got %s", path)
	}

	if _, err := repo.CreateRequest("test", "users", "list-users", "GET"); err == nil {
		t.Fatalf("expected duplicate request error")
	}
}
