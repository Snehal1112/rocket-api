package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yourusername/rocket-api/internal/infrastructure/repository"
)

func TestCollectionHandler_SaveAndGetRequest_PreservesScripts(t *testing.T) {
	tempDir := t.TempDir()
	repo := repository.NewCollectionRepository(tempDir)
	if err := repo.CreateCollection("scripted"); err != nil {
		t.Fatalf("CreateCollection() error = %v", err)
	}
	handler := NewCollectionHandler(repo)

	savePayload := map[string]any{
		"collection": "scripted",
		"path":       "scripted-request.bru",
		"request": map[string]any{
			"meta": map[string]any{
				"name": "Scripted Request",
				"type": "http",
				"seq":  1,
			},
			"http": map[string]any{
				"method":  "GET",
				"url":     "https://api.example.com/items",
				"headers": []map[string]any{},
			},
			"body": map[string]any{
				"type": "none",
			},
			"scripts": map[string]any{
				"language":     "typescript",
				"preRequest":   "pm.environment.set('token', 'abc')",
				"postResponse": "pm.test('ok', () => {})",
			},
		},
	}

	body, _ := json.Marshal(savePayload)
	saveReq := httptest.NewRequest(http.MethodPost, "/api/v1/requests", bytes.NewReader(body))
	saveRec := httptest.NewRecorder()
	handler.SaveRequest(saveRec, saveReq)
	if saveRec.Code != http.StatusOK {
		t.Fatalf("SaveRequest status=%d body=%s", saveRec.Code, saveRec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/requests?collection=scripted&path=scripted-request.bru", nil)
	getRec := httptest.NewRecorder()
	handler.GetRequest(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GetRequest status=%d body=%s", getRec.Code, getRec.Body.String())
	}

	var response struct {
		Data struct {
			Scripts struct {
				Language     string `json:"language"`
				PreRequest   string `json:"preRequest"`
				PostResponse string `json:"postResponse"`
			} `json:"scripts"`
		} `json:"data"`
	}
	if err := json.Unmarshal(getRec.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if response.Data.Scripts.Language != "typescript" {
		t.Fatalf("scripts.language=%q", response.Data.Scripts.Language)
	}
	if response.Data.Scripts.PreRequest != "pm.environment.set('token', 'abc')" {
		t.Fatalf("scripts.preRequest=%q", response.Data.Scripts.PreRequest)
	}
	if response.Data.Scripts.PostResponse != "pm.test('ok', () => {})" {
		t.Fatalf("scripts.postResponse=%q", response.Data.Scripts.PostResponse)
	}
}
