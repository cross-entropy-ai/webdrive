package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func (h *handler) mkdir(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.Name == "" || !validRelPath(req.Name) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid folder name"})
		return
	}
	dirFull, err := h.resolve(req.Path)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	target := filepath.Join(dirFull, req.Name)
	if err := os.Mkdir(target, 0755); err != nil {
		if os.IsExist(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "folder already exists"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
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

func (h *handler) delete(c *gin.Context) {
	var req struct {
		Paths []string `json:"paths"`
		Path  string   `json:"path"` // backwards compat: single path
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	paths := req.Paths
	if len(paths) == 0 && req.Path != "" {
		paths = []string{req.Path}
	}
	if len(paths) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path is required"})
		return
	}

	var errors []string
	for _, p := range paths {
		if normalize(p) == "/" {
			errors = append(errors, "cannot delete root directory")
			continue
		}
		full, err := h.resolve(p)
		if err != nil {
			errors = append(errors, err.Error())
			continue
		}
		if _, err := os.Stat(full); err != nil {
			errors = append(errors, err.Error())
			continue
		}
		if err := os.RemoveAll(full); err != nil {
			errors = append(errors, err.Error())
		}
	}
	if len(errors) > 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"errors": errors})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
