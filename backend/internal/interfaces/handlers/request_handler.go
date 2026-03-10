package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/yourusername/rocket-api/internal/app/scripting"
	"github.com/yourusername/rocket-api/internal/infrastructure/repository"
)

// historyRepo is set by main.go to enable history tracking
var historyRepo *repository.HistoryRepository

// cookieJar is set by main.go to enable cookie handling
var cookieJar *repository.CookieJar

// SetHistoryRepository sets the history repository for request tracking
func SetHistoryRepository(repo *repository.HistoryRepository) {
	historyRepo = repo
}

// SetCookieJar sets the cookie jar for request handling
func SetCookieJar(jar *repository.CookieJar) {
	cookieJar = jar
}

type FormDataField struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Type        string `json:"type"` // "text" or "file"
	FileName    string `json:"fileName,omitempty"`
	FileContent string `json:"fileContent,omitempty"` // base64 encoded
	Enabled     bool   `json:"enabled"`
}

type AuthConfig struct {
	Type   string `json:"type"` // "none", "basic", "bearer", "api-key"
	Basic  *struct {
		Username string `json:"username"`
		Password string `json:"password"`
	} `json:"basic,omitempty"`
	Bearer *struct {
		Token string `json:"token"`
	} `json:"bearer,omitempty"`
	APIKey *struct {
		Key   string `json:"key"`
		Value string `json:"value"`
		In    string `json:"in"` // "header" or "query"
	} `json:"apiKey,omitempty"`
}

