package bru

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
)

// Header represents an HTTP header key-value pair
type Header struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	Enabled bool `json:"enabled"`
}

// QueryParam represents a URL query parameter
type QueryParam struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	Type  string `json:"type"` // "none", "basic", "bearer", "api-key"
	Basic *struct {
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

// Scripts represents request-level script configuration.
type Scripts struct {
	Language     string `json:"language,omitempty"`
	PreRequest   string `json:"preRequest,omitempty"`
	PostResponse string `json:"postResponse,omitempty"`
}

// BruFile represents the structure of a .bru file
type BruFile struct {
	Meta struct {
		Name string `json:"name"`
		Type string `json:"type"`
		Seq  int    `json:"seq"`
	} `json:"meta"`
	HTTP struct {
		Method      string       `json:"method"`
		URL         string       `json:"url"`
		Headers     []Header     `json:"headers"`
		QueryParams []QueryParam `json:"queryParams,omitempty"`
		PathParams  []QueryParam `json:"pathParams,omitempty"`
		Body        string       `json:"body,omitempty"`
		Auth        *AuthConfig  `json:"auth,omitempty"`
	} `json:"http"`
	Body struct {
		Type string `json:"type"`
		Data string `json:"data,omitempty"`
	} `json:"body"`
	Scripts    *Scripts `json:"scripts,omitempty"`
	Vars       map[string]any `json:"vars,omitempty"`
	Assertions []string       `json:"assertions,omitempty"`
}

// Parse reads and parses a .bru file
func Parse(filepath string) (*BruFile, error) {
	content, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read .bru file: %w", err)
	}

	return ParseContent(string(content))
}

