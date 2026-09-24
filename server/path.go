package server

import (
	"errors"
	"path/filepath"
	"strings"
)

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

func validRelPath(p string) bool {
	clean := filepath.Clean(p)
	return clean != ".." && !strings.HasPrefix(clean, "../") && !filepath.IsAbs(clean)
}

func normalize(p string) string {
	if p == "" {
		return "/"
	}
	return filepath.ToSlash(filepath.Clean("/" + p))
}
