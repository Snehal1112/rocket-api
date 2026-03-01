package repository

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Template represents a reusable request template
type Template struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Category    string            `json:"category"`
	Method      string            `json:"method"`
	URL         string            `json:"url"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	BodyType    string            `json:"bodyType"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

// TemplatesRepository handles file system operations for templates
type TemplatesRepository struct {
	basePath string
}

// NewTemplatesRepository creates a new templates repository
func NewTemplatesRepository(basePath string) *TemplatesRepository {
	return &TemplatesRepository{basePath: basePath}
}

// EnsureBasePath creates the templates directory if it doesn't exist
func (r *TemplatesRepository) EnsureBasePath() error {
	return os.MkdirAll(r.basePath, 0755)
}

// SaveTemplate saves a template to disk
func (r *TemplatesRepository) SaveTemplate(template *Template) error {
	if err := r.EnsureBasePath(); err != nil {
		return err
	}

	// Generate ID if not provided
	if template.ID == "" {
		template.ID = fmt.Sprintf("template_%d", time.Now().UnixNano())
	}

	now := time.Now()
	if template.CreatedAt.IsZero() {
		template.CreatedAt = now
	}
	template.UpdatedAt = now

	filePath := filepath.Join(r.basePath, template.ID+".json")
	data, err := json.MarshalIndent(template, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal template: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write template: %w", err)
	}

	return nil
}

// GetTemplate retrieves a specific template by ID
func (r *TemplatesRepository) GetTemplate(id string) (*Template, error) {
	filePath := filepath.Join(r.basePath, id+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read template: %w", err)
	}

	var template Template
	if err := json.Unmarshal(data, &template); err != nil {
		return nil, fmt.Errorf("failed to unmarshal template: %w", err)
	}

	return &template, nil
}

// ListTemplates returns all templates, optionally filtered by category
func (r *TemplatesRepository) ListTemplates(category string) ([]*Template, error) {
	entries, err := os.ReadDir(r.basePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []*Template{}, nil
		}
		return nil, fmt.Errorf("failed to read templates directory: %w", err)
	}

	var templates []*Template
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		id := strings.TrimSuffix(entry.Name(), ".json")
		template, err := r.GetTemplate(id)
		if err != nil {
			continue // skip corrupted templates
		}

		// Filter by category if specified
		if category != "" && !strings.EqualFold(template.Category, category) {
			continue
		}

		templates = append(templates, template)
	}

	// Sort by name
	sort.Slice(templates, func(i, j int) bool {
		return templates[i].Name < templates[j].Name
	})

	return templates, nil
}

// DeleteTemplate deletes a specific template
func (r *TemplatesRepository) DeleteTemplate(id string) error {
	filePath := filepath.Join(r.basePath, id+".json")
	return os.Remove(filePath)
}

// GetCategories returns all unique template categories
func (r *TemplatesRepository) GetCategories() ([]string, error) {
	templates, err := r.ListTemplates("")
	if err != nil {
		return nil, err
	}

	categoryMap := make(map[string]bool)
	for _, t := range templates {
		if t.Category != "" {
			categoryMap[t.Category] = true
		}
	}

	categories := make([]string, 0, len(categoryMap))
	for cat := range categoryMap {
		categories = append(categories, cat)
	}
	sort.Strings(categories)

	return categories, nil
}

// CreateDefaultTemplates creates built-in templates if they don't exist
func (r *TemplatesRepository) CreateDefaultTemplates() error {
	defaults := []*Template{
		{
			Name:        "GET Request",
			Description: "Basic GET request template",
			Category:    "Basic",
			Method:      "GET",
			URL:         "https://api.example.com/resource",
			Headers: map[string]string{
				"Accept": "application/json",
			},
			BodyType: "none",
		},
		{
			Name:        "POST JSON",
			Description: "POST request with JSON body",
			Category:    "Basic",
			Method:      "POST",
			URL:         "https://api.example.com/resource",
			Headers: map[string]string{
				"Content-Type": "application/json",
				"Accept":       "application/json",
			},
			Body:     "{\n  \"key\": \"value\"\n}",
			BodyType: "json",
		},
		{
			Name:        "POST Form Data",
			Description: "POST request with form data",
			Category:    "Basic",
			Method:      "POST",
			URL:         "https://api.example.com/resource",
			Headers: map[string]string{
				"Content-Type": "application/x-www-form-urlencoded",
			},
			Body:     "key1=value1&key2=value2",
			BodyType: "raw",
		},
		{
			Name:        "Authorization Bearer",
			Description: "Request with Bearer token authorization",
			Category:    "Auth",
			Method:      "GET",
			URL:         "https://api.example.com/protected",
			Headers: map[string]string{
				"Authorization": "Bearer {{token}}",
				"Accept":        "application/json",
			},
			BodyType: "none",
		},
		{
			Name:        "REST API - Create",
			Description: "REST API POST for creating resources",
			Category:    "REST",
			Method:      "POST",
			URL:         "https://api.example.com/{{resource}}",
			Headers: map[string]string{
				"Content-Type": "application/json",
				"Accept":       "application/json",
			},
			Body: "{\n  \"name\": \"{{name}}\",\n  \"description\": \"{{description}}\"\n}",
			BodyType: "json",
		},
		{
			Name:        "REST API - Update",
			Description: "REST API PUT for updating resources",
			Category:    "REST",
			Method:      "PUT",
			URL:         "https://api.example.com/{{resource}}/{{id}}",
			Headers: map[string]string{
				"Content-Type": "application/json",
				"Accept":       "application/json",
			},
			Body: "{\n  \"name\": \"{{name}}\"\n}",
			BodyType: "json",
		},
		{
			Name:        "GraphQL Query",
			Description: "GraphQL query template",
			Category:    "GraphQL",
			Method:      "POST",
			URL:         "https://api.example.com/graphql",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: "{\n  \"query\": \"query { users { id name email } }\"\n}",
			BodyType: "json",
		},
	}

	for _, template := range defaults {
		// Check if template with same name already exists
		existing, _ := r.ListTemplates("")
		exists := false
		for _, e := range existing {
			if e.Name == template.Name {
				exists = true
				break
			}
		}
		if !exists {
			if err := r.SaveTemplate(template); err != nil {
				return err
			}
		}
	}

	return nil
}
