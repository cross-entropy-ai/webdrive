package server

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
)

func TestCompressedAssets(t *testing.T) {
	original := []byte("console.log('production asset')")
	var compressed bytes.Buffer
	writer := gzip.NewWriter(&compressed)
	if _, err := writer.Write(original); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	root := fstest.MapFS{
		"index.html":           {Data: []byte(`<base href="/"><div id="root"></div>`)},
		"index-ab12cd34.js":    {Data: original},
		"index-ab12cd34.js.gz": {Data: compressed.Bytes()},
	}
	gin.SetMode(gin.TestMode)
	handler := gin.New()
	handler.NoRoute(spaHandler(root))
	for _, header := range []string{"gzip", "br, gzip;q=0.8", "*", "gzip;q=0, *", "identity", "", "gzip;q=invalid"} {
		req := httptest.NewRequest("GET", "/index-ab12cd34.js", nil)
		req.Header.Set("Accept-Encoding", header)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != 200 || response.Header().Get("Vary") != "Accept-Encoding" || !strings.Contains(response.Header().Get("Cache-Control"), "immutable") {
			t.Fatalf("invalid response: %d %v", response.Code, response.Header())
		}
		body := response.Body.Bytes()
		wantGzip := header == "gzip" || header == "br, gzip;q=0.8" || header == "*"
		if wantGzip {
			if response.Header().Get("Content-Encoding") != "gzip" {
				t.Fatal("missing gzip encoding")
			}
			reader, err := gzip.NewReader(bytes.NewReader(body))
			if err != nil {
				t.Fatal(err)
			}
			body, err = io.ReadAll(reader)
			if err != nil {
				t.Fatal(err)
			}
			reader.Close()
		} else if response.Header().Get("Content-Encoding") != "" {
			t.Fatal("unexpected compression")
		}
		if !bytes.Equal(body, original) {
			t.Fatal("asset changed after compression")
		}
		if !strings.Contains(response.Header().Get("Content-Type"), "javascript") {
			t.Fatal("incorrect MIME type")
		}
	}
	req := httptest.NewRequest("HEAD", "/index-ab12cd34.js", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	if response.Code != 200 || response.Body.Len() != 0 || response.Header().Get("Content-Encoding") != "gzip" {
		t.Fatal("invalid compressed HEAD")
	}
	index := requestJSON(t, handler, "GET", "/docs/nested", nil, 200)
	if index.Header().Get("Cache-Control") != "no-cache" || !strings.Contains(index.Body.String(), `<base href="../">`) {
		t.Fatal("index must revalidate and preserve relative base")
	}
}
