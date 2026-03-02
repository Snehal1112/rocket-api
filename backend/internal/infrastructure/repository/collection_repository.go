package repository

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/yourusername/rocket-api/pkg/bru"
)

// CollectionRepository handles file system operations for collections
type CollectionRepository struct {
	basePath string
}

// NewCollectionRepository creates a new collection repository
func NewCollectionRepository(basePath string) *CollectionRepository {
	return &CollectionRepository{
		basePath: basePath,
	}
}

// EnsureBasePath creates the collections directory if it doesn't exist
func (r *CollectionRepository) EnsureBasePath() error {
	return os.MkdirAll(r.basePath, 0755)
}

// ListCollections returns all collection names
func (r *CollectionRepository) ListCollections() ([]string, error) {
	entries, err := os.ReadDir(r.basePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read collections directory: %w", err)
	}

	var collections []string
	for _, entry := range entries {
		if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") {
			collections = append(collections, entry.Name())
		}
	}

	return collections, nil
}

// CreateCollection creates a new collection directory
func (r *CollectionRepository) CreateCollection(name string) error {
	collectionPath := filepath.Join(r.basePath, name)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return fmt.Errorf("failed to create collection: %w", err)
	}

	// Create environments subdirectory
	envPath := filepath.Join(collectionPath, "environments")
	if err := os.MkdirAll(envPath, 0755); err != nil {
		return fmt.Errorf("failed to create environments directory: %w", err)
	}

	// Create a default environment file
	defaultEnv := `DEV_BASE_URL=http://localhost:3000
API_KEY=your-api-key-here
`
	envFilePath := filepath.Join(envPath, "dev.env")
	if err := os.WriteFile(envFilePath, []byte(defaultEnv), 0644); err != nil {
		return fmt.Errorf("failed to create default environment: %w", err)
	}

	return nil
}

// DeleteCollection removes a collection directory
func (r *CollectionRepository) DeleteCollection(name string) error {
	collectionPath := filepath.Join(r.basePath, name)
	return os.RemoveAll(collectionPath)
}

// RenameCollection renames a collection
func (r *CollectionRepository) RenameCollection(oldName, newName string) error {
	oldPath := filepath.Join(r.basePath, oldName)
	newPath := filepath.Join(r.basePath, newName)
	return os.Rename(oldPath, newPath)
}

// ReadFile reads a file from a collection
func (r *CollectionRepository) ReadFile(collectionName, filePath string) ([]byte, error) {
	fullPath := filepath.Join(r.basePath, collectionName, filePath)
	return os.ReadFile(fullPath)
}

// WriteFile writes a file to a collection
func (r *CollectionRepository) WriteFile(collectionName, filePath string, content []byte) error {
	fullPath := filepath.Join(r.basePath, collectionName, filePath)

	// Ensure the directory exists
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	return os.WriteFile(fullPath, content, 0644)
}

// DeleteFile deletes a file from a collection
func (r *CollectionRepository) DeleteFile(collectionName, filePath string) error {
	fullPath := filepath.Join(r.basePath, collectionName, filePath)
	return os.Remove(fullPath)
}

// ListFiles lists all files in a collection (recursively)
func (r *CollectionRepository) ListFiles(collectionName string) ([]string, error) {
	collectionPath := filepath.Join(r.basePath, collectionName)
	var files []string

	err := filepath.Walk(collectionPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			// Get relative path from collection root
			relPath, err := filepath.Rel(collectionPath, path)
			if err != nil {
				return err
			}
			files = append(files, relPath)
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to list files: %w", err)
	}

	return files, nil
}

// ListBruFiles lists all .bru files in a collection
func (r *CollectionRepository) ListBruFiles(collectionName string) ([]string, error) {
	files, err := r.ListFiles(collectionName)
	if err != nil {
		return nil, err
	}

	var bruFiles []string
	for _, file := range files {
		if strings.HasSuffix(file, ".bru") {
			bruFiles = append(bruFiles, file)
		}
	}

	return bruFiles, nil
}

