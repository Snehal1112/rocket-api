package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/yourusername/rocket-api/internal/infrastructure/repository"
)

// CookieHandler handles cookie-related HTTP requests
type CookieHandler struct {
	jar *repository.CookieJar
}

// NewCookieHandler creates a new cookie handler
func NewCookieHandler(jar *repository.CookieJar) *CookieHandler {
	return &CookieHandler{jar: jar}
}

// ListCookies handles GET /api/v1/cookies
func (h *CookieHandler) ListCookies(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get domain filter from query params
	domain := r.URL.Query().Get("domain")

	cookies, err := h.jar.GetAllCookies()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Filter by domain if specified
	var filtered []*repository.Cookie
	if domain != "" {
		for _, c := range cookies {
			if c.Domain == domain {
				filtered = append(filtered, c)
			}
		}
	} else {
		filtered = cookies
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    filtered,
		"success": true,
		"message": "Cookies retrieved successfully",
	})
}

// GetCookie handles GET /api/v1/cookies/{id}
func (h *CookieHandler) GetCookie(w http.ResponseWriter, r *http.Request) {
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

	cookie, err := h.jar.GetCookieByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    cookie,
		"success": true,
		"message": "Cookie retrieved successfully",
	})
}

// CreateCookie handles POST /api/v1/cookies
func (h *CookieHandler) CreateCookie(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var cookie repository.Cookie
	if err := json.NewDecoder(r.Body).Decode(&cookie); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if cookie.Name == "" || cookie.Domain == "" {
		http.Error(w, "Cookie name and domain are required", http.StatusBadRequest)
		return
	}

	if cookie.Path == "" {
		cookie.Path = "/"
	}

	h.jar.SetCookie(&cookie)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    cookie,
		"success": true,
		"message": "Cookie created successfully",
	})
}

// DeleteCookie handles DELETE /api/v1/cookies/{id}
func (h *CookieHandler) DeleteCookie(w http.ResponseWriter, r *http.Request) {
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

	if err := h.jar.DeleteCookieByID(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Cookie deleted successfully",
	})
}

// ClearCookies handles DELETE /api/v1/cookies
func (h *CookieHandler) ClearCookies(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "DELETE" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := h.jar.ClearAll(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "All cookies cleared",
	})
}

// GetDomains handles GET /api/v1/cookies/domains
func (h *CookieHandler) GetDomains(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	domains := h.jar.GetAllDomains()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    domains,
		"success": true,
		"message": "Domains retrieved successfully",
	})
}

// ClearExpired handles POST /api/v1/cookies/clear-expired
func (h *CookieHandler) ClearExpired(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	count := h.jar.ClearExpired()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    count,
		"success": true,
		"message": "Expired cookies cleared",
	})
}
