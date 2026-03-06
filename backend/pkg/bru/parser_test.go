package bru

import (
	"strings"
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
		{Key: "Accept", Value: "application/json", Enabled: true},
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

func TestParseContentWithMultilineJSONBody(t *testing.T) {
	original := &BruFile{}
	original.Meta.Name = "Create User"
	original.Meta.Type = "http"
	original.HTTP.Method = "POST"
	original.HTTP.URL = "https://api.example.com/users"
	original.Body.Type = "json"
	original.Body.Data = "{\n  \"name\": \"Alice\",\n  \"roles\": [\"admin\"]\n}"

	content := GenerateContent(original)
	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
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

func TestParseContentBrunoMethodBlocks(t *testing.T) {
	content := `meta {
  name: Show Display Profile
  type: http
  seq: 2
}

get {
  url: {{BASE_URL}}/api/v3/accounts/profile
  body: none
  auth: bearer
}

params:query {
  page: 1
}

headers {
  X-Group-Key: {{GroupKey}}
}

auth:bearer {
  token: {{BearerToken}}
}
`

	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.HTTP.Method != "GET" {
		t.Fatalf("http.method: got %q, want %q", parsed.HTTP.Method, "GET")
	}
	if parsed.HTTP.URL != "{{BASE_URL}}/api/v3/accounts/profile" {
		t.Fatalf("http.url: got %q", parsed.HTTP.URL)
	}
	if parsed.Body.Type != "none" {
		t.Fatalf("body.type: got %q, want %q", parsed.Body.Type, "none")
	}
	if len(parsed.HTTP.QueryParams) != 1 || parsed.HTTP.QueryParams[0].Key != "page" || parsed.HTTP.QueryParams[0].Value != "1" {
		t.Fatalf("http.queryParams: got %+v", parsed.HTTP.QueryParams)
	}
	if len(parsed.HTTP.Headers) != 1 || parsed.HTTP.Headers[0].Key != "X-Group-Key" {
		t.Fatalf("http.headers: got %+v", parsed.HTTP.Headers)
	}
	if parsed.HTTP.Auth == nil || parsed.HTTP.Auth.Type != "bearer" {
		t.Fatalf("http.auth: got %+v", parsed.HTTP.Auth)
	}
	if parsed.HTTP.Auth.Bearer == nil || parsed.HTTP.Auth.Bearer.Token != "{{BearerToken}}" {
		t.Fatalf("http.auth.bearer: got %+v", parsed.HTTP.Auth.Bearer)
	}
}

func TestParseContentBrunoInlineBodyBlock(t *testing.T) {
	content := `meta {
  name: Update Display Profile
  type: http
  seq: 1
}

patch {
  url: {{BASE_URL}}/api/v3/accounts/profile
  body: json
  auth: bearer
}

body:json {
  {
      "display_name": "Test Display Name 1",
      "use_erp_name": true
  }
}
`

	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.HTTP.Method != "PATCH" {
		t.Fatalf("http.method: got %q, want %q", parsed.HTTP.Method, "PATCH")
	}
	if parsed.Body.Type != "json" {
		t.Fatalf("body.type: got %q, want %q", parsed.Body.Type, "json")
	}
	if !strings.Contains(parsed.Body.Data, `"display_name": "Test Display Name 1"`) {
		t.Fatalf("body.data missing display_name, got:\n%s", parsed.Body.Data)
	}
	if !strings.Contains(parsed.Body.Data, `"use_erp_name": true`) {
		t.Fatalf("body.data missing use_erp_name, got:\n%s", parsed.Body.Data)
	}
}

func TestParseContentBrunoInlineBodyBlock_IsNotTruncated(t *testing.T) {
	content := "meta {\n" +
		"  name: Create\n" +
		"  type: http\n" +
		"  seq: 1\n" +
		"}\n\n" +
		"post {\n" +
		"  url: {{BASE_URL}}/api/v3/portal_user_locale\n" +
		"  body: json\n" +
		"  auth: bearer\n" +
		"}\n\n" +
		"headers {\n" +
		"  X-Group-Key: {{GroupKey}}\n" +
		"}\n\n" +
		"auth:bearer {\n" +
		"  token: {{BearerToken}}\n" +
		"}\n\n" +
		"body:json {\n" +
		"  {\r\n" +
		"      \"value\": \"en-US\"\r\n" +
		"  }\n" +
		"}\n"

	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.Body.Type != "json" {
		t.Fatalf("body.type: got %q, want %q", parsed.Body.Type, "json")
	}
	if !strings.Contains(parsed.Body.Data, `"value": "en-US"`) {
		t.Fatalf("body.data missing expected field, got:\n%s", parsed.Body.Data)
	}
	if !strings.HasSuffix(strings.TrimSpace(parsed.Body.Data), "}") {
		t.Fatalf("body.data appears truncated, got:\n%s", parsed.Body.Data)
	}
}

func TestParseContentBrunoInlineBodyBlock_PreservesJSONCContent(t *testing.T) {
	content := `meta {
  name: Update Display Profile
  type: http
  seq: 1
}

patch {
  url: {{BASE_URL}}/api/v3/accounts/profile
  body: json
  auth: bearer
}

body:json {
  {
      "display_name": "Test Display Name 1",
      "bank_details": {
          "country_code": "GB" //Required
          // "account_holder_name": "Test Account Holder Next" //Required
      }
  }
}
`

	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if !strings.Contains(parsed.Body.Data, `"country_code": "GB" //Required`) {
		t.Fatalf("body.data missing inline comment content, got:\n%s", parsed.Body.Data)
	}
	if !strings.Contains(parsed.Body.Data, `// "account_holder_name": "Test Account Holder Next" //Required`) {
		t.Fatalf("body.data missing commented JSONC field, got:\n%s", parsed.Body.Data)
	}
	if !strings.Contains(parsed.Body.Data, `"bank_details": {`) {
		t.Fatalf("body.data missing nested object, got:\n%s", parsed.Body.Data)
	}
}

func TestParseContentBrunoPathParamsBlock(t *testing.T) {
	content := `meta {
  name: Show Customer
  type: http
  seq: 1
}

get {
  url: {{BASE_URL}}/api/v1/customers/:customerId/invoices/:invoiceId
  body: none
}

params:path {
  customerId: 123
  invoiceId: inv_456
}
`

	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if len(parsed.HTTP.PathParams) != 2 {
		t.Fatalf("http.pathParams: got %+v", parsed.HTTP.PathParams)
	}
	if parsed.HTTP.PathParams[0].Key != "customerId" || parsed.HTTP.PathParams[0].Value != "123" || !parsed.HTTP.PathParams[0].Enabled {
		t.Fatalf("http.pathParams[0]: got %+v", parsed.HTTP.PathParams[0])
	}
	if parsed.HTTP.PathParams[1].Key != "invoiceId" || parsed.HTTP.PathParams[1].Value != "inv_456" || !parsed.HTTP.PathParams[1].Enabled {
		t.Fatalf("http.pathParams[1]: got %+v", parsed.HTTP.PathParams[1])
	}
}

func TestParseContentBrunoDisabledMarkers(t *testing.T) {
	content := `meta {
  name: Disabled Params
  type: http
  seq: 1
}

get {
  url: {{BASE_URL}}/api/v1/customers/:customerId
  body: none
}

headers {
  ~X-Group-Key: {{GroupKey}}
}

params:query {
  ~page: 1
}

params:path {
  ~customerId: 42
}
`

	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if len(parsed.HTTP.Headers) != 1 {
		t.Fatalf("http.headers: got %+v", parsed.HTTP.Headers)
	}
	if parsed.HTTP.Headers[0].Key != "X-Group-Key" || parsed.HTTP.Headers[0].Enabled {
		t.Fatalf("http.headers[0]: got %+v", parsed.HTTP.Headers[0])
	}

	if len(parsed.HTTP.QueryParams) != 1 {
		t.Fatalf("http.queryParams: got %+v", parsed.HTTP.QueryParams)
	}
	if parsed.HTTP.QueryParams[0].Key != "page" || parsed.HTTP.QueryParams[0].Enabled {
		t.Fatalf("http.queryParams[0]: got %+v", parsed.HTTP.QueryParams[0])
	}

	if len(parsed.HTTP.PathParams) != 1 {
		t.Fatalf("http.pathParams: got %+v", parsed.HTTP.PathParams)
	}
	if parsed.HTTP.PathParams[0].Key != "customerId" || parsed.HTTP.PathParams[0].Enabled {
		t.Fatalf("http.pathParams[0]: got %+v", parsed.HTTP.PathParams[0])
	}
}

func TestParseContentScriptsRoundtrip(t *testing.T) {
	original := &BruFile{}
	original.Meta.Name = "Scripted Request"
	original.Meta.Type = "http"
	original.Meta.Seq = 1
	original.HTTP.Method = "POST"
	original.HTTP.URL = "https://api.example.com/orders"
	original.Body.Type = "json"
	original.Body.Data = `{"name":"demo"}`
	original.Scripts = &Scripts{
		Language: "typescript",
		PreRequest: "pm.environment.set('token', 'abc')\npm.request.headers.add({ key: 'X-Trace-Id', value: '123' })",
		PostResponse: "pm.test('status is 200', () => {\n  if (pm.response.code !== 200) throw new Error('invalid status')\n})",
	}

	content := GenerateContent(original)
	parsed, err := ParseContent(content)
	if err != nil {
		t.Fatalf("ParseContent error: %v", err)
	}

	if parsed.Scripts == nil {
		t.Fatalf("scripts: expected non-nil scripts")
	}
	if parsed.Scripts.Language != "typescript" {
		t.Fatalf("scripts.language: got %q, want %q", parsed.Scripts.Language, "typescript")
	}
	if parsed.Scripts.PreRequest != original.Scripts.PreRequest {
		t.Fatalf("scripts.preRequest: got %q, want %q", parsed.Scripts.PreRequest, original.Scripts.PreRequest)
	}
	if parsed.Scripts.PostResponse != original.Scripts.PostResponse {
		t.Fatalf("scripts.postResponse: got %q, want %q", parsed.Scripts.PostResponse, original.Scripts.PostResponse)
	}
}
