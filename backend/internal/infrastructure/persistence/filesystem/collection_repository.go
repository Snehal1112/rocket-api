package filesystem

import (
	"context"
	"fmt"
	"os"

	"github.com/yourusername/rocket-api/internal/domain/collection"
	"github.com/yourusername/rocket-api/pkg/logger"
)

// CollectionRepository implements collection.Repository using filesystem storage.
type CollectionRepository struct {
	basePath string
	logger   logger.Logger
}

// NewCollectionRepository creates a new filesystem-based collection repository.
func NewCollectionRepository(basePath string, log logger.Logger) *CollectionRepository {
	return &CollectionRepository{
		basePath: basePath,
		logger:   log,
	}
}

// Create stores a new collection by creating its directory.
func (r *CollectionRepository) Create(ctx context.Context, col *collection.Collection) error {
	if exists, _ := r.Exists(ctx, col.Name); exists {
		return collection.ErrCollectionExists
	}

	if err := os.MkdirAll(col.Path, 0755); err != nil {
		return fmt.Errorf("failed to create collection directory: %w", err)
	}

	r.logger.Infof("Created collection: %s at %s", col.Name, col.Path)
	return nil
}

// FindByName retrieves a collection by its name.
func (r *CollectionRepository) FindByName(ctx context.Context, name string) (*collection.Collection, error) {
	col, err := collection.NewCollection(name, r.basePath)
	if err != nil {
		return nil, err
	}

	if _, err := os.Stat(col.Path); os.IsNotExist(err) {
		return nil, collection.ErrNotFound
	}

	return col, nil
}

// FindAll retrieves all collections by reading directories.
func (r *CollectionRepository) FindAll(ctx context.Context) ([]*collection.Collection, error) {
	entries, err := os.ReadDir(r.basePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []*collection.Collection{}, nil
		}
		return nil, fmt.Errorf("failed to read collections directory: %w", err)
	}

	collections := make([]*collection.Collection, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			col, err := collection.NewCollection(entry.Name(), r.basePath)
			if err != nil {
				r.logger.Warnf("Skipping invalid collection directory: %s", entry.Name())
				continue
			}
			collections = append(collections, col)
		}
	}

	return collections, nil
}

// Update modifies an existing collection (currently a no-op for filesystem).
func (r *CollectionRepository) Update(ctx context.Context, col *collection.Collection) error {
	exists, err := r.Exists(ctx, col.Name)
	if err != nil {
		return err
	}
	if !exists {
		return collection.ErrNotFound
	}
	// For filesystem implementation, Update is currently a no-op
	// Future: could support renaming or moving collections
	return nil
}

// Delete removes a collection by deleting its directory.
func (r *CollectionRepository) Delete(ctx context.Context, name string) error {
	col, err := r.FindByName(ctx, name)
	if err != nil {
		return err
	}

	if err := os.RemoveAll(col.Path); err != nil {
		return fmt.Errorf("failed to delete collection directory: %w", err)
	}

	r.logger.Infof("Deleted collection: %s", name)
	return nil
}

// Exists checks if a collection with the given name exists.
func (r *CollectionRepository) Exists(ctx context.Context, name string) (bool, error) {
	col, err := collection.NewCollection(name, r.basePath)
	if err != nil {
		return false, err
	}

	_, err = os.Stat(col.Path)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}
