package server

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

func (h *handler) upload(c *gin.Context) {
	dir := c.PostForm("path")
	if dir == "" {
		dir = "/"
	}
	dirFull, err := h.resolve(dir)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid multipart form"})
		return
	}
	files := form.File["files"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no files provided"})
		return
	}

	relativePaths := form.Value["relativePaths"]

	var errs []string
	for i, fh := range files {
		var relPath string
		if i < len(relativePaths) && relativePaths[i] != "" {
			relPath = filepath.Clean(relativePaths[i])
		} else {
			relPath = filepath.Base(fh.Filename)
		}
		if !validRelPath(relPath) {
			errs = append(errs, relPath+": invalid path")
			continue
		}
		dst := filepath.Join(dirFull, relPath)
		// Create parent directories if needed
		if dir := filepath.Dir(dst); dir != dirFull {
			if err := os.MkdirAll(dir, 0755); err != nil {
				errs = append(errs, relPath+": "+err.Error())
				continue
			}
		}
		if err := c.SaveUploadedFile(fh, dst); err != nil {
			errs = append(errs, relPath+": "+err.Error())
		}
	}
	if len(errs) > 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"errors": errs})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "count": len(files)})
}

func (h *handler) check(c *gin.Context) {
	var req struct {
		Dir   string   `json:"dir"`
		Paths []string `json:"paths"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	dirFull, err := h.resolve(req.Dir)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	existing := make([]string, 0)
	for _, p := range req.Paths {
		if !validRelPath(p) {
			continue
		}
		full := filepath.Join(dirFull, filepath.Clean(p))
		if _, err := os.Stat(full); err == nil {
			existing = append(existing, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"existing": existing})
}
