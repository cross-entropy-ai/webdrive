package server

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type handler struct {
	root string
}

func (h *handler) info(c *gin.Context) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}
	c.JSON(http.StatusOK, gin.H{"hostname": hostname, "root": h.root})
}

type entry struct {
	Name    string    `json:"name"`
	IsDir   bool      `json:"is_dir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

type listResponse struct {
	Path    string  `json:"path"`
	Entries []entry `json:"entries"`
}

// resolve joins the user-supplied path to the configured root and verifies
// the result stays inside the root (no traversal via "..").
func (h *handler) resolve(reqPath string) (string, error) {
	if reqPath == "" {
		reqPath = "/"
	}
	clean := filepath.Clean("/" + reqPath)
	full := filepath.Join(h.root, clean)
	rel, err := filepath.Rel(h.root, full)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", errors.New("path escapes root")
	}
	return full, nil
}

func (h *handler) list(c *gin.Context) {
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
	if !info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "not a directory"})
		return
	}
	items, err := os.ReadDir(full)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	entries := make([]entry, 0, len(items))
	for _, it := range items {
		fi, err := it.Info()
		if err != nil {
			continue
		}
		entries = append(entries, entry{
			Name:    it.Name(),
			IsDir:   it.IsDir(),
			Size:    fi.Size(),
			ModTime: fi.ModTime(),
		})
	}
	c.JSON(http.StatusOK, listResponse{Path: normalize(reqPath), Entries: entries})
}

func (h *handler) download(c *gin.Context) {
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
		zipName := filepath.Base(full) + ".zip"
		c.Header("Content-Type", "application/zip")
		c.Header("Content-Disposition", `attachment; filename="`+zipName+`"`)
		zw := zip.NewWriter(c.Writer)
		defer zw.Close()
		_ = filepath.Walk(full, func(path string, fi os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(full, path)
			if rel == "." {
				return nil
			}
			if fi.IsDir() {
				_, err = zw.Create(rel + "/")
				return err
			}
			w, err := zw.Create(rel)
			if err != nil {
				return err
			}
			f, err := os.Open(path)
			if err != nil {
				return err
			}
			defer f.Close()
			_, err = io.Copy(w, f)
			return err
		})
		return
	}
	c.FileAttachment(full, info.Name())
}

func (h *handler) rename(c *gin.Context) {
	var req struct {
		Path    string `json:"path"`
		NewName string `json:"new_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.NewName == "" || strings.ContainsAny(req.NewName, "/\\") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid new name"})
		return
	}
	if normalize(req.Path) == "/" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot rename root directory"})
		return
	}
	full, err := h.resolve(req.Path)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := os.Stat(full); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	newFull := filepath.Join(filepath.Dir(full), req.NewName)
	if _, err := os.Stat(newFull); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "a file or directory with that name already exists"})
		return
	}
	if err := os.Rename(full, newFull); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

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

func (h *handler) delete(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if normalize(req.Path) == "/" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete root directory"})
		return
	}
	full, err := h.resolve(req.Path)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := os.Stat(full); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if err := os.RemoveAll(full); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func normalize(p string) string {
	if p == "" {
		return "/"
	}
	return filepath.ToSlash(filepath.Clean("/" + p))
}
