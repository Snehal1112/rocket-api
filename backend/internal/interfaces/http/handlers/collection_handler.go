package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/yourusername/rocket-api/internal/app"
	"github.com/yourusername/rocket-api/internal/domain/collection"
	"github.com/yourusername/rocket-api/internal/interfaces/dto"
	"github.com/yourusername/rocket-api/pkg/logger"
)

type CollectionHandler struct {
	service *app.CollectionService
	logger  logger.Logger
}

func NewCollectionHandler(service *app.CollectionService, log logger.Logger) *CollectionHandler {
	return &CollectionHandler{
		service: service,
		logger:  log,
	}
}

func (h *CollectionHandler) ListCollections(w http.ResponseWriter, r *http.Request) {
	collections, err := h.service.ListCollections(r.Context())
	if err != nil {
		h.logger.Errorf("Failed to list collections: %v", err)
		dto.WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list collections")
		return
	}

	response := dto.ToCollectionsResponse(collections)
	dto.WriteJSON(w, http.StatusOK, response)
}

func (h *CollectionHandler) CreateCollection(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		dto.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
		return
	}

	col, err := h.service.CreateCollection(r.Context(), req.Name)
	if err != nil {
		if err == collection.ErrInvalidName {
			dto.WriteError(w, http.StatusBadRequest, "INVALID_NAME", "Invalid collection name")
			return
		}
		if err == collection.ErrCollectionExists {
			dto.WriteError(w, http.StatusConflict, "COLLECTION_EXISTS", "Collection already exists")
			return
		}

		h.logger.Errorf("Failed to create collection: %v", err)
		dto.WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create collection")
		return
	}

	response := dto.ToCollectionResponse(col)
	dto.WriteJSON(w, http.StatusCreated, response)
}

func (h *CollectionHandler) DeleteCollection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	if err := h.service.DeleteCollection(r.Context(), name); err != nil {
		if err == collection.ErrNotFound {
			dto.WriteError(w, http.StatusNotFound, "COLLECTION_NOT_FOUND", "Collection not found")
			return
		}

		h.logger.Errorf("Failed to delete collection: %v", err)
		dto.WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete collection")
		return
	}

	dto.WriteJSON(w, http.StatusOK, dto.SuccessResponse{Success: true})
}
