package app

import (
	"context"

	"github.com/yourusername/rocket-api/internal/domain/collection"
	"github.com/yourusername/rocket-api/pkg/logger"
)

// CollectionService provides application-level operations for collections.
type CollectionService struct {
	repo     collection.Repository
	basePath string
	logger   logger.Logger
}

// NewCollectionService creates a new collection service.
func NewCollectionService(repo collection.Repository, basePath string, log logger.Logger) *CollectionService {
	return &CollectionService{
		repo:     repo,
		basePath: basePath,
		logger:   log,
	}
}

// ListCollections returns all collections.
func (s *CollectionService) ListCollections(ctx context.Context) ([]*collection.Collection, error) {
	return s.repo.FindAll(ctx)
}

// CreateCollection creates a new collection with the given name.
func (s *CollectionService) CreateCollection(ctx context.Context, name string) (*collection.Collection, error) {
	// Create domain entity with validation.
	col, err := collection.NewCollection(name, s.basePath)
	if err != nil {
		s.logger.Warnf("Invalid collection name: %s, error: %v", name, err)
		return nil, err
	}

	// Persist to repository.
	if err := s.repo.Create(ctx, col); err != nil {
		s.logger.Errorf("Failed to create collection %s: %v", name, err)
		return nil, err
	}

	s.logger.Infof("Created collection: %s", name)
	return col, nil
}

// DeleteCollection deletes a collection by name.
func (s *CollectionService) DeleteCollection(ctx context.Context, name string) error {
	if err := s.repo.Delete(ctx, name); err != nil {
		s.logger.Errorf("Failed to delete collection %s: %v", name, err)
		return err
	}

	s.logger.Infof("Deleted collection: %s", name)
	return nil
}

// GetCollection retrieves a collection by name.
func (s *CollectionService) GetCollection(ctx context.Context, name string) (*collection.Collection, error) {
	return s.repo.FindByName(ctx, name)
}
