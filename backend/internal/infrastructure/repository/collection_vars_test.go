package repository

import (
	"strings"
	"testing"
)

func TestParseCollectionVars_Basic(t *testing.T) {
	content := "vars {\n  baseUrl: https://api.example.com\n  timeout: 30\n  apiKey: secret-value\n}\n\nvars:secret [\n  apiKey\n]"

	vars := parseCollectionVars(content)

	if len(vars) != 3 {
		t.Fatalf("expected 3 vars, got %d", len(vars))
	}
	if vars[0].Key != "baseUrl" || vars[0].Value != "https://api.example.com" || vars[0].Secret {
		t.Errorf("unexpected baseUrl var: %+v", vars[0])
	}
	if vars[1].Key != "timeout" || vars[1].Value != "30" || vars[1].Secret {
		t.Errorf("unexpected timeout var: %+v", vars[1])
	}
	if vars[2].Key != "apiKey" || vars[2].Value != "secret-value" || !vars[2].Secret {
		t.Errorf("unexpected apiKey var: %+v", vars[2])
	}
}

func TestParseCollectionVars_Empty(t *testing.T) {
	vars := parseCollectionVars("")
	if len(vars) != 0 {
		t.Fatalf("expected 0 vars, got %d", len(vars))
	}
}

func TestFormatCollectionVars_Basic(t *testing.T) {
	vars := []CollectionVar{
		{Key: "baseUrl", Value: "https://api.example.com", Enabled: true, Secret: false},
		{Key: "apiKey", Value: "secret-value", Enabled: true, Secret: true},
	}

	content := formatCollectionVars(vars)

	if !strings.Contains(content, "baseUrl: https://api.example.com") {
		t.Error("expected baseUrl in vars block")
	}
	if !strings.Contains(content, "apiKey: secret-value") {
		t.Error("expected apiKey value in vars block")
	}
	if !strings.Contains(content, "vars:secret [") {
		t.Error("expected vars:secret block")
	}
	if !strings.Contains(content, "  apiKey") {
		t.Error("expected apiKey in secret block")
	}
}

func TestFormatCollectionVars_DisabledVarWrittenWithTilde(t *testing.T) {
	vars := []CollectionVar{
		{Key: "active", Value: "yes", Enabled: true, Secret: false},
		{Key: "inactive", Value: "no", Enabled: false, Secret: false},
	}

	content := formatCollectionVars(vars)

	if !strings.Contains(content, "  active: yes") {
		t.Error("expected active var without tilde")
	}
	if !strings.Contains(content, "  ~inactive: no") {
		t.Error("expected disabled var with ~ prefix")
	}
}

func TestParseCollectionVars_DisabledPrefix(t *testing.T) {
	content := "vars {\n  active: yes\n  ~inactive: no\n}\n"

	vars := parseCollectionVars(content)

	if len(vars) != 2 {
		t.Fatalf("expected 2 vars, got %d", len(vars))
	}
	if vars[0].Key != "active" || !vars[0].Enabled {
		t.Errorf("expected active var enabled, got %+v", vars[0])
	}
	if vars[1].Key != "inactive" || vars[1].Enabled {
		t.Errorf("expected inactive var disabled, got %+v", vars[1])
	}
}

func TestParseFormatRoundTrip_DisabledSecret(t *testing.T) {
	original := []CollectionVar{
		{Key: "token", Value: "my-token", Enabled: false, Secret: true},
	}

	content := formatCollectionVars(original)
	parsed := parseCollectionVars(content)

	if len(parsed) != 1 {
		t.Fatalf("expected 1 var, got %d", len(parsed))
	}
	if parsed[0].Key != "token" {
		t.Errorf("expected key 'token', got %q", parsed[0].Key)
	}
	if parsed[0].Secret != true {
		t.Errorf("expected secret=true for disabled+secret var, got false")
	}
	if parsed[0].Enabled != false {
		t.Errorf("expected enabled=false, got true")
	}
}

func TestParseFormatRoundTrip(t *testing.T) {
	original := []CollectionVar{
		{Key: "baseUrl", Value: "https://api.example.com", Enabled: true, Secret: false},
		{Key: "apiKey", Value: "my-secret", Enabled: true, Secret: true},
	}

	content := formatCollectionVars(original)
	parsed := parseCollectionVars(content)

	if len(parsed) != len(original) {
		t.Fatalf("round-trip length mismatch: got %d, want %d", len(parsed), len(original))
	}
	for i, v := range parsed {
		if v.Key != original[i].Key || v.Value != original[i].Value || v.Secret != original[i].Secret {
			t.Errorf("round-trip mismatch at index %d: got %+v, want %+v", i, v, original[i])
		}
	}
}
