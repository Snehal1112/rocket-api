package collection

import "errors"

var (
	ErrInvalidName      = errors.New("invalid collection name")
	ErrCollectionExists = errors.New("collection already exists")
	ErrNotFound         = errors.New("collection not found")
)
