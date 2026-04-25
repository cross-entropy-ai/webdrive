# webdrive

A single-binary file browser that serves any directory over HTTP with a clean web UI. Supports list and gallery views, file preview, download, rename, delete, and batch operations.

## Install

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

## Features

- List and gallery view modes
- File preview (text with syntax highlighting, images, video, audio, PDF)
- Image/video carousel with keyboard and swipe navigation
- Select mode for batch download and delete
- Download files and directories as zip
- Rename and delete files/directories
- Dark mode
- Mobile friendly

## License

MIT
