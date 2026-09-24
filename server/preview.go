package server

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// Extensions that mime.TypeByExtension maps incorrectly (e.g. .ts → video/mp2t)
// or that have no registered MIME type but are known text/code files.
var textFileExts = map[string]bool{
	".ts": true, ".tsx": true, ".jsx": true, ".mjs": true, ".cjs": true,
	".rs": true, ".go": true, ".py": true, ".rb": true, ".lua": true,
	".sh": true, ".bash": true, ".zsh": true, ".fish": true,
	".yaml": true, ".yml": true, ".toml": true, ".ini": true, ".conf": true, ".cfg": true,
	".md": true, ".markdown": true, ".mdx": true, ".rst": true, ".txt": true, ".log": true,
	".sql": true, ".graphql": true, ".gql": true, ".proto": true,
	".dockerfile": true,
	".vue":        true, ".svelte": true, ".astro": true,
	".tf": true, ".hcl": true, ".nix": true,
	".kt": true, ".kts": true, ".swift": true, ".ex": true, ".exs": true,
	".hs": true, ".ml": true, ".mli": true, ".erl": true, ".hrl": true,
	".r": true, ".R": true, ".jl": true, ".pl": true, ".pm": true,
	".cmake": true, ".mk": true,
	".mod": true, ".sum": true, ".lock": true, ".lockb": true,
	".csv": true, ".tsv": true, ".jsonl": true, ".ndjson": true,
	".diff": true, ".patch": true,
}

var textFileNames = map[string]bool{
	"makefile": true, "dockerfile": true, "justfile": true,
	"rakefile": true, "gemfile": true, "procfile": true,
	"vagrantfile": true, "brewfile": true,
	".gitignore": true, ".dockerignore": true, ".editorconfig": true,
	".env": true, ".env.local": true, ".env.example": true,
}

// preview keeps the existing query-based API; content also allows relative
// assets in HTML and Markdown documents to resolve beneath the served root.
func (h *handler) preview(c *gin.Context) {
	h.servePreview(c, c.Query("path"))
}

func (h *handler) content(c *gin.Context) {
	h.servePreview(c, c.Param("path"))
}

func (h *handler) servePreview(c *gin.Context, reqPath string) {
	full, err := h.resolve(reqPath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	f, err := os.Open(full)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !info.Mode().IsRegular() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "is a directory"})
		return
	}
	ext := strings.ToLower(filepath.Ext(info.Name()))
	ct := mime.TypeByExtension(ext)
	if textFileExts[ext] || textFileNames[strings.ToLower(info.Name())] {
		ct = "text/plain; charset=utf-8"
	}
	if ct == "" {
		buf := make([]byte, 512)
		n, _ := f.Read(buf)
		ct = http.DetectContentType(buf[:n])
		if _, err := f.Seek(0, io.SeekStart); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.Header("Content-Type", ct)
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "no-cache")
	c.Header("ETag", fmt.Sprintf(`"%x-%x"`, info.Size(), info.ModTime().UnixNano()))
	if strings.HasPrefix(ct, "text/html") || strings.HasPrefix(ct, "image/svg+xml") {
		// Served documents must not execute with the file manager's privileges,
		// including when their content URL is opened outside the preview frame.
		c.Header("Content-Security-Policy", "sandbox; script-src 'none'; object-src 'none'; form-action 'none'")
	}
	http.ServeContent(c.Writer, c.Request, info.Name(), info.ModTime(), f)
}
