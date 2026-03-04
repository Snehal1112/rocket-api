package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"
	"github.com/yourusername/rocket-api/internal/infrastructure/repository"
	"github.com/yourusername/rocket-api/internal/infrastructure/storage"
	ws "github.com/yourusername/rocket-api/internal/infrastructure/websocket"
	"github.com/yourusername/rocket-api/internal/interfaces/handlers"
)

// corsMiddleware handles CORS for all requests
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// Handle preflight OPTIONS request
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	// Setup collections directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	collectionsPath := filepath.Join(homeDir, ".rocket-api", "collections")
	historyPath := filepath.Join(homeDir, ".rocket-api", "history")
	templatesPath := filepath.Join(homeDir, ".rocket-api", "templates")
	cookiesPath := filepath.Join(homeDir, ".rocket-api", "cookies")

	// Create repositories
	repo := repository.NewCollectionRepository(collectionsPath)
	if err := repo.EnsureBasePath(); err != nil {
		log.Fatalf("Failed to create collections directory: %v", err)
	}

	historyRepo := repository.NewHistoryRepository(historyPath)
	if err := historyRepo.EnsureBasePath(); err != nil {
		log.Fatalf("Failed to create history directory: %v", err)
	}

	templatesRepo := repository.NewTemplatesRepository(templatesPath)
	if err := templatesRepo.EnsureBasePath(); err != nil {
		log.Fatalf("Failed to create templates directory: %v", err)
	}
	// Create default templates
	if err := templatesRepo.CreateDefaultTemplates(); err != nil {
		log.Printf("Warning: Failed to create default templates: %v", err)
	}

	// Setup cookie jar
	cookieRepo := repository.NewCookieRepository(cookiesPath)
	if err := cookieRepo.EnsureBasePath(); err != nil {
		log.Fatalf("Failed to create cookies directory: %v", err)
	}
	cookieJar := repository.NewCookieJar(cookieRepo)
	if err := cookieJar.Load(); err != nil {
		log.Printf("Warning: Failed to load cookies: %v", err)
	}

	// Setup file watcher
	watcher, err := storage.NewFileWatcher(collectionsPath)
	if err != nil {
		log.Fatalf("Failed to create file watcher: %v", err)
	}

	if err := watcher.Start(); err != nil {
		log.Fatalf("Failed to start file watcher: %v", err)
	}
	defer watcher.Stop()

	// Setup WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Register file watcher handler to broadcast changes
	watcher.RegisterHandler("*", func(event storage.FileChangeEvent) {
		hub.Broadcast("file_change", event.Collection, map[string]interface{}{
			"type":         event.Type,
			"path":         event.Path,
			"relativePath": event.RelativePath,
		})
	})

	// Create handlers
	collectionHandler := handlers.NewCollectionHandler(repo)
	importExportHandler := handlers.NewImportExportHandler(repo)
	historyHandler := handlers.NewHistoryHandler(historyRepo)
	templatesHandler := handlers.NewTemplatesHandler(templatesRepo)
	cookieHandler := handlers.NewCookieHandler(cookieJar)

	// Set history repository for request tracking
	handlers.SetHistoryRepository(historyRepo)
	// Set cookie jar for request handling
	handlers.SetCookieJar(cookieJar)

	// Create router
	r := mux.NewRouter()

	// Health check endpoint
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","message":"Rocket API is running"}`))
	}).Methods("GET", "OPTIONS")

	// API v1 routes
	api := r.PathPrefix("/api/v1").Subrouter()

	// Collection routes
	api.HandleFunc("/collections", collectionHandler.ListCollections).Methods("GET", "OPTIONS")
	api.HandleFunc("/collections", collectionHandler.CreateCollection).Methods("POST", "OPTIONS")
	api.HandleFunc("/collections/{name}", collectionHandler.GetCollection).Methods("GET", "OPTIONS")
	api.HandleFunc("/collections/{name}", collectionHandler.DeleteCollection).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/collections/{name}/folders", collectionHandler.CreateFolder).Methods("POST", "OPTIONS")
	api.HandleFunc("/collections/{name}/requests/new", collectionHandler.CreateRequest).Methods("POST", "OPTIONS")

	// Request routes
	api.HandleFunc("/requests", collectionHandler.GetRequest).Methods("GET", "OPTIONS")
	api.HandleFunc("/requests", collectionHandler.SaveRequest).Methods("POST", "OPTIONS")
	api.HandleFunc("/requests", collectionHandler.DeleteRequest).Methods("DELETE", "OPTIONS")

	// Environment routes
	api.HandleFunc("/environments", collectionHandler.ListEnvironments).Methods("GET", "OPTIONS")
	api.HandleFunc("/environments", collectionHandler.SaveEnvironment).Methods("POST", "OPTIONS")
	api.HandleFunc("/environments", collectionHandler.DeleteEnvironment).Methods("DELETE", "OPTIONS")

	// Collection variable routes
	api.HandleFunc("/collections/{name}/variables", collectionHandler.GetCollectionVars).Methods("GET", "OPTIONS")
	api.HandleFunc("/collections/{name}/variables", collectionHandler.SaveCollectionVars).Methods("POST", "OPTIONS")

	// Import/Export routes
	api.HandleFunc("/import/bruno", importExportHandler.ImportBruno).Methods("POST", "OPTIONS")
	api.HandleFunc("/export/bruno", importExportHandler.ExportBruno).Methods("GET", "OPTIONS")
	api.HandleFunc("/import/postman", importExportHandler.ImportPostman).Methods("POST", "OPTIONS")
	api.HandleFunc("/export/postman", importExportHandler.ExportPostman).Methods("GET", "OPTIONS")

	// History routes
	api.HandleFunc("/history", historyHandler.ListHistory).Methods("GET", "OPTIONS")
	api.HandleFunc("/history", historyHandler.ClearHistory).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/history/detail", historyHandler.GetHistory).Methods("GET", "OPTIONS")
	api.HandleFunc("/history/detail", historyHandler.DeleteHistory).Methods("DELETE", "OPTIONS")

	// Templates routes
	api.HandleFunc("/templates", templatesHandler.ListTemplates).Methods("GET", "OPTIONS")
	api.HandleFunc("/templates", templatesHandler.CreateTemplate).Methods("POST", "OPTIONS")
	api.HandleFunc("/templates/detail", templatesHandler.GetTemplate).Methods("GET", "OPTIONS")
	api.HandleFunc("/templates/detail", templatesHandler.UpdateTemplate).Methods("PUT", "OPTIONS")
	api.HandleFunc("/templates/detail", templatesHandler.DeleteTemplate).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/templates/categories", templatesHandler.GetCategories).Methods("GET", "OPTIONS")

	// Cookie routes
	api.HandleFunc("/cookies", cookieHandler.ListCookies).Methods("GET", "OPTIONS")
	api.HandleFunc("/cookies", cookieHandler.CreateCookie).Methods("POST", "OPTIONS")
	api.HandleFunc("/cookies", cookieHandler.ClearCookies).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/cookies/detail", cookieHandler.GetCookie).Methods("GET", "OPTIONS")
	api.HandleFunc("/cookies/detail", cookieHandler.DeleteCookie).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/cookies/domains", cookieHandler.GetDomains).Methods("GET", "OPTIONS")
	api.HandleFunc("/cookies/clear-expired", cookieHandler.ClearExpired).Methods("POST", "OPTIONS")

	// Legacy request handler (for sending HTTP requests)
	api.HandleFunc("/requests/send", handlers.SendRequestHandler).Methods("POST", "OPTIONS")

	// WebSocket endpoint
	r.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(hub, w, r)
	})

	// Apply CORS middleware
	corsHandler := corsMiddleware(r)

	port := ":8080"
	log.Printf("🚀 Rocket API Server starting on port %s", port)
	log.Printf("📊 Health check: http://localhost%s/health", port)
	log.Printf("📁 Collections: %s", collectionsPath)
	log.Printf("🔗 API endpoint: http://localhost%s/api/v1", port)
	log.Printf("🔌 WebSocket: ws://localhost%s/ws", port)

	log.Fatal(http.ListenAndServe(port, corsHandler))
}