// ParseBruFile parses a .bru file from a collection
func (r *CollectionRepository) ParseBruFile(collectionName, filePath string) (*bru.BruFile, error) {
	fullPath := filepath.Join(r.basePath, collectionName, filePath)
	return bru.Parse(fullPath)
}

// WriteBruFile writes a .bru file to a collection
func (r *CollectionRepository) WriteBruFile(collectionName, filePath string, bruFile *bru.BruFile) error {
	content := bru.GenerateContent(bruFile)
	return r.WriteFile(collectionName, filePath, []byte(content))
}

// GetCollectionStructure returns the folder structure of a collection
func (r *CollectionRepository) GetCollectionStructure(collectionName string) (*CollectionNode, error) {
	collectionPath := filepath.Join(r.basePath, collectionName)

	root := &CollectionNode{
		Name:     collectionName,
		Type:     "collection",
		Children: []CollectionNode{},
	}

	err := filepath.Walk(collectionPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip the root directory
		if path == collectionPath {
			return nil
		}

		// Skip the environments directory and all its contents.
		if info.IsDir() && info.Name() == "environments" {
			return filepath.SkipDir
		}
		// Skip any stray .env files outside environments/.
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".env") {
			return nil
		}

		relPath, err := filepath.Rel(collectionPath, path)
		if err != nil {
			return err
		}

		node := CollectionNode{
			Name: info.Name(),
			Path: relPath,
		}

		if info.IsDir() {
			node.Type = "folder"
		} else if strings.HasSuffix(info.Name(), ".bru") {
			node.Type = "request"
			// Try to parse the bru file to get the request name
			if bruFile, err := bru.Parse(path); err == nil {
				node.Name = bruFile.Meta.Name
				node.Method = bruFile.HTTP.Method
			}
		} else {
			node.Type = "file"
		}

		// Add to parent's children (simplified - assumes flat structure for now)
		root.Children = append(root.Children, node)
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to get collection structure: %w", err)
	}

	return root, nil
}

// CollectionNode represents a node in the collection structure
type CollectionNode struct {
	Name     string           `json:"name"`
	Type     string           `json:"type"`
	Path     string           `json:"path,omitempty"`
	Method   string           `json:"method,omitempty"`
	Children []CollectionNode `json:"children,omitempty"`
}

// Environment represents an environment file
type Environment struct {
	Name      string            `json:"name"`
	Variables map[string]string `json:"variables"`
}

// ReadEnvironment reads an environment file
func (r *CollectionRepository) ReadEnvironment(collectionName, envName string) (*Environment, error) {
	envPath := filepath.Join(r.basePath, collectionName, "environments", envName+".env")
	content, err := os.ReadFile(envPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read environment: %w", err)
	}

	env := &Environment{
		Name:      envName,
		Variables: make(map[string]string),
	}

	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			env.Variables[key] = value
		}
	}

	return env, nil
}

// WriteEnvironment writes an environment file
func (r *CollectionRepository) WriteEnvironment(collectionName string, env *Environment) error {
	var content strings.Builder
	for key, value := range env.Variables {
		content.WriteString(fmt.Sprintf("%s=%s\n", key, value))
	}

	envPath := filepath.Join("environments", env.Name+".env")
	return r.WriteFile(collectionName, envPath, []byte(content.String()))
}

// ListEnvironments lists all environments in a collection
func (r *CollectionRepository) ListEnvironments(collectionName string) ([]string, error) {
	envPath := filepath.Join(r.basePath, collectionName, "environments")
	entries, err := os.ReadDir(envPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read environments directory: %w", err)
	}

	var envs []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".env") {
			envName := strings.TrimSuffix(entry.Name(), ".env")
			envs = append(envs, envName)
		}
	}

	return envs, nil
}