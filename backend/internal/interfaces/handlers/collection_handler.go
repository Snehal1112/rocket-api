package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/yourusername/rocket-api/internal/infrastructure/repository"
	"github.com/yourusername/rocket-api/pkg/bru"
)

// CollectionHandler handles collection-related HTTP requests
type CollectionHandler struct {
	repo *repository.CollectionRepository
}

// NewCollectionHandler creates a new collection handler
func NewCollectionHandler(repo *repository.CollectionRepository) *CollectionHandler {
	return &CollectionHandler{repo: repo}
}

// ListCollections handles GET /api/v1/collections
func (h *CollectionHandler) ListCollections(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	collections, err := h.repo.ListCollections()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list collections: %v", err), http.StatusInternalServerError)
		return
	}

	// Get details for each collection
	var result []map[string]interface{}
	for _, name := range collections {
		structure, err := h.repo.GetCollectionStructure(name)
		if err != nil {
			continue
		}

		// Count requests
		requestCount := 0
		for _, child := range structure.Children {
			if child.Type == "request" {
				requestCount++
			}
		}

		result = append(result, map[string]interface{}{
			"id":           name,
			"name":         name,
			"path":         "/collections/" + name,
			"requestCount": requestCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    result,
		"success": true,
		"message": "Collections retrieved successfully",
	})
}

// CreateCollection handles POST /api/v1/collections
func (h *CollectionHandler) CreateCollection(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.Name == "" {
		http.Error(w, "Collection name is required", http.StatusBadRequest)
		return
	}

	if err := h.repo.CreateCollection(payload.Name); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create collection: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": map[string]interface{}{
			"id":   payload.Name,
			"name": payload.Name,
			"path": "/collections/" + payload.Name,
		},
		"success": true,
		"message": "Collection created successfully",
	})
}

// GetCollection handles GET /api/v1/collections/{id}
func (h *CollectionHandler) GetCollection(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Extract collection name from URL path
	// Expected: /api/v1/collections/{name}
	path := r.URL.Path
	var collectionName string
	fmt.Sscanf(path, "/api/v1/collections/%s", &collectionName)

	if collectionName == "" {
		http.Error(w, "Collection name is required", http.StatusBadRequest)
		return
	}

	structure, err := h.repo.GetCollectionStructure(collectionName)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get collection: %v", err), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    structure,
		"success": true,
		"message": "Collection retrieved successfully",
	})
}

