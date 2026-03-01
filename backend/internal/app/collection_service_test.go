package app_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yourusername/rocket-api/internal/app"
	"github.com/yourusername/rocket-api/internal/infrastructure/persistence/filesystem"
	"github.com/yourusername/rocket-api/pkg/logger"
)

func setupTestService(t *testing.T) (*app.CollectionService, string, func()) {
	t.Helper()
	tmpDir := t.TempDir()
	log := logger.NewNoop()
	repo := filesystem.NewCollectionRepository(tmpDir, log)
	service := app.NewCollectionService(repo, tmpDir, log)

	cleanup := func() {
		// Temp dir is automatically cleaned up by t.TempDir()
	}

	return service, tmpDir, cleanup
}

func TestCollectionService_ListCollections(t *testing.T) {
	service, _, cleanup := setupTestService(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("returns empty list when no collections", func(t *testing.T) {
		collections, err := service.ListCollections(ctx)

		assert.NoError(t, err)
		assert.Empty(t, collections)
	})

	t.Run("returns all collections after creation", func(t *testing.T) {
		service, _, cleanup := setupTestService(t)
		defer cleanup()

		ctx := context.Background()

		_, err := service.CreateCollection(ctx, "api-one")
		require.NoError(t, err)
		_, err = service.CreateCollection(ctx, "api-two")
		require.NoError(t, err)

		collections, err := service.ListCollections(ctx)

		assert.NoError(t, err)
		assert.Len(t, collections, 2)
	})
}

func TestCollectionService_CreateCollection(t *testing.T) {
	service, _, cleanup := setupTestService(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("creates new collection", func(t *testing.T) {
		col, err := service.CreateCollection(ctx, "my-api")

		assert.NoError(t, err)
		assert.Equal(t, "my-api", col.Name)
		assert.NotZero(t, col.CreatedAt)
	})

	t.Run("rejects invalid names", func(t *testing.T) {
		_, err := service.CreateCollection(ctx, "../invalid")

		assert.Error(t, err)
	})

	t.Run("rejects duplicate collection", func(t *testing.T) {
		_, err := service.CreateCollection(ctx, "duplicate")
		require.NoError(t, err)

		_, err = service.CreateCollection(ctx, "duplicate")
		assert.Error(t, err)
	})

	t.Run("rejects empty name", func(t *testing.T) {
		_, err := service.CreateCollection(ctx, "")

		assert.Error(t, err)
	})
}

func TestCollectionService_DeleteCollection(t *testing.T) {
	service, _, cleanup := setupTestService(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("deletes existing collection", func(t *testing.T) {
		_, err := service.CreateCollection(ctx, "to-delete")
		require.NoError(t, err)

		err = service.DeleteCollection(ctx, "to-delete")
		assert.NoError(t, err)

		// Verify it's gone
		collections, err := service.ListCollections(ctx)
		assert.NoError(t, err)
		assert.Empty(t, collections)
	})

	t.Run("returns error for non-existent collection", func(t *testing.T) {
		err := service.DeleteCollection(ctx, "does-not-exist")
		assert.Error(t, err)
	})
}

func TestCollectionService_GetCollection(t *testing.T) {
	service, _, cleanup := setupTestService(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("retrieves existing collection", func(t *testing.T) {
		created, err := service.CreateCollection(ctx, "my-collection")
		require.NoError(t, err)

		retrieved, err := service.GetCollection(ctx, "my-collection")

		assert.NoError(t, err)
		assert.Equal(t, created.Name, retrieved.Name)
		assert.NotZero(t, retrieved.CreatedAt)
	})

	t.Run("returns error for non-existent collection", func(t *testing.T) {
		_, err := service.GetCollection(ctx, "does-not-exist")

		assert.Error(t, err)
	})
}
