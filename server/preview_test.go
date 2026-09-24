package server

import (
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestPreviewStreamingAndContentPaths(t *testing.T) {
	root, handler := testServer(t)
	for _, name := range []string{"docs/你好 #%.txt", "movie.mp4", "unknown", "page.html", "image.svg", "readme.markdown"} {
		content := "0123456789"
		if name == "page.html" {
			content = "<h1>Preview</h1>"
		}
		writeFixture(t, root, name, content)
		for _, target := range []string{"/api/fs/preview?path=" + url.QueryEscape("/"+name), "/api/fs/content/" + (&url.URL{Path: name}).EscapedPath()} {
			response := requestJSON(t, handler, "GET", target, nil, 200)
			if response.Body.String() != content {
				t.Fatalf("wrong content for %s: %s", target, response.Body.String())
			}
			if response.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Fatal("missing nosniff")
			}
			if name == "page.html" || name == "image.svg" {
				if !strings.Contains(response.Header().Get("Content-Security-Policy"), "sandbox") {
					t.Fatal("document missing sandbox")
				}
			}
			req := httptest.NewRequest("GET", target, nil)
			req.Header.Set("Range", "bytes=2-5")
			ranged := httptest.NewRecorder()
			handler.ServeHTTP(ranged, req)
			if ranged.Code != 206 || ranged.Body.String() != content[2:6] {
				t.Fatalf("range %s: %d %q", target, ranged.Code, ranged.Body.String())
			}
			head := requestJSON(t, handler, "HEAD", target, nil, 200)
			if head.Body.Len() != 0 || head.Header().Get("Content-Length") != response.Header().Get("Content-Length") {
				t.Fatal("HEAD must preserve headers without a body")
			}
			req = httptest.NewRequest("GET", target, nil)
			req.Header.Set("If-None-Match", response.Header().Get("ETag"))
			cached := httptest.NewRecorder()
			handler.ServeHTTP(cached, req)
			if cached.Code != 304 || cached.Body.Len() != 0 {
				t.Fatal("unchanged previews should revalidate")
			}
		}
	}
	requestJSON(t, handler, "GET", "/api/fs/content/missing", nil, 404)
	requestJSON(t, handler, "GET", "/api/fs/content/docs", nil, 400)
}
