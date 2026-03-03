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

// EnvVariable represents a single environment variable with metadata.
type EnvVariable struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
	Secret  bool   `json:"secret"`
}

// Environment represents a named set of variables for a collection.
type Environment struct {
	Name      string        `json:"name"`
	Variables []EnvVariable `json:"variables"`
}

// ReadEnvironment reads an environment from its .env and .env.secret files.
func (r *CollectionRepository) ReadEnvironment(collectionName, envName string) (*Environment, error) {
	env := &Environment{Name: envName}

	readFile := func(path string, secret bool) error {
		content, err := os.ReadFile(path)
		if err != nil {
			if os.IsNotExist(err) {
				return nil // Missing file is expected; skip silently.
			}
			return err
		}
		for line := range strings.SplitSeq(string(content), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				env.Variables = append(env.Variables, EnvVariable{
					Key:     strings.TrimSpace(parts[0]),
					Value:   strings.TrimSpace(parts[1]),
					Enabled: true,
					Secret:  secret,
				})
			}
		}
		return nil
	}

	base := filepath.Join(r.basePath, collectionName, "environments")
	if err := readFile(filepath.Join(base, envName+".env"), false); err != nil {
		return nil, fmt.Errorf("failed to read environment %q: %w", envName, err)
	}
	if err := readFile(filepath.Join(base, envName+".env.secret"), true); err != nil {
		return nil, fmt.Errorf("failed to read environment secrets %q: %w", envName, err)
	}

	// Return not-found only when the main .env file is absent.
	mainPath := filepath.Join(base, envName+".env")
	if _, err := os.Stat(mainPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("environment %q not found", envName)
	}

	return env, nil
}

// WriteEnvironment writes enabled variables to .env (non-secrets) and .env.secret (secrets).
// An empty .env.secret is written when there are no secret variables, which clears any
// previously stored secrets.
func (r *CollectionRepository) WriteEnvironment(collectionName string, env *Environment) error {
	var plain, secret strings.Builder
	for _, v := range env.Variables {
		if !v.Enabled {
			continue
		}
		if v.Secret {
			fmt.Fprintf(&secret, "%s=%s\n", v.Key, v.Value)
		} else {
			fmt.Fprintf(&plain, "%s=%s\n", v.Key, v.Value)
		}
	}

	if err := r.WriteFile(collectionName, filepath.Join("environments", env.Name+".env"), []byte(plain.String())); err != nil {
		return err
	}
	return r.WriteFile(collectionName, filepath.Join("environments", env.Name+".env.secret"), []byte(secret.String()))
}

// DeleteEnvironment removes both the .env and .env.secret files for an environment.
func (r *CollectionRepository) DeleteEnvironment(collectionName, envName string) error {
	base := filepath.Join(r.basePath, collectionName, "environments")
	os.Remove(filepath.Join(base, envName+".env.secret")) // Ignore error — may not exist.
	if err := os.Remove(filepath.Join(base, envName+".env")); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete environment: %w", err)
	}
	return nil
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

// CollectionVar represents a single collection-level variable.
type CollectionVar struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
	Secret  bool   `json:"secret"`
}

// parseCollectionVars parses vars {} and vars:secret [] blocks from collection.bru content.
func parseCollectionVars(content string) []CollectionVar {
	var vars []CollectionVar
	secretKeys := map[string]bool{}

	inVarsBlock := false
	inSecretBlock := false

	for line := range strings.SplitSeq(content, "\n") {
		trimmed := strings.TrimSpace(line)

		switch {
		case trimmed == "vars {":
			inVarsBlock = true
			inSecretBlock = false
		case trimmed == "vars:secret [":
			inSecretBlock = true
			inVarsBlock = false
		case trimmed == "}" || trimmed == "]":
			inVarsBlock = false
			inSecretBlock = false
		case inVarsBlock && trimmed != "":
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				enabled := true
				// Bruno uses ~ prefix to mark a var as disabled.
				if strings.HasPrefix(key, "~") {
					key = key[1:]
					enabled = false
				}
				vars = append(vars, CollectionVar{
					Key:     key,
					Value:   strings.TrimSpace(parts[1]),
					Enabled: enabled,
				})
			}
		case inSecretBlock && trimmed != "":
			secretKeys[trimmed] = true
		}
	}

	for i := range vars {
		if secretKeys[vars[i].Key] {
			vars[i].Secret = true
		}
	}

	return vars
}

// formatCollectionVars serialises vars to collection.bru format.
func formatCollectionVars(vars []CollectionVar) string {
	var sb strings.Builder
	var secretKeys []string

	sb.WriteString("vars {\n")
	for _, v := range vars {
		// Collect secret keys regardless of enabled state so disabled+secret
		// vars survive a round-trip without losing their secret flag.
		if v.Secret {
			secretKeys = append(secretKeys, v.Key)
		}
		if v.Enabled {
			fmt.Fprintf(&sb, "  %s: %s\n", v.Key, v.Value)
		} else {
			// Write disabled vars with ~ prefix so they survive a round-trip.
			fmt.Fprintf(&sb, "  ~%s: %s\n", v.Key, v.Value)
		}
	}
	sb.WriteString("}\n")

	if len(secretKeys) > 0 {
		sb.WriteString("\nvars:secret [\n")
		for _, k := range secretKeys {
			fmt.Fprintf(&sb, "  %s\n", k)
		}
		sb.WriteString("]\n")
	}

	return sb.String()
}

// ReadCollectionVars reads collection-level variables from collection.bru.
// Returns an empty slice when the file does not exist yet.
func (r *CollectionRepository) ReadCollectionVars(collectionName string) ([]CollectionVar, error) {
	path := filepath.Join(r.basePath, collectionName, "collection.bru")
	content, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return []CollectionVar{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to read collection.bru: %w", err)
	}
	return parseCollectionVars(string(content)), nil
}

// WriteCollectionVars writes collection-level variables to collection.bru.
func (r *CollectionRepository) WriteCollectionVars(collectionName string, vars []CollectionVar) error {
	content := formatCollectionVars(vars)
	return r.WriteFile(collectionName, "collection.bru", []byte(content))
}