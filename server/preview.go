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
	".md": true, ".mdx": true, ".rst": true, ".txt": true, ".log": true,
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

func (h *handler) preview(c *gin.Context) {
	reqPath := c.Query("path")
	full, err := h.resolve(reqPath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	info, err := os.Stat(full)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "is a directory"})
		return
	}

	name := info.Name()
	ext := strings.ToLower(filepath.Ext(name))
	nameLower := strings.ToLower(name)
	ct := ""
	if textFileExts[ext] || textFileNames[nameLower] {
		ct = "text/plain; charset=utf-8"
	} else {
		ct = mime.TypeByExtension(ext)
	}
	if ct != "" {
		c.Header("Content-Type", ct)
		c.Header("Content-Length", fmt.Sprintf("%d", info.Size()))
		c.File(full)
		return
	}

	// Unknown extension — sniff content type, then stream from same handle
	f, err := os.Open(full)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer f.Close()
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	ct = http.DetectContentType(buf[:n])
	_, _ = f.Seek(0, io.SeekStart)
	c.Header("Content-Type", ct)
	c.Header("Content-Length", fmt.Sprintf("%d", info.Size()))
	c.DataFromReader(http.StatusOK, info.Size(), ct, f, nil)
}
