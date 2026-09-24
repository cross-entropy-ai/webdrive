# webdrive

A single-binary file browser that serves any directory over HTTP with a clean web UI. Supports list and gallery views, file preview, download, rename, delete, and batch operations.

## Install

### Homebrew

```bash
brew install cross-entropy-ai/tap/webdrive
```

Upgrade with `brew update && brew upgrade webdrive`. Installs a precompiled
binary for macOS or Linux on amd64 or arm64; Go and Bun are not required.

### Install directly

```bash
curl -sSL https://raw.githubusercontent.com/cross-entropy-ai/webdrive/main/install.sh | bash
```

Or download a binary from [Releases](https://github.com/cross-entropy-ai/webdrive/releases).

## Usage

```bash
# Serve current directory on port 9090
webdrive

# Serve a specific directory
webdrive /path/to/files

# Custom port and host
webdrive -p 8080 --host 127.0.0.1 /path/to/files
```

Then open `http://localhost:9090` in your browser.

When using code-server port forwarding, open `/proxy/9090/` on your code-server
host (keep the trailing slash). Webdrive automatically keeps that prefix for
assets, navigation, previews, downloads, and uploads, including when refreshing
a nested directory. Reverse proxies that strip a path prefix are also supported.

## Features

- List and gallery view modes
- File preview (text with syntax highlighting, images, video, audio, PDF)
- Image/video carousel with keyboard and swipe navigation
- Select mode for batch download and delete
- Download files and directories as zip
- Rename and delete files/directories
- Dark mode
- Mobile friendly

## Development

Requires Go (see `go.mod`), Bun, and Python 3 for release packaging tests.

```bash
make deps       # Install dependencies
make dev        # Start the Go backend and Bun frontend dev server
make test       # Go, TypeScript, Bun, and release packaging checks
make build      # Build the frontend and embed it in ./webdrive
```

`make dev` also requires [Air](https://github.com/air-verse/air). To run without
Air, use `go run ./cmd/webdrive` and `cd ui/ui && bun run dev` in separate terminals.

### Code structure

- `cmd/webdrive`: CLI flags and startup.
- `server`: HTTP routing and handlers grouped by listing, upload, download,
  preview, and mutations. `NewHandler` builds the router independently of the
  listening socket so tests can exercise the real API against temporary files.
- `ui/ui/src/pages/file-browser.tsx`: Page composition and user actions.
- `ui/ui/src/features/files`: File browser components, directory/upload hooks,
  typed file APIs, and file/path utilities.
- `ui/ui/src/lib`: Shared HTTP error handling, URL builders, and formatting.
- `ui/ui/src/components`: Shared UI primitives and application layout.

Frontend tests live beside their modules. Backend API tests cover file lifecycle,
batch operations, validation, and the SPA fallback. CI runs `make test` and the
production build.

Maintainers: see [Publishing a release](docs/releasing.md) for release packaging
and automatic Homebrew tap updates.

## License

MIT