// ParseContent parses .bru file content from string.
// The format uses section { } blocks as produced by GenerateContent.
func ParseContent(content string) (*BruFile, error) {
	bru := &BruFile{
		HTTP: struct {
			Method      string       `json:"method"`
			URL         string       `json:"url"`
			Headers     []Header     `json:"headers"`
			QueryParams []QueryParam `json:"queryParams,omitempty"`
			PathParams  []QueryParam `json:"pathParams,omitempty"`
			Body        string       `json:"body,omitempty"`
			Auth        *AuthConfig  `json:"auth,omitempty"`
		}{
			Headers:     []Header{},
			QueryParams: []QueryParam{},
			PathParams:  []QueryParam{},
		},
		Vars:       make(map[string]any),
		Assertions: []string{},
	}

	scanner := bufio.NewScanner(strings.NewReader(content))
	// contextStack tracks nested block names, e.g. ["http", "headers"].
	var contextStack []string
	// dataLines accumulates indented lines inside a multiline { } block.
	var dataLines []string
	inDataBlock := false
	dataBlockIndent := 0
	dataBlockTarget := ""

	currentContext := func() string {
		if len(contextStack) == 0 {
			return ""
		}
		return contextStack[len(contextStack)-1]
	}

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		// Collect body data lines (preserve relative indentation by stripping 4-space prefix).
		if inDataBlock {
			if trimmed == "}" {
				leadingWhitespace := len(line) - len(strings.TrimLeft(line, " \t"))
				// Close body capture only when indentation matches the block opener.
				// This preserves inner JSON object closers at deeper indentation.
				if leadingWhitespace == dataBlockIndent {
					inDataBlock = false
					contextStack = contextStack[:len(contextStack)-1]
					captured := strings.TrimRight(strings.Join(dataLines, "\n"), "\n")
					switch dataBlockTarget {
					case "body":
						bru.Body.Data = captured
					case "scripts.pre-request":
						if bru.Scripts == nil {
							bru.Scripts = &Scripts{}
						}
						bru.Scripts.PreRequest = captured
					case "scripts.post-response":
						if bru.Scripts == nil {
							bru.Scripts = &Scripts{}
						}
						bru.Scripts.PostResponse = captured
					}
					dataLines = nil
					dataBlockIndent = 0
					dataBlockTarget = ""
					continue
				}
			}
			stripped := line
			if dataBlockTarget == "body" {
				if strings.HasPrefix(line, "    ") {
					stripped = line[4:]
				} else if strings.HasPrefix(line, "  ") {
					// Bruno inline body blocks (`body:json {`) typically indent data by two spaces.
					stripped = line[2:]
				}
			} else if strings.HasPrefix(line, "  ") {
				// Script blocks are emitted with two-space indentation.
				stripped = line[2:]
			}
			dataLines = append(dataLines, stripped)
			continue
		}

		// Skip empty lines and comments outside data blocks.
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// Block close.
		if trimmed == "}" {
			if len(contextStack) > 0 {
				contextStack = contextStack[:len(contextStack)-1]
			}
			continue
		}

		// Block open: a line ending with " {" or just "{".
		if name, ok := strings.CutSuffix(trimmed, "{"); ok {
			blockName := strings.TrimSpace(name)
			contextStack = append(contextStack, blockName)
			blockIndent := len(line) - len(strings.TrimLeft(line, " \t"))
			if blockName == "data" {
				inDataBlock = true
				dataBlockIndent = blockIndent
				dataBlockTarget = "body"
			}
			if bodyType, ok := strings.CutPrefix(blockName, "body:"); ok {
				bru.Body.Type = strings.TrimSpace(bodyType)
				inDataBlock = true
				dataBlockIndent = blockIndent
				dataBlockTarget = "body"
			}
			if strings.EqualFold(blockName, "script:pre-request") {
				inDataBlock = true
				dataBlockIndent = blockIndent
				dataBlockTarget = "scripts.pre-request"
			}
			if strings.EqualFold(blockName, "script:post-response") {
				inDataBlock = true
				dataBlockIndent = blockIndent
				dataBlockTarget = "scripts.post-response"
			}
			if method, ok := httpMethodForBlock(blockName); ok {
				bru.HTTP.Method = method
			}
			if authType, ok := strings.CutPrefix(blockName, "auth:"); ok {
				configureAuth(bru, strings.TrimSpace(authType))
			}
			continue
		}

		// Key-value line: parse based on current context.
		ctx := currentContext()
		switch ctx {
		case "meta":
			parseMetaLine(trimmed, bru)

		case "http":
			if v, ok := strings.CutPrefix(trimmed, "method:"); ok {
				bru.HTTP.Method = strings.TrimSpace(v)
			} else if v, ok := strings.CutPrefix(trimmed, "url:"); ok {
				bru.HTTP.URL = strings.TrimSpace(v)
			}

		case "get", "post", "put", "delete", "patch", "head", "options":
			if v, ok := strings.CutPrefix(trimmed, "url:"); ok {
				bru.HTTP.URL = strings.TrimSpace(v)
			} else if v, ok := strings.CutPrefix(trimmed, "body:"); ok {
				bru.Body.Type = strings.TrimSpace(v)
			} else if v, ok := strings.CutPrefix(trimmed, "auth:"); ok {
				configureAuth(bru, strings.TrimSpace(v))
			}

		case "headers":
			if key, value, enabled, ok := parseEntryLine(trimmed); ok {
				bru.HTTP.Headers = append(bru.HTTP.Headers, Header{
					Key:     key,
					Value:   value,
					Enabled: enabled,
				})
			}

		case "query", "params:query":
			if key, value, enabled, ok := parseEntryLine(trimmed); ok {
				bru.HTTP.QueryParams = append(bru.HTTP.QueryParams, QueryParam{
					Key:     key,
					Value:   value,
					Enabled: enabled,
				})
			}

		case "path", "params:path":
			if key, value, enabled, ok := parseEntryLine(trimmed); ok {
				bru.HTTP.PathParams = append(bru.HTTP.PathParams, QueryParam{
					Key:     key,
					Value:   value,
					Enabled: enabled,
				})
			}

		case "auth":
			if v, ok := strings.CutPrefix(trimmed, "type:"); ok {
				configureAuth(bru, strings.TrimSpace(v))
			} else if bru.HTTP.Auth != nil {
				switch bru.HTTP.Auth.Type {
				case "basic":
					if bru.HTTP.Auth.Basic != nil {
						if v, ok := strings.CutPrefix(trimmed, "username:"); ok {
							bru.HTTP.Auth.Basic.Username = strings.TrimSpace(v)
						} else if v, ok := strings.CutPrefix(trimmed, "password:"); ok {
							bru.HTTP.Auth.Basic.Password = strings.TrimSpace(v)
						}
					}
				case "bearer":
					if bru.HTTP.Auth.Bearer != nil {
						if v, ok := strings.CutPrefix(trimmed, "token:"); ok {
							bru.HTTP.Auth.Bearer.Token = strings.TrimSpace(v)
						}
					}
				case "api-key":
					if bru.HTTP.Auth.APIKey != nil {
						if v, ok := strings.CutPrefix(trimmed, "key:"); ok {
							bru.HTTP.Auth.APIKey.Key = strings.TrimSpace(v)
						} else if v, ok := strings.CutPrefix(trimmed, "value:"); ok {
							bru.HTTP.Auth.APIKey.Value = strings.TrimSpace(v)
						} else if v, ok := strings.CutPrefix(trimmed, "in:"); ok {
							bru.HTTP.Auth.APIKey.In = strings.TrimSpace(v)
						}
					}
				}
			}

		case "body":
			if v, ok := strings.CutPrefix(trimmed, "type:"); ok {
				bru.Body.Type = strings.TrimSpace(v)
			}
		case "script":
			if v, ok := strings.CutPrefix(trimmed, "language:"); ok {
				if bru.Scripts == nil {
					bru.Scripts = &Scripts{}
				}
				language := strings.ToLower(strings.TrimSpace(v))
				if language == "javascript" || language == "typescript" {
					bru.Scripts.Language = language
				}
			}

		default:
			if authType, ok := strings.CutPrefix(ctx, "auth:"); ok {
				if bru.HTTP.Auth == nil || bru.HTTP.Auth.Type != authType {
					configureAuth(bru, authType)
				}
				if bru.HTTP.Auth != nil {
					switch bru.HTTP.Auth.Type {
					case "basic":
						if bru.HTTP.Auth.Basic != nil {
							if v, ok := strings.CutPrefix(trimmed, "username:"); ok {
								bru.HTTP.Auth.Basic.Username = strings.TrimSpace(v)
							} else if v, ok := strings.CutPrefix(trimmed, "password:"); ok {
								bru.HTTP.Auth.Basic.Password = strings.TrimSpace(v)
							}
						}
					case "bearer":
						if bru.HTTP.Auth.Bearer != nil {
							if v, ok := strings.CutPrefix(trimmed, "token:"); ok {
								bru.HTTP.Auth.Bearer.Token = strings.TrimSpace(v)
							}
						}
					case "api-key":
						if bru.HTTP.Auth.APIKey != nil {
							if v, ok := strings.CutPrefix(trimmed, "key:"); ok {
								bru.HTTP.Auth.APIKey.Key = strings.TrimSpace(v)
							} else if v, ok := strings.CutPrefix(trimmed, "value:"); ok {
								bru.HTTP.Auth.APIKey.Value = strings.TrimSpace(v)
							} else if v, ok := strings.CutPrefix(trimmed, "in:"); ok {
								bru.HTTP.Auth.APIKey.In = strings.TrimSpace(v)
							}
						}
					}
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading content: %w", err)
	}

	if bru.Body.Type == "" {
		bru.Body.Type = "none"
	}
	if bru.Scripts != nil && bru.Scripts.Language == "" {
		bru.Scripts.Language = "javascript"
	}

	return bru, nil
}

func parseMetaLine(line string, bru *BruFile) {
	if v, ok := strings.CutPrefix(line, "name:"); ok {
		bru.Meta.Name = strings.TrimSpace(v)
		bru.Meta.Name = strings.Trim(bru.Meta.Name, `"`)
	} else if v, ok := strings.CutPrefix(line, "type:"); ok {
		bru.Meta.Type = strings.TrimSpace(v)
	} else if v, ok := strings.CutPrefix(line, "seq:"); ok {
		seqStr := strings.TrimSpace(v)
		if seq, err := strconv.Atoi(seqStr); err == nil {
			bru.Meta.Seq = seq
		}
	}
}

func httpMethodForBlock(blockName string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(blockName)) {
	case "get":
		return "GET", true
	case "post":
		return "POST", true
	case "put":
		return "PUT", true
	case "delete":
		return "DELETE", true
	case "patch":
		return "PATCH", true
	case "head":
		return "HEAD", true
	case "options":
		return "OPTIONS", true
	default:
		return "", false
	}
}

func configureAuth(bru *BruFile, authType string) {
	normalized := strings.ToLower(strings.TrimSpace(authType))
	bru.HTTP.Auth = &AuthConfig{Type: normalized}
	switch normalized {
	case "basic":
		bru.HTTP.Auth.Basic = &struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}{}
	case "bearer":
		bru.HTTP.Auth.Bearer = &struct {
			Token string `json:"token"`
		}{}
	case "api-key":
		bru.HTTP.Auth.APIKey = &struct {
			Key   string `json:"key"`
			Value string `json:"value"`
			In    string `json:"in"`
		}{}
	}
}

