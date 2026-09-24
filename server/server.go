package server

import (
	"bytes"
	"fmt"
	"io/fs"
	"net/http"
	"strings"
	"time"

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

	r := NewHandler(cfg)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	logger.Success("Serving UI and API on http://%s", addr)
	logger.Info("Root directory: %s", cfg.Root)
	return r.Run(addr)
}

// NewHandler builds the HTTP routes without opening a listening socket.
// The caller must supply an absolute directory path in cfg.Root.
func NewHandler(cfg Config) *gin.Engine {
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
	fs.HEAD("/preview", h.preview)
	fs.GET("/content/*path", h.content)
	fs.HEAD("/content/*path", h.content)

	uiFS := ui.FS()
	r.NoRoute(spaHandler(uiFS))

	return r
}

// spaHandler serves the embedded frontend, falling back to index.html for
// client-side routing.
func spaHandler(root fs.FS) gin.HandlerFunc {
	fileServer := http.FileServer(http.FS(root))
	index, indexErr := fs.ReadFile(root, "index.html")
	return func(c *gin.Context) {
		p := c.Request.URL.Path
		_, statErr := fs.Stat(root, strings.TrimPrefix(p, "/"))
		if p == "/" || p == "/index.html" || statErr != nil {
			if indexErr != nil {
				c.Status(http.StatusNotFound)
				return
			}
			// The proxy may strip a mount prefix before forwarding the request.
			// A relative base walks back to the application root using only the
			// upstream path, keeping that external prefix without proxy headers.
			depth := strings.Count(strings.TrimPrefix(c.Request.URL.EscapedPath(), "/"), "/")
			base := "./"
			if depth > 0 {
				base = strings.Repeat("../", depth)
			}
			html := bytes.Replace(index, []byte(`<base href="/"`), []byte(`<base href="`+base+`"`), 1)
			c.Header("Content-Type", "text/html; charset=utf-8")
			c.Header("Cache-Control", "no-cache")
			http.ServeContent(c.Writer, c.Request, "index.html", time.Time{}, bytes.NewReader(html))
			return
		}
		serveAsset(c, root, fileServer)
	}
}
