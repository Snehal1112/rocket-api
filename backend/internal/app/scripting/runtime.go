package scripting

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/dop251/goja"
)

const executionTimeout = 200 * time.Millisecond

// RequestState is the mutable request context exposed to scripts.
type RequestState struct {
	Method  string
	URL     string
	Headers map[string]string
	Body    string
}

// ResponseState is the response context exposed to post-response scripts.
type ResponseState struct {
	Status  int
	Headers map[string]string
	Body    string
}

// TestResult stores script assertion output.
type TestResult struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Error  string `json:"error,omitempty"`
}

// ExecutionResult stores script execution outputs.
type ExecutionResult struct {
	Tests     []TestResult       `json:"tests,omitempty"`
	Variables map[string]string  `json:"variables,omitempty"`
}

func ExecutePreRequestScript(script, language string, req *RequestState, variables map[string]string) (*ExecutionResult, error) {
	return executeScript(script, language, req, nil, variables)
}

func ExecutePostResponseScript(script, language string, req *RequestState, resp *ResponseState, variables map[string]string) (*ExecutionResult, error) {
	return executeScript(script, language, req, resp, variables)
}

func executeScript(script, language string, req *RequestState, resp *ResponseState, variables map[string]string) (*ExecutionResult, error) {
	if strings.TrimSpace(script) == "" {
		return &ExecutionResult{Variables: variables}, nil
	}
	if req == nil {
		return nil, fmt.Errorf("request context is required")
	}
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}
	if variables == nil {
		variables = map[string]string{}
	}

	compiled, err := transpileToJavaScript(script, language)
	if err != nil {
		return nil, err
	}

	vm := goja.New()
	result := &ExecutionResult{Variables: variables, Tests: []TestResult{}}

	getVar := func(name string) string {
		if v, ok := variables[name]; ok {
			return v
		}
		return ""
	}
	setVar := func(name, value string) {
		variables[name] = value
	}

	requestObject := vm.NewObject()
	requestObject.Set("method", req.Method)
	requestObject.Set("url", req.URL)
	requestObject.Set("body", req.Body)

	headersObject := vm.NewObject()
	for k, v := range req.Headers {
		headersObject.Set(k, v)
	}
	headersObject.Set("add", func(call goja.FunctionCall) goja.Value {
		obj := call.Argument(0).ToObject(vm)
		key := strings.TrimSpace(obj.Get("key").String())
		if key == "" {
			return goja.Undefined()
		}
		value := obj.Get("value").String()
		req.Headers[key] = value
		headersObject.Set(key, value)
		return goja.Undefined()
	})
	requestObject.Set("headers", headersObject)

	responseObject := vm.NewObject()
	if resp != nil {
		responseObject.Set("code", resp.Status)
		responseObject.Set("status", resp.Status)
		responseObject.Set("text", func(goja.FunctionCall) goja.Value {
			return vm.ToValue(resp.Body)
		})
	} else {
		responseObject.Set("code", 0)
		responseObject.Set("status", 0)
		responseObject.Set("text", func(goja.FunctionCall) goja.Value {
			return vm.ToValue("")
		})
	}

	envObject := vm.NewObject()
	envObject.Set("get", func(call goja.FunctionCall) goja.Value {
		return vm.ToValue(getVar(call.Argument(0).String()))
	})
	envObject.Set("set", func(call goja.FunctionCall) goja.Value {
		setVar(call.Argument(0).String(), call.Argument(1).String())
		return goja.Undefined()
	})

	varsObject := vm.NewObject()
	varsObject.Set("get", func(call goja.FunctionCall) goja.Value {
		return vm.ToValue(getVar(call.Argument(0).String()))
	})
	varsObject.Set("set", func(call goja.FunctionCall) goja.Value {
		setVar(call.Argument(0).String(), call.Argument(1).String())
		return goja.Undefined()
	})

	testFn := func(call goja.FunctionCall) goja.Value {
		name := call.Argument(0).String()
		fn, ok := goja.AssertFunction(call.Argument(1))
		if !ok {
			result.Tests = append(result.Tests, TestResult{Name: name, Passed: false, Error: "callback is required"})
			return goja.Undefined()
		}

		_, testErr := fn(goja.Undefined())
		if testErr != nil {
			result.Tests = append(result.Tests, TestResult{Name: name, Passed: false, Error: testErr.Error()})
			return goja.Undefined()
		}

		result.Tests = append(result.Tests, TestResult{Name: name, Passed: true})
		return goja.Undefined()
	}

	pmObject := vm.NewObject()
	pmObject.Set("environment", envObject)
	pmObject.Set("variables", varsObject)
	pmObject.Set("request", requestObject)
	pmObject.Set("response", responseObject)
	pmObject.Set("test", testFn)

	bruObject := vm.NewObject()
	bruObject.Set("getVar", func(call goja.FunctionCall) goja.Value {
		return vm.ToValue(getVar(call.Argument(0).String()))
	})
	bruObject.Set("setVar", func(call goja.FunctionCall) goja.Value {
		setVar(call.Argument(0).String(), call.Argument(1).String())
		return goja.Undefined()
	})
	bruObject.Set("req", requestObject)
	bruObject.Set("res", responseObject)
	bruObject.Set("test", testFn)

	if err := vm.Set("pm", pmObject); err != nil {
		return nil, fmt.Errorf("failed to initialize pm object: %w", err)
	}
	if err := vm.Set("bru", bruObject); err != nil {
		return nil, fmt.Errorf("failed to initialize bru object: %w", err)
	}

	timer := time.AfterFunc(executionTimeout, func() {
		vm.Interrupt("script execution timed out")
	})
	defer timer.Stop()

	if _, err := vm.RunString(compiled); err != nil {
		return result, fmt.Errorf("script execution failed: %w", err)
	}

	if value := requestObject.Get("url"); value != nil && !goja.IsUndefined(value) {
		req.URL = value.String()
	}
	if value := requestObject.Get("method"); value != nil && !goja.IsUndefined(value) {
		req.Method = value.String()
	}
	if value := requestObject.Get("body"); value != nil && !goja.IsUndefined(value) {
		req.Body = value.String()
	}

	return result, nil
}

func transpileToJavaScript(script, language string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(language))
	if normalized == "" || normalized == "javascript" {
		return script, nil
	}
	if normalized != "typescript" {
		return "", fmt.Errorf("unsupported script language: %s", language)
	}

	// Minimal TypeScript downleveling for request scripts.
	result := script
	interfaceBlock := regexp.MustCompile(`(?ms)interface\s+\w+\s*\{.*?\}`)
	result = interfaceBlock.ReplaceAllString(result, "")

	typeAnnotationWithAssign := regexp.MustCompile(`:\s*[A-Za-z_][A-Za-z0-9_\[\]<>|,\s]*\s*=`)
	result = typeAnnotationWithAssign.ReplaceAllString(result, " =")

	typeAnnotationWithParen := regexp.MustCompile(`:\s*[A-Za-z_][A-Za-z0-9_\[\]<>|,\s]*\s*\)`)
	result = typeAnnotationWithParen.ReplaceAllString(result, ")")

	typeAssertion := regexp.MustCompile(`\s+as\s+[A-Za-z_][A-Za-z0-9_\[\]<>|,\s]*`)
	result = typeAssertion.ReplaceAllString(result, "")

	return result, nil
}