type RequestPayload struct {
	Method      string            `json:"method"`
	URL         string            `json:"url"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	BodyType    string            `json:"bodyType,omitempty"` // "none", "json", "form-data", "raw", "binary"
	FormData    []FormDataField   `json:"formData,omitempty"`
	FileName    string            `json:"fileName,omitempty"`
	QueryParams []QueryParam      `json:"queryParams"`
	Auth        AuthConfig        `json:"auth"`
	Scripts     *struct {
		Language     string `json:"language"`
		PreRequest   string `json:"preRequest"`
		PostResponse string `json:"postResponse"`
	} `json:"scripts,omitempty"`
	EnvironmentVariables map[string]string `json:"environmentVariables,omitempty"`
}

type QueryParam struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type ResponsePayload struct {
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Headers    map[string]string `json:"headers"`
	Body       interface{}       `json:"body"`
	Size       int               `json:"size"`
	Time       int64             `json:"time"` // in milliseconds
}

func SendRequestHandler(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers for all responses
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	w.Header().Set("Access-Control-Allow-Credentials", "true")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var payload RequestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if payload.URL == "" {
		http.Error(w, "URL is required", http.StatusBadRequest)
		return
	}

	startTime := time.Now()

	var preScriptResult *scripting.ExecutionResult
	if payload.Scripts != nil && strings.TrimSpace(payload.Scripts.PreRequest) != "" {
		scriptRequest := &scripting.RequestState{
			Method:  payload.Method,
			URL:     payload.URL,
			Headers: payload.Headers,
			Body:    payload.Body,
		}
		if scriptRequest.Headers == nil {
			scriptRequest.Headers = map[string]string{}
		}

		// Seed variables with the environment/collection vars passed from the client.
		initVars := make(map[string]string, len(payload.EnvironmentVariables))
		for k, v := range payload.EnvironmentVariables {
			initVars[k] = v
		}
		execResult, execErr := scripting.ExecutePreRequestScript(
			payload.Scripts.PreRequest,
			payload.Scripts.Language,
			scriptRequest,
			initVars,
		)
		if execErr != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"data": map[string]interface{}{
					"scriptError": execErr.Error(),
					"scriptResult": execResult,
				},
				"success": false,
				"message": "Pre-request script failed",
			})
			return
		}
		preScriptResult = execResult
		payload.Method = scriptRequest.Method
		payload.URL = scriptRequest.URL
		payload.Headers = scriptRequest.Headers
		payload.Body = scriptRequest.Body
	}

	// Build URL with query parameters
	finalURL := payload.URL
	if len(payload.QueryParams) > 0 {
		// Check if URL already has query params
		separator := "?"
		if strings.Contains(finalURL, "?") {
			separator = "&"
		}
		var queryParts []string
		for _, param := range payload.QueryParams {
			if param.Enabled && param.Key != "" {
				queryParts = append(queryParts, fmt.Sprintf("%s=%s", param.Key, param.Value))
			}
		}
		if len(queryParts) > 0 {
			finalURL = finalURL + separator + strings.Join(queryParts, "&")
		}
	}

	// Create the actual HTTP request
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	req, err := http.NewRequest(payload.Method, finalURL, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create request: %v", err), http.StatusBadRequest)
		return
	}

	// Add headers
	for key, value := range payload.Headers {
		req.Header.Set(key, value)
	}

	// Add cookies from cookie jar
	if cookieJar != nil {
		cookieHeader := cookieJar.GetCookieHeader(finalURL)
		if cookieHeader != "" {
			req.Header.Set("Cookie", cookieHeader)
		}
	}

	// Apply authentication
	switch payload.Auth.Type {
	case "basic":
		if payload.Auth.Basic != nil {
			req.SetBasicAuth(payload.Auth.Basic.Username, payload.Auth.Basic.Password)
		}
	case "bearer":
		if payload.Auth.Bearer != nil {
			req.Header.Set("Authorization", "Bearer "+payload.Auth.Bearer.Token)
		}
	case "api-key":
		if payload.Auth.APIKey != nil {
			if payload.Auth.APIKey.In == "header" {
				req.Header.Set(payload.Auth.APIKey.Key, payload.Auth.APIKey.Value)
			} else if payload.Auth.APIKey.In == "query" {
				// Add to query params
				separator := "?"
				if strings.Contains(finalURL, "?") {
					separator = "&"
				}
				finalURL = finalURL + separator + payload.Auth.APIKey.Key + "=" + payload.Auth.APIKey.Value
				// Update request URL
				req.URL, _ = req.URL.Parse(finalURL)
			}
		}
	}

	// Add body based on type
	if payload.BodyType == "form-data" && len(payload.FormData) > 0 {
		// Build multipart form data body with proper binary handling
		var bodyBuffer bytes.Buffer
		writer := multipart.NewWriter(&bodyBuffer)
		
		for _, field := range payload.FormData {
			if !field.Enabled {
				continue
			}
			
			if field.Type == "file" && field.FileName != "" {
				// Create form file part
				part, err := writer.CreateFormFile(field.Key, field.FileName)
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to create form file: %v", err), http.StatusInternalServerError)
					return
				}
				// Decode base64 content and write
				fileData, err := base64.StdEncoding.DecodeString(field.FileContent)
				if err != nil {
					// If not valid base64, write as-is (might be raw text)
					fileData = []byte(field.FileContent)
				}
				part.Write(fileData)
			} else {
				// Regular text field
				writer.WriteField(field.Key, field.Value)
			}
		}
		writer.Close()
		
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Body = io.NopCloser(&bodyBuffer)
		req.ContentLength = int64(bodyBuffer.Len())
	} else if payload.BodyType == "binary" && payload.Body != "" {
		// Handle binary file upload - body is base64 encoded
		fileData, err := base64.StdEncoding.DecodeString(payload.Body)
		if err != nil {
			// If not valid base64, use as raw bytes
			fileData = []byte(payload.Body)
		}
		req.Body = io.NopCloser(bytes.NewReader(fileData))
		req.ContentLength = int64(len(fileData))
		if payload.FileName != "" {
			req.Header.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", payload.FileName))
		}
	} else if payload.Body != "" {
		req.Body = io.NopCloser(strings.NewReader(payload.Body))
		req.ContentLength = int64(len(payload.Body))
	}

	// Execute the request
	resp, err := client.Do(req)
	endTime := time.Now()
	duration := endTime.Sub(startTime)

	if err != nil {
		// Return error response
		errorResp := ResponsePayload{
			Status:     0,
			StatusText: fmt.Sprintf("Request failed: %v", err),
			Headers:    make(map[string]string),
			Body:       fmt.Sprintf("Error: %v", err),
			Size:       len(fmt.Sprintf("Error: %v", err)),
			Time:       duration.Milliseconds(),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK) // Still return 200 since this is an API wrapper
		json.NewEncoder(w).Encode(map[string]interface{}{
			"data":    errorResp,
			"success": false,
			"message": "Request failed",
		})
		return
	}
	defer resp.Body.Close()

	// Read response body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read response: %v", err), http.StatusInternalServerError)
		return
	}

	// Convert headers to map
	headers := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}

	// Parse and store Set-Cookie headers
	if cookieJar != nil {
		if setCookies, ok := resp.Header["Set-Cookie"]; ok {
			for _, setCookie := range setCookies {
				cookie := cookieJar.ParseSetCookie(setCookie, req.Host)
				cookieJar.SetCookie(cookie)
			}
		}
	}

	// Try to parse as JSON, fallback to string
	var responseBody interface{}
	if err := json.Unmarshal(bodyBytes, &responseBody); err != nil {
		responseBody = string(bodyBytes)
	}

	responsePayload := ResponsePayload{
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    headers,
		Body:       responseBody,
		Size:       len(bodyBytes),
		Time:       duration.Milliseconds(),
	}

	data := map[string]interface{}{
		"status":     responsePayload.Status,
		"statusText": responsePayload.StatusText,
		"headers":    responsePayload.Headers,
		"body":       responsePayload.Body,
		"size":       responsePayload.Size,
		"time":       responsePayload.Time,
	}
	if preScriptResult != nil {
		data["preScriptResult"] = preScriptResult
	}

	responseScriptErr := ""
	if payload.Scripts != nil && strings.TrimSpace(payload.Scripts.PostResponse) != "" {
		// Start with the client's env vars, then layer in any vars the pre-script set,
		// so pm.environment.get() sees both in the post-response script.
		postVars := make(map[string]string, len(payload.EnvironmentVariables))
		for k, v := range payload.EnvironmentVariables {
			postVars[k] = v
		}
		if preScriptResult != nil {
			for k, v := range preScriptResult.Variables {
				postVars[k] = v
			}
		}
		postScriptResult, execErr := scripting.ExecutePostResponseScript(
			payload.Scripts.PostResponse,
			payload.Scripts.Language,
			&scripting.RequestState{
				Method:  payload.Method,
				URL:     payload.URL,
				Headers: payload.Headers,
				Body:    payload.Body,
			},
			&scripting.ResponseState{
				Status:  responsePayload.Status,
				Headers: responsePayload.Headers,
				Body:    string(bodyBytes),
			},
			postVars,
		)
		if postScriptResult != nil {
			data["scriptResult"] = postScriptResult
		}
		if execErr != nil {
			responseScriptErr = execErr.Error()
			data["scriptError"] = execErr.Error()
		}
	}

	// Save to history if repository is configured
	if historyRepo != nil {
		historyEntry := &repository.HistoryEntry{
			Method:      payload.Method,
			URL:         payload.URL,
			Status:      resp.StatusCode,
			StatusText:  resp.Status,
			Duration:    duration.Milliseconds(),
			Size:        len(bodyBytes),
			Headers:     headers,
			Body:        string(bodyBytes),
			RequestBody: payload.Body,
		}
		historyRepo.SaveEntry(historyEntry)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	success := responseScriptErr == ""
	message := "Request completed successfully"
	if !success {
		message = "Request completed with script error"
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    data,
		"success": success,
		"message": message,
	})
}

func GetCollectionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Placeholder response - will implement actual collection logic later
	collections := []map[string]interface{}{
		{
			"id":   "1",
			"name": "Sample Collection",
			"path": "/collections/sample",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    collections,
		"success": true,
		"message": "Collections retrieved successfully",
	})
}

func CreateCollectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Placeholder response - will implement actual collection creation later
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": map[string]interface{}{
			"id":   "new-collection-id",
			"name": payload["name"],
			"path": fmt.Sprintf("/collections/%v", payload["name"]),
		},
		"success": true,
		"message": "Collection created successfully",
	})
}

func GetEnvironmentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Placeholder response - will implement actual environment logic later
	environments := []map[string]interface{}{
		{
			"id":   "1",
			"name": "Development",
			"variables": []map[string]interface{}{
				{"key": "baseUrl", "value": "http://localhost:3000", "enabled": true},
				{"key": "apiKey", "value": "dev-key-123", "enabled": true},
			},
		},
		{
			"id":   "2",
			"name": "Production",
			"variables": []map[string]interface{}{
				{"key": "baseUrl", "value": "https://api.production.com", "enabled": true},
				{"key": "apiKey", "value": "prod-key-456", "enabled": true},
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    environments,
		"success": true,
		"message": "Environments retrieved successfully",
	})
}
