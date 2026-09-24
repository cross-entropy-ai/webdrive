package server

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
)

func testServer(t *testing.T) (string, http.Handler) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	root := t.TempDir()
	return root, NewHandler(Config{Root: root})
}

func requestJSON(t *testing.T, h http.Handler, method, target string, body any, status int) *httptest.ResponseRecorder {
	t.Helper()
	var input io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		input = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, target, input)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != status {
		t.Fatalf("%s %s: got %d, want %d: %s", method, target, w.Code, status, w.Body.String())
	}
	return w
}

func writeFixture(t *testing.T, root, name, content string) {
	t.Helper()
	full := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Dir(full), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestFileLifecycle(t *testing.T) {
	root, h := testServer(t)
	requestJSON(t, h, "POST", "/api/fs/mkdir", map[string]string{"path": "/", "name": "docs"}, 200)
	requestJSON(t, h, "POST", "/api/fs/mkdir", map[string]string{"path": "/", "name": "docs"}, 409)

	var form bytes.Buffer
	writer := multipart.NewWriter(&form)
	for key, value := range map[string]string{"path": "/docs", "relativePaths": "nested/你好 #%.ts"} {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatal(err)
		}
	}
	part, err := writer.CreateFormFile("files", "你好 #%.ts")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(part, "const answer = 42;\n"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/fs/upload", &form)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}

	w = requestJSON(t, h, "GET", "/api/fs/list?path=/docs/nested", nil, 200)
	var listing listResponse
	if err := json.Unmarshal(w.Body.Bytes(), &listing); err != nil {
		t.Fatal(err)
	}
	if listing.Path != "/docs/nested" || len(listing.Entries) != 1 || listing.Entries[0].Name != "你好 #%.ts" || listing.Entries[0].IsDir {
		t.Fatalf("unexpected listing: %+v", listing)
	}
	path := "/docs/nested/你好 #%.ts"
	w = requestJSON(t, h, "POST", "/api/fs/check", map[string]any{"dir": "/docs", "paths": []string{"nested/你好 #%.ts", "missing.txt", "../outside"}}, 200)
	var check struct {
		Existing []string `json:"existing"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &check); err != nil {
		t.Fatal(err)
	}
	if len(check.Existing) != 1 || check.Existing[0] != "nested/你好 #%.ts" {
		t.Fatalf("unexpected conflicts: %+v", check)
	}

	w = requestJSON(t, h, "GET", "/api/fs/preview?path="+url.QueryEscape(path), nil, 200)
	if !strings.HasPrefix(w.Header().Get("Content-Type"), "text/plain") || w.Body.String() != "const answer = 42;\n" {
		t.Fatalf("preview: %s %s", w.Header(), w.Body.String())
	}
	w = requestJSON(t, h, "GET", "/api/fs/list?path="+url.QueryEscape(path), nil, 400)
	if !strings.Contains(w.Body.String(), "not a directory") {
		t.Fatal(w.Body.String())
	}
	w = requestJSON(t, h, "GET", "/api/fs/download?path="+url.QueryEscape(path), nil, 200)
	if !strings.Contains(w.Header().Get("Content-Disposition"), "attachment") || w.Body.String() != "const answer = 42;\n" {
		t.Fatalf("download: %s", w.Body.String())
	}

	requestJSON(t, h, "POST", "/api/fs/rename", map[string]string{"path": path, "new_name": "answer.ts"}, 200)
	if _, err := os.Stat(filepath.Join(root, "docs/nested/answer.ts")); err != nil {
		t.Fatal(err)
	}
	requestJSON(t, h, "POST", "/api/fs/delete", map[string]string{"path": "/docs"}, 200)
	if _, err := os.Stat(filepath.Join(root, "docs")); !os.IsNotExist(err) {
		t.Fatalf("directory was not deleted: %v", err)
	}
}

func TestBatchDownloadAndDelete(t *testing.T) {
	root, h := testServer(t)
	writeFixture(t, root, "docs/a.txt", "alpha")
	writeFixture(t, root, "b.txt", "beta")
	if err := os.Mkdir(filepath.Join(root, "docs/empty"), 0755); err != nil {
		t.Fatal(err)
	}
	w := requestJSON(t, h, "GET", "/api/fs/download?path=/docs&path=/b.txt", nil, 200)
	archive, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	contents := map[string]string{}
	for _, file := range archive.File {
		r, err := file.Open()
		if err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(r)
		r.Close()
		if err != nil {
			t.Fatal(err)
		}
		contents[file.Name] = string(data)
	}
	if contents["docs/a.txt"] != "alpha" || contents["b.txt"] != "beta" {
		t.Fatalf("unexpected zip: %+v", contents)
	}
	if _, ok := contents["docs/empty/"]; !ok {
		t.Fatal("zip lost empty directory")
	}
	requestJSON(t, h, "POST", "/api/fs/delete", map[string]any{"paths": []string{"/docs", "/b.txt"}}, 200)
	items, err := os.ReadDir(root)
	if err != nil || len(items) != 0 {
		t.Fatalf("batch delete: %v, %v", items, err)
	}
}

func TestValidationAndCompatibility(t *testing.T) {
	root, h := testServer(t)
	writeFixture(t, root, "a.txt", "alpha")
	writeFixture(t, root, "b.txt", "beta")
	cases := []struct {
		name, method, target string
		body                 any
		status               int
		message              string
	}{
		{"root rename", "POST", "/api/fs/rename", map[string]string{"path": "/", "new_name": "other"}, 400, "cannot rename root"},
		{"root delete", "POST", "/api/fs/delete", map[string]string{"path": "/"}, 500, "cannot delete root"},
		{"rename conflict", "POST", "/api/fs/rename", map[string]string{"path": "/a.txt", "new_name": "b.txt"}, 409, "already exists"},
		{"rename separator", "POST", "/api/fs/rename", map[string]string{"path": "/a.txt", "new_name": "nested/name"}, 400, "invalid new name"},
		{"mkdir traversal", "POST", "/api/fs/mkdir", map[string]string{"path": "/", "name": "../outside"}, 400, "invalid folder name"},
		{"missing file", "GET", "/api/fs/preview?path=/missing", nil, 404, "error"},
		{"directory preview", "GET", "/api/fs/preview?path=/", nil, 400, "is a directory"},
		{"no download path", "GET", "/api/fs/download", nil, 400, "path is required"},
		{"no delete path", "POST", "/api/fs/delete", map[string]string{}, 400, "path is required"},
		{"invalid JSON shape", "POST", "/api/fs/mkdir", []string{"bad"}, 400, "invalid request body"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			w := requestJSON(t, h, tt.method, tt.target, tt.body, tt.status)
			if !strings.Contains(w.Body.String(), tt.message) {
				t.Fatalf("unexpected error: %s", w.Body.String())
			}
		})
	}
	w := requestJSON(t, h, "GET", "/api/info", nil, 200)
	var info struct {
		Root string `json:"root"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &info); err != nil {
		t.Fatal(err)
	}
	if info.Root != root {
		t.Fatalf("root = %q, want %q", info.Root, root)
	}
}

func TestSPAHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.NoRoute(spaHandler(fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<h1>webdrive</h1>")},
		"app.js":     &fstest.MapFile{Data: []byte("console.log('webdrive')")},
	}))
	for _, target := range []string{"/", "/folder/nested"} {
		w := requestJSON(t, r, "GET", target, nil, 200)
		if w.Body.String() != "<h1>webdrive</h1>" {
			t.Fatalf("SPA fallback: %s", w.Body.String())
		}
	}
	w := requestJSON(t, r, "GET", "/app.js", nil, 200)
	if w.Body.String() != "console.log('webdrive')" {
		t.Fatal(w.Body.String())
	}
}
