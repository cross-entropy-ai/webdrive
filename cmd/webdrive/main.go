package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cross-entropy-ai/webdrive/server"
	"github.com/spf13/cobra"
)

var (
	flagHost string
	flagPort int
	flagDir  string
)

func main() {
	root := &cobra.Command{
		Use:   "webdrive [path]",
		Short: "Browse files over HTTP from a single Go binary",
		Long:  "webdrive serves the contents of a directory (default: current directory) over HTTP with a React UI.",
		Args:  cobra.MaximumNArgs(1),
		RunE:  run,
	}
	root.Flags().StringVar(&flagHost, "host", "0.0.0.0", "host to bind")
	root.Flags().IntVarP(&flagPort, "port", "p", 8080, "port to listen on")
	root.Flags().StringVarP(&flagDir, "dir", "d", "", "directory to serve (overrides positional arg)")

	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}

func run(cmd *cobra.Command, args []string) error {
	dir := flagDir
	if dir == "" && len(args) > 0 {
		dir = args[0]
	}
	if dir == "" {
		dir = "."
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		return fmt.Errorf("resolve dir: %w", err)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return fmt.Errorf("stat %s: %w", abs, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("%s is not a directory", abs)
	}
	return server.Run(server.Config{
		Host: flagHost,
		Port: flagPort,
		Root: abs,
	})
}
