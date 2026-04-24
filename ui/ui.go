// Package ui embeds the built frontend (ui/ui/dist) into the binary so
// webdrive ships as a single executable.
package ui

import (
	"embed"
	"io/fs"
)

//go:embed all:ui/dist
var distFS embed.FS

// FS returns the embedded frontend rooted at the dist directory.
func FS() fs.FS {
	sub, err := fs.Sub(distFS, "ui/dist")
	if err != nil {
		panic(err)
	}
	return sub
}
