package health

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthHandler(t *testing.T) {
	srv := httptest.NewServer(NewMux("1.2.3"))
	defer srv.Close()

	res, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", res.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" {
		t.Errorf("status field = %v, want ok", body["status"])
	}
	if body["version"] != "1.2.3" {
		t.Errorf("version field = %v, want 1.2.3", body["version"])
	}
}

func TestReadyHandler(t *testing.T) {
	srv := httptest.NewServer(NewMux("0.0.0"))
	defer srv.Close()

	res, err := http.Get(srv.URL + "/ready")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("ready status = %d, want 200", res.StatusCode)
	}

	buf := make([]byte, 256)
	n, _ := res.Body.Read(buf)
	if !strings.Contains(string(buf[:n]), "ready") {
		t.Errorf("body did not contain 'ready': %s", string(buf[:n]))
	}
}
