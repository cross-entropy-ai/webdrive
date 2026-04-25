#!/bin/sh
set -eu

REPO="cross-entropy-ai/webdrive"
INSTALL_DIR="/usr/local/bin"
BINARY="webdrive"

step() {
  echo "==> $1"
}

sudo_cmd() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

# ── Step 1: Detect platform ──────────────────────────────────

step "Detecting platform"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "    Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

case "$OS" in
  linux|darwin) ;;
  *) echo "    Unsupported OS: $OS" >&2; exit 1 ;;
esac

echo "    OS:   $OS"
echo "    Arch: $ARCH"

# ── Step 2: Fetch latest version ─────────────────────────────

step "Fetching latest version"

TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d '"' -f 4)"
if [ -z "$TAG" ]; then
  echo "    Failed to fetch latest release" >&2
  exit 1
fi

echo "    Version: $TAG"

# ── Step 3: Download binary ──────────────────────────────────

ASSET="${BINARY}-${OS}-${ARCH}"
URL="https://github.com/${REPO}/releases/download/${TAG}/${ASSET}"

step "Downloading ${ASSET}"

curl -fsSL -o "/tmp/${BINARY}" "$URL"
chmod +x "/tmp/${BINARY}"

# ── Step 4: Install ──────────────────────────────────────────

step "Installing to ${INSTALL_DIR}/${BINARY}"

sudo_cmd mv "/tmp/${BINARY}" "${INSTALL_DIR}/${BINARY}"

# ── Done ─────────────────────────────────────────────────────

echo ""
echo "    ${BINARY} ${TAG} installed to ${INSTALL_DIR}/${BINARY}"
echo "    Run 'webdrive' to start."
