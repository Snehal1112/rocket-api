package collection

import (
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type Collection struct {
	Name      string
	Path      string
	CreatedAt time.Time
}

var validNameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func NewCollection(name string, basePath string) (*Collection, error) {
	if name == "" {
		return nil, ErrInvalidName
	}

	// Check for path traversal
	if strings.Contains(name, "..") || strings.Contains(name, "/") || strings.Contains(name, "\\") {
		return nil, ErrInvalidName
	}

	// Validate name format (alphanumeric, hyphens, underscores only)
	if !validNameRegex.MatchString(name) {
		return nil, ErrInvalidName
	}

	return &Collection{
		Name:      name,
		Path:      filepath.Join(basePath, name),
		CreatedAt: time.Now(),
	}, nil
}

func (c *Collection) Validate() error {
	if c.Name == "" {
		return ErrInvalidName
	}
	if c.Path == "" {
		return ErrInvalidName
	}
	return nil
}
