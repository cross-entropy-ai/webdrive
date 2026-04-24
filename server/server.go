package server

import (
	"fmt"
	"io/fs"
	"log"
	"net/http"

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
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	api := r.Group("/api")
	h := &handler{root: cfg.Root}
	api.GET("/list", h.list)
	api.GET("/download", h.download)

	uiFS := ui.FS()
	r.NoRoute(spaHandler(uiFS))

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	log.Printf("webdrive serving %s on http://%s", cfg.Root, addr)
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
