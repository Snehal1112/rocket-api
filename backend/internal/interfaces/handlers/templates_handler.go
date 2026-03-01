package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/yourusername/rocket-api/internal/infrastructure/repository"
)

// TemplatesHandler handles template-related HTTP requests
type TemplatesHandler struct {
	repo *repository.TemplatesRepository
}

// NewTemplatesHandler creates a new templates handler
func NewTemplatesHandler(repo *repository.TemplatesRepository) *TemplatesHandler {
	return &TemplatesHandler{repo: repo}
}

// ListTemplates handles GET /api/v1/templates
func (h *TemplatesHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	category := r.URL.Query().Get("category")
	templates, err := h.repo.ListTemplates(category)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    templates,
		"success": true,
		"message": "Templates retrieved successfully",
	})
}

// GetTemplate handles GET /api/v1/templates/{id}
func (h *TemplatesHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	template, err := h.repo.GetTemplate(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    template,
		"success": true,
		"message": "Template retrieved successfully",
	})
}

// CreateTemplate handles POST /api/v1/templates
func (h *TemplatesHandler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var template repository.Template
	if err := json.NewDecoder(r.Body).Decode(&template); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if template.Name == "" {
		http.Error(w, "Template name is required", http.StatusBadRequest)
		return
	}

	if err := h.repo.SaveTemplate(&template); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    template,
		"success": true,
		"message": "Template created successfully",
	})
}

// UpdateTemplate handles PUT /api/v1/templates/{id}
func (h *TemplatesHandler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "PUT" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	// Check if template exists
	existing, err := h.repo.GetTemplate(id)
	if err != nil {
		http.Error(w, "Template not found", http.StatusNotFound)
		return
	}

	var updates repository.Template
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update fields
	updates.ID = existing.ID
	if updates.Name == "" {
		updates.Name = existing.Name
	}

	if err := h.repo.SaveTemplate(&updates); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    updates,
		"success": true,
		"message": "Template updated successfully",
	})
}

// DeleteTemplate handles DELETE /api/v1/templates/{id}
func (h *TemplatesHandler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "DELETE" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteTemplate(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Template deleted successfully",
	})
}

// GetCategories handles GET /api/v1/templates/categories
func (h *TemplatesHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	categories, err := h.repo.GetCategories()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    categories,
		"success": true,
		"message": "Categories retrieved successfully",
	})
}
