# Ubuntu File Explorer

## What This Is

A desktop file explorer for browsing remote Ubuntu servers via SSH. It provides a macOS Finder-like experience with Miller column navigation, instant image and code previews with syntax highlighting, markdown lightbox viewer, and per-server favorites for quick access to bookmarked folders. Built for personal use to make browsing remote servers as pleasant as browsing local files.

## Current State

**Shipped:** v1.1 Feature Completion (2026-01-30)

The app is fully functional with all core features plus v1.1 enhancements:
- SSH connection with key and password authentication
- Miller column navigation with hidden files toggle
- Image, code, and markdown preview with lightbox viewer
- File operations (download, upload, rename, delete, move)
- Large file streaming for 10,000+ line files
- Per-server favorites

## Core Value

Browse remote servers visually with instant image and code previews — no more `ls` and `scp` for every file.

## Requirements

### Validated

**v1.0 MVP (2026-01-28)**
- ✓ Parse ~/.ssh/config to list available servers — v1.0
- ✓ Add and save custom SSH connections — v1.0
- ✓ Connect to servers with SSH key authentication — v1.0
- ✓ Column-based file/folder navigation — v1.0
- ✓ Keyboard navigation (arrow keys to move through files/folders) — v1.0
- ✓ Mouse click navigation — v1.0
- ✓ Per-server favorites sidebar (bookmarked folders, persisted) — v1.0
- ✓ Right-panel preview for images (JPG, PNG, GIF, etc.) — v1.0
- ✓ Right-panel preview for text/code files with syntax highlighting — v1.0
- ✓ Spacebar opens enlarged viewer/lightbox for images — v1.0
- ✓ Arrow key navigation updates preview in real-time — v1.0
- ✓ Arrow key navigation in lightbox (browse images while enlarged) — v1.0
- ✓ Download files from server to local Mac — v1.0
- ✓ Upload files from local Mac to server — v1.0
- ✓ Rename files on remote server — v1.0
- ✓ Delete files on remote server — v1.0
- ✓ Smart column scrolling (leftmost columns scroll away, reappear on back nav) — v1.0
- ✓ Column and preview panel widths persist across app restarts — v1.0
- ✓ File transfer progress toasts with cancel option — v1.0

**v1.1 Feature Completion (2026-01-30)**
- ✓ Hidden files toggle with Cmd+Shift+. keyboard shortcut — v1.1
- ✓ Hidden files toggle state persists across sessions — v1.1
- ✓ Password authentication with encrypted storage — v1.1
- ✓ Move files to different folder via folder picker modal — v1.1
- ✓ Markdown lightbox with GFM rendering and syntax highlighting — v1.1
- ✓ Arrow key navigation in markdown lightbox — v1.1
- ✓ Large code files (10,000+ lines) load without UI freeze — v1.1
- ✓ Double-click resize handle to reset column/preview width — v1.1

### Active

**Current Milestone: v1.2 Folder Operations**

Goal: Enable full folder transfer in both directions plus PDF preview.

Target features:
- Upload local folders to remote server
- Download remote folders to local Mac
- PDF file preview in preview panel

### Out of Scope

- Video playback — complexity not worth it, streaming over SSH is hard
- PDF preview — can add later if needed
- Mobile app — desktop only
- Windows/Linux builds — macOS focus for now
- File editing in-app — this is a browser, not an editor
- Terminal/shell access — use dedicated terminal for that
- Folder synchronization — two-way sync is complex
- Cloud storage (S3, GCS) — different auth models, scope creep
- OAuth/SSO — enterprise feature, personal use focus

## Context

Shipped v1.1 with ~19,000 lines TypeScript/TSX/CSS in 100+ source files.

**Tech stack:**
- Electron 40 (nodeIntegration: false, contextIsolation: true, sandbox: true)
- React 19 with Vite HMR
- TypeScript 5.5
- ssh2 for SFTP
- electron-conf for persistence
- safeStorage for credential encryption
- @tanstack/react-virtual for virtualized lists
- Shiki for syntax highlighting
- Sonner for toast notifications
- react-markdown with remark-gfm for markdown rendering

**User feedback themes from testing:**
- Column resize needed to be pixel-based (percentage sizing didn't work)
- Preview panel expansion is useful for large images
- Lightbox navigation is essential for browsing image directories
- Width persistence eliminates repetitive resizing
- Hidden files toggle matches expected macOS behavior

**Known issues:**
- Folder upload needs tar/gzip approach with server-side extraction check

## Constraints

- **Platform**: Electron (cross-platform potential, familiar web stack)
- **SSH**: Must work with existing ~/.ssh/config and SSH keys
- **Storage**: Favorites and custom connections stored locally per-server
- **Security**: safeStorage for credentials (macOS Keychain), no credentials in config files

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri/native | Familiar web tech, faster to build | ✓ Good — shipped in 3 days |
| Column view over list/icon view | Matches Finder mental model | ✓ Good — feels native |
| Per-server favorites | Servers have different use cases | ✓ Good — contextual bookmarks |
| electron-conf over electron-store | CommonJS/ESM compatibility with Electron Forge Vite | ✓ Good — no module issues |
| @vitejs/plugin-react@4.x | v5.x ESM-only, incompatible with Forge | ✓ Good — HMR works perfectly |
| Custom column resize | react-resizable-panels used percentages, needed pixels | ✓ Good — min widths work correctly |
| Base64 data URLs for images | IPC-safe, no blob transfer complexity | ✓ Good — works reliably |
| safeStorage for credentials | macOS Keychain integration | ✓ Good — secure by default |
| Stream-based transfers | Progress callbacks via data event | ✓ Good — real-time progress |
| AbortController for cancellation | Per-operation ID for clean cleanup | ✓ Good — ESC key works |
| Default showHiddenFiles false | Matches macOS Finder default | ✓ Good — expected behavior |
| Spacebar toggles lightbox | Matches macOS Quick Look | ✓ Good — native feel |
| 500 line streaming threshold | Consistent with truncation limit | ✓ Good — smooth large files |
| RemoteFolderPicker for move | Native dialogs can't browse remote | ✓ Good — full control |

---
*Last updated: 2026-01-30 after starting v1.2 milestone*
