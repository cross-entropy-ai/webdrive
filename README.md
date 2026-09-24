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

- Modern light/dark interface with comfortable spacing and responsive list/gallery views
- `/` filters filenames in the current folder (`Enter` opens the best match, `Esc` clears)
- `f` opens a compact fuzzy finder across the Webdrive root and all subfolders, regardless of the current folder or file preview; match filenames or relative paths, use ↑/↓ to select, `Enter` to open, and `Esc` to close. Also available under `…` → Find files. Results show paths and highlighted matches.
- Stable header heights across navigation and view changes, sortable columns, and saved browsing preferences
- Visible upload/new-folder actions and keyboard-friendly dialogs
- Rendered HTML and Markdown previews, with a source view, copy, and line wrapping
- Text/code previews with on-demand syntax highlighting, optional line numbers, and wrapping; text options live in the `…` menu and are remembered
- Images, streaming video/audio, and PDF previews
- Local images and relative document links work behind code-server's port proxy
- Smaller production bundles, compressed/cached assets, and visible loading states
- Image/video carousel with keyboard and swipe navigation
- Select mode for batch download and delete
- Download files and directories as zip
- Rename and delete files/directories
- Dark mode
- Mobile friendly

HTML previews display static content in a sandbox with scripts disabled. Markdown
supports tables, task lists, and fenced code blocks. Text previews show up to 1 MB
to keep large logs responsive; the full file is always available to download.
Archives (including tar/zip), executables, and other known binary formats show a
download prompt without fetching file contents. Unknown formats are checked with
a HEAD request before loading any preview content.

Recursive search streams matches asynchronously as it scans, cancels outdated
queries, reads filenames only, includes hidden folders, and does not follow
symlinks. It returns the best 100 matches; if a scan times out or cannot read some
folders, the finder marks results as partial. Use a more specific filename or
relative path to narrow the matches.

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
