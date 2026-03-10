package scripting

import "testing"

func TestExecutePreRequestScript_UpdatesVariablesAndHeaders(t *testing.T) {
	req := &RequestState{
		Method:  "GET",
		URL:     "https://api.example.com/items",
		Headers: map[string]string{},
	}
	vars := map[string]string{}

	script := `
const token: string = 'abc123'
pm.environment.set('token', token)
pm.request.headers.add({ key: 'X-Token', value: token })
bru.setVar('traceId', 't-1')
`

	result, err := ExecutePreRequestScript(script, "typescript", req, vars)
	if err != nil {
		t.Fatalf("ExecutePreRequestScript error: %v", err)
	}

	if vars["token"] != "abc123" {
		t.Fatalf("vars[token]: got %q", vars["token"])
	}
	if vars["traceId"] != "t-1" {
		t.Fatalf("vars[traceId]: got %q", vars["traceId"])
	}
	if req.Headers["X-Token"] != "abc123" {
		t.Fatalf("request header X-Token: got %q", req.Headers["X-Token"])
	}
	if result == nil {
		t.Fatalf("result: expected non-nil")
	}
}

func TestExecutePostResponseScript_RecordsTests(t *testing.T) {
	req := &RequestState{
		Method:  "GET",
		URL:     "https://api.example.com/items",
		Headers: map[string]string{},
	}
	resp := &ResponseState{
		Status: 200,
		Body:   `{"ok":true}`,
	}
	vars := map[string]string{}

	script := `
pm.test('status is 200', () => {
  if (pm.response.code !== 200) throw new Error('expected 200')
})
bru.test('body contains ok', () => {
  if (!bru.res.text().includes('ok')) throw new Error('missing ok')
})
`

	result, err := ExecutePostResponseScript(script, "javascript", req, resp, vars)
	if err != nil {
		t.Fatalf("ExecutePostResponseScript error: %v", err)
	}
	if len(result.Tests) != 2 {
		t.Fatalf("tests: got %d, want 2", len(result.Tests))
	}
	if !result.Tests[0].Passed || !result.Tests[1].Passed {
		t.Fatalf("expected all tests to pass, got %+v", result.Tests)
	}
}

func TestExecuteScript_CapturesConsoleLogs(t *testing.T) {
	req := &RequestState{
		Method:  "GET",
		URL:     "https://api.example.com",
		Headers: map[string]string{},
	}
	script := `
console.log('hello', 'world')
console.log(42)
`
	result, err := ExecutePreRequestScript(script, "javascript", req, map[string]string{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.ConsoleLogs) != 2 {
		t.Fatalf("ConsoleLogs: want 2 entries, got %d: %v", len(result.ConsoleLogs), result.ConsoleLogs)
	}
	if result.ConsoleLogs[0] != "hello world" {
		t.Errorf("ConsoleLogs[0]: want %q, got %q", "hello world", result.ConsoleLogs[0])
	}
	if result.ConsoleLogs[1] != "42" {
		t.Errorf("ConsoleLogs[1]: want %q, got %q", "42", result.ConsoleLogs[1])
	}
}

func TestExecuteScript_Timeout(t *testing.T) {
	req := &RequestState{Method: "GET", URL: "https://api.example.com", Headers: map[string]string{}}
	vars := map[string]string{}

	_, err := ExecutePreRequestScript("while (true) {}", "javascript", req, vars)
	if err == nil {
		t.Fatalf("expected timeout error")
	}
}

func TestExecuteScript_SandboxDisallowsRequire(t *testing.T) {
	req := &RequestState{Method: "GET", URL: "https://api.example.com", Headers: map[string]string{}}
	vars := map[string]string{}

	script := `
if (typeof require !== 'undefined') {
  throw new Error('require should not exist')
}
`
	_, err := ExecutePreRequestScript(script, "javascript", req, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
