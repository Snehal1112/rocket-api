package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

type capturedRequest struct {
	Method  string
	URL     string
	Headers http.Header
	Body    string
}

func TestSendRequestHandler_PreScriptMutatesOutboundRequest(t *testing.T) {
	captured := make(chan capturedRequest, 1)
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		captured <- capturedRequest{
			Method:  r.Method,
			URL:     r.URL.String(),
			Headers: r.Header.Clone(),
			Body:    string(bodyBytes),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer target.Close()

	payload := map[string]any{
		"method":   "POST",
		"url":      target.URL + "/capture",
		"headers":  map[string]string{},
		"body":     `{"from":"request"}`,
		"bodyType": "json",
		"queryParams": []map[string]any{},
		"auth": map[string]any{
			"type": "none",
		},
		"scripts": map[string]any{
			"language": "javascript",
			"preRequest": `
pm.request.headers.add({ key: 'X-From-Script', value: 'yes' })
pm.request.url = pm.request.url + '?from=script'
pm.request.body = '{"from":"script"}'
`,
		},
	}

	resp := performSendRequest(t, payload)
	if !resp.Success {
		t.Fatalf("expected success response, got %+v", resp)
	}

	got := <-captured
	if got.Headers.Get("X-From-Script") != "yes" {
		t.Fatalf("missing script header, got %q", got.Headers.Get("X-From-Script"))
	}
	if got.Body != `{"from":"script"}` {
		t.Fatalf("unexpected body after pre script: %q", got.Body)
	}
	if got.URL != "/capture?from=script" {
		t.Fatalf("unexpected request URL: %q", got.URL)
	}
}

func TestSendRequestHandler_PostScriptAddsTestResults(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer target.Close()

	payload := map[string]any{
		"method":      "GET",
		"url":         target.URL,
		"headers":     map[string]string{},
		"body":        "",
		"queryParams": []map[string]any{},
		"auth": map[string]any{
			"type": "none",
		},
		"scripts": map[string]any{
			"language": "javascript",
			"postResponse": `
pm.test('status is 200', () => {
  if (pm.response.code !== 200) throw new Error('status mismatch')
})
`,
		},
	}

	resp := performSendRequest(t, payload)
	if !resp.Success {
		t.Fatalf("expected success response, got %+v", resp)
	}

	scriptResult, ok := resp.Data["scriptResult"].(map[string]any)
	if !ok {
		t.Fatalf("expected scriptResult in response data, got %+v", resp.Data)
	}
	tests, ok := scriptResult["tests"].([]any)
	if !ok || len(tests) != 1 {
		t.Fatalf("expected exactly one script test, got %+v", scriptResult)
	}
}

func TestSendRequestHandler_PreScriptErrorBlocksDispatch(t *testing.T) {
	hit := false
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = true
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	payload := map[string]any{
		"method":      "GET",
		"url":         target.URL,
		"headers":     map[string]string{},
		"body":        "",
		"queryParams": []map[string]any{},
		"auth": map[string]any{
			"type": "none",
		},
		"scripts": map[string]any{
			"language":   "javascript",
			"preRequest": `throw new Error('pre failed')`,
		},
	}

	resp := performSendRequest(t, payload)
	if resp.Success {
		t.Fatalf("expected failed response when pre script errors")
	}
	if hit {
		t.Fatalf("target server should not be called when pre script fails")
	}
}

func TestSendRequestHandler_PostScriptErrorKeepsResponse(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer target.Close()

	payload := map[string]any{
		"method":      "GET",
		"url":         target.URL,
		"headers":     map[string]string{},
		"body":        "",
		"queryParams": []map[string]any{},
		"auth": map[string]any{
			"type": "none",
		},
		"scripts": map[string]any{
			"language":     "javascript",
			"postResponse": `throw new Error('post failed')`,
		},
	}

	resp := performSendRequest(t, payload)
	if resp.Success {
		t.Fatalf("expected response success=false when post script fails")
	}
	if status, _ := resp.Data["status"].(float64); int(status) != http.StatusCreated {
		t.Fatalf("expected upstream status preserved, got %+v", resp.Data["status"])
	}
	if _, ok := resp.Data["scriptError"].(string); !ok {
		t.Fatalf("expected scriptError string in response data, got %+v", resp.Data)
	}
}

type sendResponse struct {
	Data    map[string]any `json:"data"`
	Success bool           `json:"success"`
	Message string         `json:"message"`
}

func performSendRequest(t *testing.T, payload map[string]any) sendResponse {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/requests/send", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	SendRequestHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d, body=%s", rec.Code, rec.Body.String())
	}

	var resp sendResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, rec.Body.String())
	}
	return resp
}
