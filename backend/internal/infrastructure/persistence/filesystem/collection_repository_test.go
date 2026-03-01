package filesystem_test

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yourusername/rocket-api/internal/domain/collection"
	"github.com/yourusername/rocket-api/internal/infrastructure/persistence/filesystem"
	"github.com/yourusername/rocket-api/pkg/logger"
)

func setupTestRepo(t *testing.T) (*filesystem.CollectionRepository, string, func()) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "rocket-test-*")
	require.NoError(t, err)

	log := logger.NewNoop()
	repo := filesystem.NewCollectionRepository(tempDir, log)

	cleanup := func() {
		os.RemoveAll(tempDir)
	}

	return repo, tempDir, cleanup
}

func TestCollectionRepository_Create(t *testing.T) {
	repo, basePath, cleanup := setupTestRepo(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("creates collection directory", func(t *testing.T) {
		col, err := collection.NewCollection("test-api", basePath)
		require.NoError(t, err)

		err = repo.Create(ctx, col)
		assert.NoError(t, err)

		// Verify directory exists
		_, err = os.Stat(col.Path)
		assert.NoError(t, err)
	})

	t.Run("returns error if collection already exists", func(t *testing.T) {
		col, err := collection.NewCollection("duplicate-api", basePath)
		require.NoError(t, err)

		err = repo.Create(ctx, col)
		require.NoError(t, err)

		err = repo.Create(ctx, col)
		assert.ErrorIs(t, err, collection.ErrCollectionExists)
	})
}

func TestCollectionRepository_FindByName(t *testing.T) {
	repo, basePath, cleanup := setupTestRepo(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("finds existing collection", func(t *testing.T) {
		col, err := collection.NewCollection("findme-api", basePath)
		require.NoError(t, err)
		err = repo.Create(ctx, col)
		require.NoError(t, err)

		found, err := repo.FindByName(ctx, "findme-api")
		assert.NoError(t, err)
		assert.Equal(t, "findme-api", found.Name)
		assert.Equal(t, col.Path, found.Path)
	})

	t.Run("returns ErrNotFound for non-existent collection", func(t *testing.T) {
		_, err := repo.FindByName(ctx, "does-not-exist")
		assert.ErrorIs(t, err, collection.ErrNotFound)
	})
}

func TestCollectionRepository_FindAll(t *testing.T) {
	repo, basePath, cleanup := setupTestRepo(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("returns empty slice when no collections", func(t *testing.T) {
		cols, err := repo.FindAll(ctx)
		assert.NoError(t, err)
		assert.Empty(t, cols)
	})

	t.Run("returns all collections", func(t *testing.T) {
		col1, _ := collection.NewCollection("api1", basePath)
		col2, _ := collection.NewCollection("api2", basePath)
		repo.Create(ctx, col1)
		repo.Create(ctx, col2)

		cols, err := repo.FindAll(ctx)
		assert.NoError(t, err)
		assert.Len(t, cols, 2)
	})
}

func TestCollectionRepository_Delete(t *testing.T) {
	repo, basePath, cleanup := setupTestRepo(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("deletes existing collection", func(t *testing.T) {
		col, err := collection.NewCollection("delete-me", basePath)
		require.NoError(t, err)
		err = repo.Create(ctx, col)
		require.NoError(t, err)

		err = repo.Delete(ctx, "delete-me")
		assert.NoError(t, err)

		_, err = os.Stat(col.Path)
		assert.True(t, os.IsNotExist(err))
	})

	t.Run("returns ErrNotFound for non-existent collection", func(t *testing.T) {
		err := repo.Delete(ctx, "does-not-exist")
		assert.ErrorIs(t, err, collection.ErrNotFound)
	})
}

func TestCollectionRepository_Exists(t *testing.T) {
	repo, basePath, cleanup := setupTestRepo(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("returns true for existing collection", func(t *testing.T) {
		col, _ := collection.NewCollection("exists-api", basePath)
		repo.Create(ctx, col)

		exists, err := repo.Exists(ctx, "exists-api")
		assert.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent collection", func(t *testing.T) {
		exists, err := repo.Exists(ctx, "nope")
		assert.NoError(t, err)
		assert.False(t, exists)
	})
}