// DeleteCollection handles DELETE /api/v1/collections/{id}
func (h *CollectionHandler) DeleteCollection(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Extract collection name from URL path
	path := r.URL.Path
	var collectionName string
	fmt.Sscanf(path, "/api/v1/collections/%s", &collectionName)

	if collectionName == "" {
		http.Error(w, "Collection name is required", http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteCollection(collectionName); err != nil {
		http.Error(w, fmt.Sprintf("Failed to delete collection: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Collection deleted successfully",
	})
}

// GetRequest handles GET /api/v1/collections/{collection}/requests/{path}
func (h *CollectionHandler) GetRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Parse URL to get collection and file path
	// Expected: /api/v1/collections/{collection}/requests/{path}
	query := r.URL.Query()
	collection := query.Get("collection")
	filePath := query.Get("path")

	if collection == "" || filePath == "" {
		http.Error(w, "Collection and path are required", http.StatusBadRequest)
		return
	}

	bruFile, err := h.repo.ParseBruFile(collection, filePath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse request: %v", err), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    bruFile,
		"success": true,
		"message": "Request retrieved successfully",
	})
}

// SaveRequest handles POST /api/v1/collections/{collection}/requests
func (h *CollectionHandler) SaveRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var payload struct {
		Collection string       `json:"collection"`
		Path       string       `json:"path"`
		Request    *bru.BruFile `json:"request"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.Collection == "" || payload.Request == nil {
		http.Error(w, "Collection and request are required", http.StatusBadRequest)
		return
	}

	// Use request name as filename if path not provided
	filePath := payload.Path
	if filePath == "" {
		filePath = payload.Request.Meta.Name + ".bru"
	}

	if err := h.repo.WriteBruFile(payload.Collection, filePath, payload.Request); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save request: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": map[string]interface{}{
			"path": filePath,
		},
		"success": true,
		"message": "Request saved successfully",
	})
}

// DeleteRequest handles DELETE /api/v1/collections/{collection}/requests/{path}
func (h *CollectionHandler) DeleteRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	query := r.URL.Query()
	collection := query.Get("collection")
	filePath := query.Get("path")

	if collection == "" || filePath == "" {
		http.Error(w, "Collection and path are required", http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteFile(collection, filePath); err != nil {
		http.Error(w, fmt.Sprintf("Failed to delete request: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Request deleted successfully",
	})
}

// ListEnvironments handles GET /api/v1/collections/{collection}/environments
// ListEnvironments handles GET /api/v1/environments.
// When the "name" query param is present it returns the single named environment;
// otherwise it returns the list of environment names for the collection.
func (h *CollectionHandler) ListEnvironments(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	query := r.URL.Query()
	collection := query.Get("collection")

	if collection == "" {
		http.Error(w, "Collection is required", http.StatusBadRequest)
		return
	}

	// Single-environment fetch when name is provided.
	if envName := query.Get("name"); envName != "" {
		env, err := h.repo.ReadEnvironment(collection, envName)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to read environment: %v", err), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"data":    env,
			"success": true,
			"message": "Environment retrieved successfully",
		})
		return
	}

	envs, err := h.repo.ListEnvironments(collection)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list environments: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    envs,
		"success": true,
		"message": "Environments retrieved successfully",
	})
}

// DeleteEnvironment handles DELETE /api/v1/environments
func (h *CollectionHandler) DeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	query := r.URL.Query()
	collection := query.Get("collection")
	envName := query.Get("name")

	if collection == "" || envName == "" {
		http.Error(w, "Collection and environment name are required", http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteEnvironment(collection, envName); err != nil {
		http.Error(w, fmt.Sprintf("Failed to delete environment: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Environment deleted successfully",
	})
}

// SaveEnvironment handles POST /api/v1/collections/{collection}/environments
func (h *CollectionHandler) SaveEnvironment(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var payload struct {
		Collection string                       `json:"collection"`
		Environment *repository.Environment     `json:"environment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.Collection == "" || payload.Environment == nil {
		http.Error(w, "Collection and environment are required", http.StatusBadRequest)
		return
	}

	if err := h.repo.WriteEnvironment(payload.Collection, payload.Environment); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save environment: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Environment saved successfully",
	})
}

// GetCollectionVars handles GET /api/v1/collections/{name}/variables
func (h *CollectionHandler) GetCollectionVars(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	vars := mux.Vars(r)
	name := vars["name"]

	if name == "" {
		http.Error(w, "Collection name is required", http.StatusBadRequest)
		return
	}

	collVars, err := h.repo.ReadCollectionVars(name)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read collection variables: %v", err), http.StatusInternalServerError)
		return
	}

	// Mask secret values before sending to the client.
	masked := make([]repository.CollectionVar, len(collVars))
	for i, v := range collVars {
		masked[i] = v
		if v.Secret {
			masked[i].Value = ""
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    masked,
		"success": true,
		"message": "Collection variables retrieved successfully",
	})
}

// SaveCollectionVars handles POST /api/v1/collections/{name}/variables
func (h *CollectionHandler) SaveCollectionVars(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	vars := mux.Vars(r)
	name := vars["name"]

	if name == "" {
		http.Error(w, "Collection name is required", http.StatusBadRequest)
		return
	}

	var payload struct {
		Variables []repository.CollectionVar `json:"variables"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Preserve stored secret values when the client sends an empty placeholder.
	// GetCollectionVars masks secret values as "" before sending them to the
	// client, so a save without a new value must not erase the stored secret.
	existing, err := h.repo.ReadCollectionVars(name)
	if err == nil && len(existing) > 0 {
		existingByKey := make(map[string]string, len(existing))
		for _, v := range existing {
			if v.Secret {
				existingByKey[v.Key] = v.Value
			}
		}
		for i, v := range payload.Variables {
			if v.Secret && v.Value == "" {
				if stored, ok := existingByKey[v.Key]; ok {
					payload.Variables[i].Value = stored
				}
			}
		}
	}

	// An empty slice is valid — it clears all existing collection variables.
	if err := h.repo.WriteCollectionVars(name, payload.Variables); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save collection variables: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Collection variables saved successfully",
	})
}