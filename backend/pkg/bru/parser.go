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
}

// QueryParam represents a URL query parameter
type QueryParam struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

// AuthConfig represents authentication configuration
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
		Body        string       `json:"body,omitempty"`
		Auth        *AuthConfig  `json:"auth,omitempty"`
	} `json:"http"`
	Body struct {
		Type string `json:"type"`
		Data string `json:"data,omitempty"`
	} `json:"body"`
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
			Body        string       `json:"body,omitempty"`
			Auth        *AuthConfig  `json:"auth,omitempty"`
		}{
			Headers:     []Header{},
			QueryParams: []QueryParam{},
		},
		Vars:       make(map[string]any),
		Assertions: []string{},
	}

	scanner := bufio.NewScanner(strings.NewReader(content))
	// contextStack tracks nested block names, e.g. ["http", "headers"].
	var contextStack []string
	// dataLines accumulates indented lines inside a data { } block.
	var dataLines []string
	inDataBlock := false

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
				inDataBlock = false
				contextStack = contextStack[:len(contextStack)-1]
				bru.Body.Data = strings.TrimRight(strings.Join(dataLines, "\n"), "\n")
				dataLines = nil
				continue
			}
			stripped := line
			if strings.HasPrefix(line, "    ") {
				stripped = line[4:]
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
			if blockName == "data" {
				inDataBlock = true
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

		case "headers":
			// "Key: Value" — split on first colon only.
			if parts := strings.SplitN(trimmed, ":", 2); len(parts) == 2 {
				bru.HTTP.Headers = append(bru.HTTP.Headers, Header{
					Key:   strings.TrimSpace(parts[0]),
					Value: strings.TrimSpace(parts[1]),
				})
			}

		case "query":
			if parts := strings.SplitN(trimmed, ":", 2); len(parts) == 2 {
				bru.HTTP.QueryParams = append(bru.HTTP.QueryParams, QueryParam{
					Key:     strings.TrimSpace(parts[0]),
					Value:   strings.TrimSpace(parts[1]),
					Enabled: true,
				})
			}

		case "auth":
			if v, ok := strings.CutPrefix(trimmed, "type:"); ok {
				authType := strings.TrimSpace(v)
				bru.HTTP.Auth = &AuthConfig{Type: authType}
				// Pre-allocate sub-struct so later lines can fill it in.
				switch authType {
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
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading content: %w", err)
	}

	if bru.Body.Type == "" {
		bru.Body.Type = "none"
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
			if q.Enabled {
				fmt.Fprintf(&content, "    %s: %s\n", q.Key, q.Value)
			}
		}
		content.WriteString("  }\n")
	}

	// Headers
	if len(bru.HTTP.Headers) > 0 {
		content.WriteString("  headers {\n")
		for _, h := range bru.HTTP.Headers {
			fmt.Fprintf(&content, "    %s: %s\n", h.Key, h.Value)
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
