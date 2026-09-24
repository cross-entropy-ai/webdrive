package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func searchRequest(t *testing.T, h http.Handler, scope, query string) searchResponse {
	t.Helper()
	w := requestJSON(t, h, "GET", "/api/fs/search?path="+url.QueryEscape(scope)+"&q="+url.QueryEscape(query), nil, 200)
	var result searchResponse
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestRecursiveSearchScopeAndRanking(t *testing.T) {
	root, h := testServer(t)
	writeFixture(t, root, "docs/deep/file-browser.tsx", "source")
	writeFixture(t, root, "docs/other/file-browser.tsx", "duplicate")
	writeFixture(t, root, "docs/.hidden/你好 #%.md", "unicode")
	writeFixture(t, root, "outside/file-browser.tsx", "outside")
	writeFixture(t, root, "docs/fb/review.txt", "path match")
	result := searchRequest(t, h, "/docs", "F B")
	if len(result.Entries) != 4 || result.Partial || result.HasMore {
		t.Fatalf("unexpected matches: %+v", result)
	}
	if result.Entries[0].Name != "fb" || !result.Entries[0].IsDir {
		t.Fatalf("exact folder name should rank first: %+v", result)
	}
	if result.Entries[1].Path != "/docs/deep/file-browser.tsx" || result.Entries[2].Path != "/docs/other/file-browser.tsx" || result.Entries[3].Name != "review.txt" {
		t.Fatalf("filename matches must precede path matches: %+v", result)
	}
	result = searchRequest(t, h, "/docs", "deep/fbt")
	if len(result.Entries) != 1 || result.Entries[0].RelativePath != "deep/file-browser.tsx" {
		t.Fatalf("path subsequence failed: %+v", result)
	}
	result = searchRequest(t, h, "/docs", "你%")
	if len(result.Entries) != 1 || result.Entries[0].Path != "/docs/.hidden/你好 #%.md" {
		t.Fatalf("hidden/unicode path missing: %+v", result)
	}
	for _, query := range []string{"", "  ", "no such file"} {
		if result := searchRequest(t, h, "/docs", query); len(result.Entries) != 0 {
			t.Fatalf("unexpected matches for %q: %+v", query, result)
		}
	}
}

func TestRecursiveSearchKeepsBestLateMatches(t *testing.T) {
	root := t.TempDir()
	for i := range 110 {
		writeFixture(t, root, fmt.Sprintf("a/match-%03d.txt", i), "")
	}
	writeFixture(t, root, "z/match", "")
	result := searchTree(context.Background(), root, "/", "match", searchLimit)
	if len(result.Entries) != searchLimit || !result.HasMore || result.Partial || result.Entries[0].Path != "/z/match" {
		t.Fatalf("truncated before best match: %+v", result)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	result = searchTree(ctx, root, "/", "match", searchLimit)
	if !result.Partial || len(result.Entries) != 0 {
		t.Fatalf("cancelled search continued: %+v", result)
	}
}

func TestRecursiveSearchValidationAndSymlinks(t *testing.T) {
	root, h := testServer(t)
	writeFixture(t, root, "docs/real.txt", "")
	outside := t.TempDir()
	writeFixture(t, outside, "secret.txt", "")
	if err := os.Symlink(outside, filepath.Join(root, "outside-link")); err != nil {
		t.Skip(err)
	}
	if err := os.Symlink(root, filepath.Join(root, "docs/loop")); err != nil {
		t.Fatal(err)
	}
	if result := searchRequest(t, h, "/", "secret"); len(result.Entries) != 0 {
		t.Fatalf("followed symlink: %+v", result)
	}
	if result := searchRequest(t, h, "/docs", "real"); len(result.Entries) != 1 {
		t.Fatalf("loop created duplicates: %+v", result)
	}
	requestJSON(t, h, "GET", "/api/fs/search?path=/outside-link&q=secret", nil, 403)
	requestJSON(t, h, "GET", "/api/fs/search?path=/missing&q=x", nil, 404)
	requestJSON(t, h, "GET", "/api/fs/search?path=/docs/real.txt&q=x", nil, 400)
	requestJSON(t, h, "GET", "/api/fs/search?q="+strings.Repeat("a", 129), nil, 400)
}

func TestRecursiveSearchStreamsBeforeCompletion(t *testing.T) {
	root, h := testServer(t)
	writeFixture(t, root, "deep/你好.txt", "")
	w := requestJSON(t, h, "GET", "/api/fs/search?q="+url.QueryEscape("你")+"&stream=1", nil, 200)
	if !w.Flushed || w.Header().Get("Content-Type") != "application/x-ndjson" || w.Header().Get("X-Accel-Buffering") != "no" {
		t.Fatalf("search is buffered: %+v", w.Header())
	}
	decoder := json.NewDecoder(w.Body)
	var frames []struct {
		searchResponse
		Done bool `json:"done"`
	}
	for {
		var frame struct {
			searchResponse
			Done bool `json:"done"`
		}
		if err := decoder.Decode(&frame); err == io.EOF {
			break
		} else if err != nil {
			t.Fatal(err)
		}
		frames = append(frames, frame)
	}
	if len(frames) < 3 || frames[0].Done || len(frames[0].Entries) != 0 || frames[1].Done || len(frames[1].Entries) != 1 || !frames[len(frames)-1].Done {
		t.Fatalf("missing progressive frames: %+v", frames)
	}
	// Closing a client after the first match must stop the scan before later entries.
	writeFixture(t, root, "deep/你好2.txt", "")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := searchTreeProgress(ctx, root, "/", "你", searchLimit, func(result searchResponse) { cancel() })
	if !result.Partial || len(result.Entries) != 1 {
		t.Fatalf("scan ignored streaming cancellation: %+v", result)
	}
}
