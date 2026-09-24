package server

import (
	"archive/zip"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

func (h *handler) download(c *gin.Context) {
	paths := c.QueryArray("path")
	if len(paths) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path is required"})
		return
	}

	// Single file (non-directory) — serve directly
	if len(paths) == 1 {
		full, err := h.resolve(paths[0])
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
			c.FileAttachment(full, info.Name())
			return
		}
	}

	// Multiple paths or single directory — zip them
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", `attachment; filename="download.zip"`)
	zw := zip.NewWriter(c.Writer)
	defer zw.Close()

	for _, reqPath := range paths {
		full, err := h.resolve(reqPath)
		if err != nil {
			continue
		}
		info, err := os.Stat(full)
		if err != nil {
			continue
		}
		base := filepath.Base(full)
		if info.IsDir() {
			_ = filepath.Walk(full, func(path string, fi os.FileInfo, err error) error {
				if err != nil {
					return err
				}
				rel, _ := filepath.Rel(full, path)
				name := filepath.Join(base, rel)
				if fi.IsDir() {
					_, err = zw.Create(name + "/")
					return err
				}
				w, err := zw.Create(name)
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
		} else {
			w, err := zw.Create(base)
			if err != nil {
				continue
			}
			f, err := os.Open(full)
			if err != nil {
				continue
			}
			io.Copy(w, f)
			f.Close()
		}
	}
}