func parseEntryLine(line string) (key, value string, enabled bool, ok bool) {
	parts := strings.SplitN(line, ":", 2)
	if len(parts) != 2 {
		return "", "", false, false
	}

	rawKey := strings.TrimSpace(parts[0])
	if rawKey == "" {
		return "", "", false, false
	}

	enabled = true
	if strings.HasPrefix(rawKey, "~") {
		enabled = false
		rawKey = strings.TrimSpace(strings.TrimPrefix(rawKey, "~"))
		if rawKey == "" {
			return "", "", false, false
		}
	}

	return rawKey, strings.TrimSpace(parts[1]), enabled, true
}

// Write writes a BruFile to disk
func Write(filepath string, bru *BruFile) error {
	content := GenerateContent(bru)
	return os.WriteFile(filepath, []byte(content), 0644)
}

// GenerateContent generates .bru file content from BruFile
func GenerateContent(bru *BruFile) string {
	var content strings.Builder

	// Meta section
	content.WriteString("meta {\n")
	fmt.Fprintf(&content, "  name: %s\n", bru.Meta.Name)
	fmt.Fprintf(&content, "  type: %s\n", bru.Meta.Type)
	if bru.Meta.Seq > 0 {
		fmt.Fprintf(&content, "  seq: %d\n", bru.Meta.Seq)
	}
	content.WriteString("}\n\n")

	// HTTP section
	content.WriteString("http {\n")
	fmt.Fprintf(&content, "  method: %s\n", bru.HTTP.Method)
	fmt.Fprintf(&content, "  url: %s\n", bru.HTTP.URL)

	// Query Params
	if len(bru.HTTP.QueryParams) > 0 {
		content.WriteString("  query {\n")
		for _, q := range bru.HTTP.QueryParams {
			prefix := ""
			if !q.Enabled {
				prefix = "~"
			}
			fmt.Fprintf(&content, "    %s%s: %s\n", prefix, q.Key, q.Value)
		}
		content.WriteString("  }\n")
	}

	// Path Params
	if len(bru.HTTP.PathParams) > 0 {
		content.WriteString("  params:path {\n")
		for _, p := range bru.HTTP.PathParams {
			prefix := ""
			if !p.Enabled {
				prefix = "~"
			}
			fmt.Fprintf(&content, "    %s%s: %s\n", prefix, p.Key, p.Value)
		}
		content.WriteString("  }\n")
	}

	// Headers
	if len(bru.HTTP.Headers) > 0 {
		content.WriteString("  headers {\n")
		for _, h := range bru.HTTP.Headers {
			prefix := ""
			if !h.Enabled {
				prefix = "~"
			}
			fmt.Fprintf(&content, "    %s%s: %s\n", prefix, h.Key, h.Value)
		}
		content.WriteString("  }\n")
	}

	// Auth
	if bru.HTTP.Auth != nil && bru.HTTP.Auth.Type != "none" {
		content.WriteString("  auth {\n")
		fmt.Fprintf(&content, "    type: %s\n", bru.HTTP.Auth.Type)

		switch bru.HTTP.Auth.Type {
		case "basic":
			if bru.HTTP.Auth.Basic != nil {
				fmt.Fprintf(&content, "    username: %s\n", bru.HTTP.Auth.Basic.Username)
				fmt.Fprintf(&content, "    password: %s\n", bru.HTTP.Auth.Basic.Password)
			}
		case "bearer":
			if bru.HTTP.Auth.Bearer != nil {
				fmt.Fprintf(&content, "    token: %s\n", bru.HTTP.Auth.Bearer.Token)
			}
		case "api-key":
			if bru.HTTP.Auth.APIKey != nil {
				fmt.Fprintf(&content, "    key: %s\n", bru.HTTP.Auth.APIKey.Key)
				fmt.Fprintf(&content, "    value: %s\n", bru.HTTP.Auth.APIKey.Value)
				fmt.Fprintf(&content, "    in: %s\n", bru.HTTP.Auth.APIKey.In)
			}
		}
		content.WriteString("  }\n")
	}
	content.WriteString("}\n\n")

	// Body section
	if bru.Body.Type != "" && bru.Body.Type != "none" {
		content.WriteString("body {\n")
		fmt.Fprintf(&content, "  type: %s\n", bru.Body.Type)
		// Body.Data is set by the frontend save path; HTTP.Body is the legacy field.
		bodyContent := bru.Body.Data
		if bodyContent == "" {
			bodyContent = bru.HTTP.Body
		}
		if bodyContent != "" {
			content.WriteString("  data {\n")
			for line := range strings.SplitSeq(bodyContent, "\n") {
				fmt.Fprintf(&content, "    %s\n", line)
			}
			content.WriteString("  }\n")
		}
		content.WriteString("}\n\n")
	}

	// Vars section
	if len(bru.Vars) > 0 {
		content.WriteString("vars {\n")
		for key, value := range bru.Vars {
			switch v := value.(type) {
			case string:
				fmt.Fprintf(&content, "  %s: \"%s\"\n", key, v)
			default:
				fmt.Fprintf(&content, "  %s: %v\n", key, v)
			}
		}
		content.WriteString("}\n\n")
	}

	// Scripts sections
	if bru.Scripts != nil {
		scriptLanguage := strings.ToLower(strings.TrimSpace(bru.Scripts.Language))
		if scriptLanguage == "" {
			scriptLanguage = "javascript"
		}
		if scriptLanguage != "javascript" && scriptLanguage != "typescript" {
			scriptLanguage = "javascript"
		}

		content.WriteString("script {\n")
		fmt.Fprintf(&content, "  language: %s\n", scriptLanguage)
		content.WriteString("}\n\n")

		if bru.Scripts.PreRequest != "" {
			content.WriteString("script:pre-request {\n")
			for line := range strings.SplitSeq(bru.Scripts.PreRequest, "\n") {
				fmt.Fprintf(&content, "  %s\n", line)
			}
			content.WriteString("}\n\n")
		}

		if bru.Scripts.PostResponse != "" {
			content.WriteString("script:post-response {\n")
			for line := range strings.SplitSeq(bru.Scripts.PostResponse, "\n") {
				fmt.Fprintf(&content, "  %s\n", line)
			}
			content.WriteString("}\n\n")
		}
	}

	// Assertions section
	if len(bru.Assertions) > 0 {
		content.WriteString("assertions {\n")
		for _, assertion := range bru.Assertions {
			fmt.Fprintf(&content, "  - %s\n", assertion)
		}
		content.WriteString("}\n")
	}

	return strings.TrimSpace(content.String())
}

// ParseCollection parses all .bru files in a collection directory
func ParseCollection(collectionPath string) ([]*BruFile, error) {
	entries, err := os.ReadDir(collectionPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read collection directory: %w", err)
	}

	var bruFiles []*BruFile
	bruRegex := regexp.MustCompile(`\.bru$`)

	for _, entry := range entries {
		if entry.IsDir() {
			// Recursively parse subdirectories
			subFiles, err := ParseCollection(collectionPath + "/" + entry.Name())
			if err != nil {
				continue
			}
			bruFiles = append(bruFiles, subFiles...)
		} else if bruRegex.MatchString(entry.Name()) {
			bru, err := Parse(collectionPath + "/" + entry.Name())
			if err != nil {
				continue
			}
			bruFiles = append(bruFiles, bru)
		}
	}

	return bruFiles, nil
}
