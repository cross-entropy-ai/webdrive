package server

import (
	"io/fs"
	"mime"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

var hashedAsset = regexp.MustCompile(`-[a-z0-9]{8}\.(js|css)$`)

// acceptsGzip respects explicit q=0 exclusions, even when a wildcard is present.
func acceptsGzip(header string) bool {
	wildcard := false
	for _, part := range strings.Split(header, ",") {
		fields := strings.Split(part, ";")
		encoding := strings.TrimSpace(fields[0])
		quality := 1.0
		for _, parameter := range fields[1:] {
			key, value, _ := strings.Cut(strings.TrimSpace(parameter), "=")
			if key == "q" {
				parsed, err := strconv.ParseFloat(value, 64)
				if err != nil {
					quality = 0
				} else {
					quality = parsed
				}
			}
		}
		if encoding == "gzip" {
			return quality > 0
		}
		if encoding == "*" {
			wildcard = quality > 0
		}
	}
	return wildcard
}

func serveAsset(c *gin.Context, root fs.FS, fileServer http.Handler) {
	p := c.Request.URL.Path
	if hashedAsset.MatchString(p) {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	}
	if strings.HasSuffix(p, ".js") || strings.HasSuffix(p, ".css") {
		c.Header("Vary", "Accept-Encoding")
		if acceptsGzip(c.GetHeader("Accept-Encoding")) {
			if _, err := fs.Stat(root, strings.TrimPrefix(p, "/")+".gz"); err == nil {
				c.Header("Content-Encoding", "gzip")
				c.Header("Content-Type", mime.TypeByExtension(path.Ext(p)))
				req := c.Request.Clone(c.Request.Context())
				req.URL.Path += ".gz"
				req.URL.RawPath = ""
				fileServer.ServeHTTP(c.Writer, req)
				return
			}
		}
	}
	fileServer.ServeHTTP(c.Writer, c.Request)
}
