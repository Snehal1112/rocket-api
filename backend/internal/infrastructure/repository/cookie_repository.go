package repository

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// Cookie represents an HTTP cookie
type Cookie struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Value      string    `json:"value"`
	Domain     string    `json:"domain"`
	Path       string    `json:"path"`
	Expires    time.Time `json:"expires"`
	Secure     bool      `json:"secure"`
	HttpOnly   bool      `json:"httpOnly"`
	SameSite   string    `json:"sameSite"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
	Collection string    `json:"collection,omitempty"` // Optional: associated collection
}

// CookieJar manages cookies for the application
type CookieJar struct {
	cookies map[string]*Cookie // key: domain+name
	mu      sync.RWMutex
	repo    *CookieRepository
}

// NewCookieJar creates a new cookie jar
func NewCookieJar(repo *CookieRepository) *CookieJar {
	return &CookieJar{
		cookies: make(map[string]*Cookie),
		repo:    repo,
	}
}

// Load loads cookies from repository
func (j *CookieJar) Load() error {
	cookies, err := j.repo.ListCookies()
	if err != nil {
		return err
	}

	j.mu.Lock()
	defer j.mu.Unlock()

	for _, cookie := range cookies {
		key := j.cookieKey(cookie.Domain, cookie.Path, cookie.Name)
		j.cookies[key] = cookie
	}

	return nil
}

// Save persists cookies to repository
func (j *CookieJar) Save() error {
	j.mu.RLock()
	cookies := make([]*Cookie, 0, len(j.cookies))
	for _, c := range j.cookies {
		cookies = append(cookies, c)
	}
	j.mu.RUnlock()

	return j.repo.SaveAllCookies(cookies)
}

// SetCookie adds or updates a cookie
func (j *CookieJar) SetCookie(cookie *Cookie) {
	j.mu.Lock()
	defer j.mu.Unlock()

	if cookie.ID == "" {
		cookie.ID = fmt.Sprintf("cookie_%d", time.Now().UnixNano())
	}
	if cookie.CreatedAt.IsZero() {
		cookie.CreatedAt = time.Now()
	}
	cookie.UpdatedAt = time.Now()

	key := j.cookieKey(cookie.Domain, cookie.Path, cookie.Name)
	j.cookies[key] = cookie

	// Persist asynchronously
	go j.repo.SaveCookie(cookie)
}

// GetCookie retrieves a specific cookie
func (j *CookieJar) GetCookie(domain, path, name string) (*Cookie, bool) {
	j.mu.RLock()
	defer j.mu.RUnlock()

	key := j.cookieKey(domain, path, name)
	cookie, exists := j.cookies[key]
	if !exists {
		return nil, false
	}

	// Check if expired
	if !cookie.Expires.IsZero() && cookie.Expires.Before(time.Now()) {
		return nil, false
	}

	return cookie, true
}

// GetCookiesForURL returns all cookies applicable to a URL
func (j *CookieJar) GetCookiesForURL(urlStr string) []*Cookie {
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return nil
	}

	domain := parsedURL.Hostname()
	path := parsedURL.Path
	if path == "" {
		path = "/"
	}
	isSecure := parsedURL.Scheme == "https"

	j.mu.RLock()
	defer j.mu.RUnlock()

	var result []*Cookie
	now := time.Now()

	for _, cookie := range j.cookies {
		// Check domain match
		if !j.domainMatches(cookie.Domain, domain) {
			continue
		}

		// Check path match
		if !strings.HasPrefix(path, cookie.Path) {
			continue
		}

		// Check secure flag
		if cookie.Secure && !isSecure {
			continue
		}

		// Check expiration
		if !cookie.Expires.IsZero() && cookie.Expires.Before(now) {
			continue
		}

		result = append(result, cookie)
	}

	// Sort by path length (more specific first)
	sort.Slice(result, func(i, j int) bool {
		return len(result[i].Path) > len(result[j].Path)
	})

	return result
}

// GetCookieHeader returns the Cookie header value for a URL
func (j *CookieJar) GetCookieHeader(urlStr string) string {
	cookies := j.GetCookiesForURL(urlStr)
	if len(cookies) == 0 {
		return ""
	}

	var parts []string
	for _, c := range cookies {
		parts = append(parts, fmt.Sprintf("%s=%s", c.Name, c.Value))
	}

	return strings.Join(parts, "; ")
}

// DeleteCookie removes a cookie
func (j *CookieJar) DeleteCookie(domain, path, name string) error {
	j.mu.Lock()
	key := j.cookieKey(domain, path, name)
	cookie, exists := j.cookies[key]
	delete(j.cookies, key)
	j.mu.Unlock()

	if exists {
		return j.repo.DeleteCookie(cookie.ID)
	}
	return nil
}

// ClearExpired removes all expired cookies
func (j *CookieJar) ClearExpired() int {
	j.mu.Lock()
	defer j.mu.Unlock()

	now := time.Now()
	var expired []string

	for key, cookie := range j.cookies {
		if !cookie.Expires.IsZero() && cookie.Expires.Before(now) {
			expired = append(expired, cookie.ID)
			delete(j.cookies, key)
		}
	}

	// Delete from repository
	for _, id := range expired {
		go j.repo.DeleteCookie(id)
	}

	return len(expired)
}

// ClearAll removes all cookies
func (j *CookieJar) ClearAll() error {
	j.mu.Lock()
	j.cookies = make(map[string]*Cookie)
	j.mu.Unlock()

	return j.repo.ClearAll()
}

// GetAllCookies returns all cookies in the jar
func (j *CookieJar) GetAllCookies() ([]*Cookie, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()

	cookies := make([]*Cookie, 0, len(j.cookies))
	now := time.Now()

	for _, cookie := range j.cookies {
		// Skip expired cookies
		if !cookie.Expires.IsZero() && cookie.Expires.Before(now) {
			continue
		}
		cookies = append(cookies, cookie)
	}

	return cookies, nil
}

// GetCookieByID retrieves a cookie by its ID
func (j *CookieJar) GetCookieByID(id string) (*Cookie, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()

	for _, cookie := range j.cookies {
		if cookie.ID == id {
			return cookie, nil
		}
	}

	return nil, fmt.Errorf("cookie not found")
}

// DeleteCookieByID removes a cookie by ID
func (j *CookieJar) DeleteCookieByID(id string) error {
	j.mu.Lock()
	defer j.mu.Unlock()

	for key, cookie := range j.cookies {
		if cookie.ID == id {
			delete(j.cookies, key)
			return j.repo.DeleteCookie(id)
		}
	}

	return nil
}

// GetAllDomains returns all unique domains
func (j *CookieJar) GetAllDomains() []string {
	j.mu.RLock()
	defer j.mu.RUnlock()

	domainMap := make(map[string]bool)
	for _, cookie := range j.cookies {
		domainMap[cookie.Domain] = true
	}

	domains := make([]string, 0, len(domainMap))
	for domain := range domainMap {
		domains = append(domains, domain)
	}
	sort.Strings(domains)

	return domains
}

// ParseSetCookie parses a Set-Cookie header and creates a Cookie
func (j *CookieJar) ParseSetCookie(setCookie string, domain string) *Cookie {
	cookie := &Cookie{
		ID:        fmt.Sprintf("cookie_%d", time.Now().UnixNano()),
		Domain:    domain,
		Path:      "/",
		SameSite:  "Lax",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	parts := strings.Split(setCookie, ";")
	for i, part := range parts {
		part = strings.TrimSpace(part)
		if i == 0 {
			// First part is name=value
			eqIdx := strings.Index(part, "=")
			if eqIdx > 0 {
				cookie.Name = strings.TrimSpace(part[:eqIdx])
				cookie.Value = strings.TrimSpace(part[eqIdx+1:])
			}
			continue
		}

		// Parse attributes
		eqIdx := strings.Index(part, "=")
		var attr, val string
		if eqIdx >= 0 {
			attr = strings.ToLower(strings.TrimSpace(part[:eqIdx]))
			val = strings.TrimSpace(part[eqIdx+1:])
		} else {
			attr = strings.ToLower(part)
		}

		switch attr {
		case "domain":
			cookie.Domain = strings.TrimPrefix(val, ".")
		case "path":
			cookie.Path = val
		case "expires":
			if t, err := http.ParseTime(val); err == nil {
				cookie.Expires = t
			}
		case "max-age":
			if seconds, err := parseMaxAge(val); err == nil {
				cookie.Expires = time.Now().Add(time.Duration(seconds) * time.Second)
			}
		case "secure":
			cookie.Secure = true
		case "httponly":
			cookie.HttpOnly = true
		case "samesite":
			cookie.SameSite = strings.Title(strings.ToLower(val))
		}
	}

	return cookie
}

// cookieKey generates a unique key for a cookie
func (j *CookieJar) cookieKey(domain, path, name string) string {
	return fmt.Sprintf("%s|%s|%s", domain, path, name)
}

// domainMatches checks if a cookie domain matches a request domain
func (j *CookieJar) domainMatches(cookieDomain, requestDomain string) bool {
	// Exact match
	if strings.EqualFold(cookieDomain, requestDomain) {
		return true
	}

	// Check if cookie domain is a suffix of request domain
	if strings.HasSuffix(strings.ToLower(requestDomain), strings.ToLower("."+cookieDomain)) {
		return true
	}

	return false
}

// parseMaxAge parses Max-Age value
func parseMaxAge(val string) (int, error) {
	var seconds int
	_, err := fmt.Sscanf(val, "%d", &seconds)
	return seconds, err
}

// CookieRepository handles file system storage for cookies
type CookieRepository struct {
	basePath string
}

// NewCookieRepository creates a new cookie repository
func NewCookieRepository(basePath string) *CookieRepository {
	return &CookieRepository{basePath: basePath}
}

// EnsureBasePath creates the cookies directory if it doesn't exist
func (r *CookieRepository) EnsureBasePath() error {
	return os.MkdirAll(r.basePath, 0755)
}

// SaveCookie saves a single cookie to disk
func (r *CookieRepository) SaveCookie(cookie *Cookie) error {
	if err := r.EnsureBasePath(); err != nil {
		return err
	}

	filePath := filepath.Join(r.basePath, cookie.ID+".json")
	data, err := json.MarshalIndent(cookie, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal cookie: %w", err)
	}

	return os.WriteFile(filePath, data, 0644)
}

// SaveAllCookies saves all cookies to disk
func (r *CookieRepository) SaveAllCookies(cookies []*Cookie) error {
	if err := r.EnsureBasePath(); err != nil {
		return err
	}

	// Clear existing cookies
	entries, _ := os.ReadDir(r.basePath)
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			os.Remove(filepath.Join(r.basePath, entry.Name()))
		}
	}

	// Save all cookies
	for _, cookie := range cookies {
		if err := r.SaveCookie(cookie); err != nil {
			return err
		}
	}

	return nil
}

// GetCookie retrieves a cookie by ID
func (r *CookieRepository) GetCookie(id string) (*Cookie, error) {
	filePath := filepath.Join(r.basePath, id+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var cookie Cookie
	if err := json.Unmarshal(data, &cookie); err != nil {
		return nil, err
	}

	return &cookie, nil
}

// ListCookies returns all cookies
func (r *CookieRepository) ListCookies() ([]*Cookie, error) {
	entries, err := os.ReadDir(r.basePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []*Cookie{}, nil
		}
		return nil, err
	}

	var cookies []*Cookie
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		id := strings.TrimSuffix(entry.Name(), ".json")
		cookie, err := r.GetCookie(id)
		if err != nil {
			continue
		}
		cookies = append(cookies, cookie)
	}

	return cookies, nil
}

// DeleteCookie deletes a cookie by ID
func (r *CookieRepository) DeleteCookie(id string) error {
	filePath := filepath.Join(r.basePath, id+".json")
	return os.Remove(filePath)
}

// ClearAll removes all cookies
func (r *CookieRepository) ClearAll() error {
	entries, err := os.ReadDir(r.basePath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			os.Remove(filepath.Join(r.basePath, entry.Name()))
		}
	}

	return nil
}
