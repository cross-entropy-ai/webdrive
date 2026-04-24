package server

import (
	"errors"
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "is a directory"})
		return
	}
	c.FileAttachment(full, info.Name())
}

func normalize(p string) string {
	if p == "" {
		return "/"
	}
	return filepath.ToSlash(filepath.Clean("/" + p))
}
