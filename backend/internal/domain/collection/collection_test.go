package collection_test

import (
	"testing"

	"github.com/yourusername/rocket-api/internal/domain/collection"
	"github.com/stretchr/testify/assert"
)

func TestNewCollection(t *testing.T) {
	t.Run("creates valid collection", func(t *testing.T) {
		col, err := collection.NewCollection("my-api", "/collections")

		assert.NoError(t, err)
		assert.Equal(t, "my-api", col.Name)
		assert.Equal(t, "/collections/my-api", col.Path)
		assert.NotZero(t, col.CreatedAt)
	})

	t.Run("rejects empty name", func(t *testing.T) {
		_, err := collection.NewCollection("", "/collections")

		assert.Error(t, err)
		assert.Equal(t, collection.ErrInvalidName, err)
	})

	t.Run("rejects name with path traversal", func(t *testing.T) {
		_, err := collection.NewCollection("../invalid", "/collections")

		assert.Error(t, err)
		assert.Equal(t, collection.ErrInvalidName, err)
	})

	t.Run("rejects name with special characters", func(t *testing.T) {
		_, err := collection.NewCollection("my@api", "/collections")

		assert.Error(t, err)
		assert.Equal(t, collection.ErrInvalidName, err)
	})
}

func TestCollectionValidate(t *testing.T) {
	t.Run("validates correct collection", func(t *testing.T) {
		col := &collection.Collection{
			Name: "my-api",
			Path: "/collections/my-api",
		}

		err := col.Validate()
		assert.NoError(t, err)
	})
}
