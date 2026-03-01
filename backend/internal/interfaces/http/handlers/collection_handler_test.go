package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/yourusername/rocket-api/internal/app"
	"github.com/yourusername/rocket-api/internal/infrastructure/persistence/filesystem"
	"github.com/yourusername/rocket-api/internal/interfaces/dto"
	"github.com/yourusername/rocket-api/internal/interfaces/http/handlers"
	"github.com/yourusername/rocket-api/pkg/logger"
)

func setupCollectionHandler(t *testing.T) (*handlers.CollectionHandler, string) {
	t.Helper()
	tmpDir := t.TempDir()
	log := logger.NewNoop()
	repo := filesystem.NewCollectionRepository(tmpDir, log)
	service := app.NewCollectionService(repo, tmpDir, log)
	handler := handlers.NewCollectionHandler(service, log)
	return handler, tmpDir
}

func TestCollectionHandler_ListCollections(t *testing.T) {
	handler, _ := setupCollectionHandler(t)

	req := httptest.NewRequest("GET", "/api/v1/collections", nil)
	w := httptest.NewRecorder()

	handler.ListCollections(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response dto.CollectionsResponse
	err := json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)
	assert.NotNil(t, response.Collections)
}

func TestCollectionHandler_CreateCollection(t *testing.T) {
	handler, _ := setupCollectionHandler(t)

	body := dto.CreateCollectionRequest{Name: "test-api"}
	bodyBytes, err := json.Marshal(body)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/collections", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateCollection(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response dto.CollectionResponse
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)
	assert.Equal(t, "test-api", response.Name)
}

func TestCollectionHandler_DeleteCollection(t *testing.T) {
	handler, _ := setupCollectionHandler(t)

	// Create a collection first.
	createBody := dto.CreateCollectionRequest{Name: "to-delete"}
	createBodyBytes, err := json.Marshal(createBody)
	require.NoError(t, err)
	createReq := httptest.NewRequest("POST", "/api/v1/collections", bytes.NewReader(createBodyBytes))
	createReq.Header.Set("Content-Type", "application/json")
	createW := httptest.NewRecorder()
	handler.CreateCollection(createW, createReq)
	require.Equal(t, http.StatusCreated, createW.Code)

	// Delete it.
	req := httptest.NewRequest("DELETE", "/api/v1/collections/to-delete", nil)
	req = mux.SetURLVars(req, map[string]string{"name": "to-delete"})
	w := httptest.NewRecorder()

	handler.DeleteCollection(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCollectionHandler_CreateCollection_InvalidName(t *testing.T) {
	handler, _ := setupCollectionHandler(t)

	body := dto.CreateCollectionRequest{Name: "../invalid"}
	bodyBytes, err := json.Marshal(body)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/collections", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateCollection(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response dto.ErrorResponse
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)
	assert.Equal(t, "INVALID_NAME", response.Error.Code)
}
