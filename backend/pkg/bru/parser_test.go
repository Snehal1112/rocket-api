package bru

import (
	"testing"
)

// TestParseContentRoundtrip verifies that a BruFile survives a write→parse roundtrip.
func TestParseContentRoundtrip(t *testing.T) {
	original := &BruFile{}
	original.Meta.Name = "Get Users"
	original.Meta.Type = "http"
	original.Meta.Seq = 1
	original.HTTP.Method = "GET"
	original.HTTP.URL = "https://api.example.com/users"
	original.HTTP.Headers = []Header{
		{Key: "Accept", Value: "application/json"},
	}
	original.HTTP.QueryParams = []QueryParam{
		{Key: "page", Value: "1", Enabled: true},
	}
	original.Body.Type = "none"

	content := GenerateContent(original)
	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.Meta.Name != original.Meta.Name {
		t.Errorf("meta.name: got %q, want %q", parsed.Meta.Name, original.Meta.Name)
	}
	if parsed.HTTP.Method != original.HTTP.Method {
		t.Errorf("http.method: got %q, want %q", parsed.HTTP.Method, original.HTTP.Method)
	}
	if parsed.HTTP.URL != original.HTTP.URL {
		t.Errorf("http.url: got %q, want %q", parsed.HTTP.URL, original.HTTP.URL)
	}
	if len(parsed.HTTP.Headers) != 1 || parsed.HTTP.Headers[0].Key != "Accept" {
		t.Errorf("http.headers: got %+v", parsed.HTTP.Headers)
	}
	if len(parsed.HTTP.QueryParams) != 1 || parsed.HTTP.QueryParams[0].Key != "page" {
		t.Errorf("http.queryParams: got %+v", parsed.HTTP.QueryParams)
	}
}

// TestParseContentWithBody verifies body data survives the roundtrip.
func TestParseContentWithBody(t *testing.T) {
	original := &BruFile{}
	original.Meta.Name = "Create User"
	original.Meta.Type = "http"
	original.HTTP.Method = "POST"
	original.HTTP.URL = "https://api.example.com/users"
	original.Body.Type = "json"
	original.Body.Data = `{"name":"Alice"}`

	content := GenerateContent(original)
	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.Body.Type != "json" {
		t.Errorf("body.type: got %q, want %q", parsed.Body.Type, "json")
	}
	if parsed.Body.Data != original.Body.Data {
		t.Errorf("body.data: got %q, want %q", parsed.Body.Data, original.Body.Data)
	}
}

// TestParseContentBearerAuth verifies bearer auth survives the roundtrip.
func TestParseContentBearerAuth(t *testing.T) {
	original := &BruFile{}
	original.Meta.Name = "Secure Request"
	original.Meta.Type = "http"
	original.HTTP.Method = "GET"
	original.HTTP.URL = "https://api.example.com/secure"
	original.HTTP.Auth = &AuthConfig{
		Type: "bearer",
		Bearer: &struct {
			Token string `json:"token"`
		}{Token: "my-secret-token"},
	}
	original.Body.Type = "none"

	content := GenerateContent(original)
	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.HTTP.Auth == nil {
		t.Fatal("http.auth is nil")
	}
	if parsed.HTTP.Auth.Type != "bearer" {
		t.Errorf("auth.type: got %q, want %q", parsed.HTTP.Auth.Type, "bearer")
	}
	if parsed.HTTP.Auth.Bearer == nil || parsed.HTTP.Auth.Bearer.Token != "my-secret-token" {
		t.Errorf("auth.bearer.token: got %+v", parsed.HTTP.Auth.Bearer)
	}
}
