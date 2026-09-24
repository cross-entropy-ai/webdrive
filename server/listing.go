package server

import (
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

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
		isDir := it.IsDir()
		if fi.Mode()&os.ModeSymlink != 0 {
			if target, err := os.Stat(filepath.Join(full, it.Name())); err == nil {
				isDir = target.IsDir()
			}
		}
		entries = append(entries, entry{
			Name:    it.Name(),
			IsDir:   isDir,
			Size:    fi.Size(),
			ModTime: fi.ModTime(),
		})
	}
	c.JSON(http.StatusOK, listResponse{Path: normalize(reqPath), Entries: entries})
}
