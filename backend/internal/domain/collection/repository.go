package collection

import (
	"context"
)

// Repository defines the interface for collection persistence operations.
// This follows the Repository pattern to abstract storage details from domain logic.
type Repository interface {
	// Create stores a new collection.
	// Returns ErrCollectionExists if collection with same name already exists.
	Create(ctx context.Context, collection *Collection) error

	// FindByName retrieves a collection by its name.
	// Returns ErrNotFound if collection doesn't exist.
	FindByName(ctx context.Context, name string) (*Collection, error)

	// FindAll retrieves all collections.
	// Returns empty slice if no collections exist.
	FindAll(ctx context.Context) ([]*Collection, error)

	// Update modifies an existing collection.
	// Returns ErrNotFound if collection doesn't exist.
	Update(ctx context.Context, collection *Collection) error

	// Delete removes a collection by name.
	// Returns ErrNotFound if collection doesn't exist.
	Delete(ctx context.Context, name string) error

	// Exists checks if a collection with the given name exists.
	Exists(ctx context.Context, name string) (bool, error)
}
