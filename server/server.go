package server

import (
	"fmt"
	"io/fs"
	"net/http"

	"github.com/cross-entropy-ai/webdrive/logger"
	"github.com/cross-entropy-ai/webdrive/ui"
	"github.com/gin-gonic/gin"
)

// Config holds the server configuration.
type Config struct {
	Host string
	Port int
	Root string // absolute path to the directory being served
}

// Run starts the gin HTTP server and blocks until it exits.
func Run(cfg Config) error {
	gin.SetMode(gin.ReleaseMode)
	gin.ForceConsoleColor() // Ensure colors are output even in release mode

	r := gin.New()
	r.Use(logger.Middleware(), gin.Recovery())

	api := r.Group("/api")
	h := &handler{root: cfg.Root}
	api.GET("/info", h.info)

	fs := api.Group("/fs")
	fs.GET("/list", h.list)
	fs.GET("/download", h.download)
	fs.POST("/upload", h.upload)
	fs.POST("/mkdir", h.mkdir)
	fs.POST("/check", h.check)
	fs.POST("/rename", h.rename)
	fs.POST("/delete", h.delete)
	fs.GET("/preview", h.preview)

	uiFS := ui.FS()
	r.NoRoute(spaHandler(uiFS))

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	logger.Success("Serving UI and API on http://%s", addr)
	logger.Info("Root directory: %s", cfg.Root)
	return r.Run(addr)
}

// spaHandler serves the embedded frontend, falling back to index.html for
// client-side routing.
func spaHandler(root fs.FS) gin.HandlerFunc {
	fileServer := http.FileServer(http.FS(root))
	return func(c *gin.Context) {
		p := c.Request.URL.Path
		if p == "/" {
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}
		if _, err := fs.Stat(root, p[1:]); err != nil {
			c.Request.URL.Path = "/"
		}
		fileServer.ServeHTTP(c.Writer, c.Request)
	}
}
