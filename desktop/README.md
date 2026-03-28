# NEXUS Desktop (Tauri 2.x)

Native desktop client wrapping the NEXUS-X web application with VFS mount, DCC launcher, and file sync capabilities.

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) >= 18
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools, WebView2
  - **Linux**: `webkit2gtk-4.1`, `libappindicator3-dev`, `librsvg2-dev`

## Setup

```bash
cd desktop

# Install Tauri CLI (if not already installed)
cargo install tauri-cli --version "^2"

# Start the Next.js dev server (from project root, port 8901)
cd .. && npm run dev

# In another terminal, start the Tauri dev window
cd desktop && cargo tauri dev
```

## Build

```bash
cargo tauri build
```

The packaged application will be in `desktop/src-tauri/target/release/bundle/`.

## Architecture

- `src-tauri/src/main.rs` — Tauri entry point with IPC commands:
  - `vfs_mount` — Mount project directory as VFS workspace
  - `launch_dcc` — Open files with system default / DCC application
  - `file_sync_status` — Check local-vs-remote sync state
- The frontend is served from the Next.js dev server at `localhost:8901` during development.
