# Ubuntu File Explorer

## What This Is

A desktop file explorer for browsing remote Ubuntu servers via SSH. It provides a macOS Finder-like experience with column-based navigation, a favorites sidebar for bookmarked folders, and an integrated preview panel for viewing images and code files. Built for personal use to make browsing remote servers as pleasant as browsing local files.

## Core Value

Browse remote servers visually with instant image and code previews — no more `ls` and `scp` for every file.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Parse ~/.ssh/config to list available servers
- [ ] Add and save custom SSH connections
- [ ] Connect to servers with key-based or password authentication
- [ ] Column-based file/folder navigation
- [ ] Keyboard navigation (arrow keys to move through files/folders)
- [ ] Mouse click navigation
- [ ] Per-server favorites sidebar (bookmarked folders, persisted)
- [ ] Right-panel preview for images (JPG, PNG, GIF, etc.)
- [ ] Right-panel preview for text/code files with syntax highlighting
- [ ] Spacebar opens enlarged viewer/lightbox for images
- [ ] Arrow key navigation updates preview in real-time
- [ ] Download files from server to local Mac
- [ ] Upload files from local Mac to server
- [ ] Move/rename files on remote server
- [ ] Delete files on remote server

### Out of Scope

- Video playback — complexity not worth it for v1
- PDF preview — can add later if needed
- Mobile app — desktop only
- Windows/Linux builds — macOS focus for now
- File editing in-app — this is a browser, not an editor
- Terminal/shell access — use dedicated terminal for that

## Context

The user frequently works with remote Ubuntu servers and wants a visual way to browse files and preview images without constantly using terminal commands. The macOS Finder column view is the preferred navigation paradigm. SSH config integration is important to avoid re-entering connection details.

## Constraints

- **Platform**: Electron (cross-platform potential, familiar web stack)
- **SSH**: Must work with existing ~/.ssh/config and SSH keys
- **Storage**: Favorites and custom connections stored locally per-server

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri/native | Familiar web tech, faster to build, good enough performance for file browsing | — Pending |
| Column view over list/icon view | Matches Finder mental model, good for deep directory structures | — Pending |
| Per-server favorites | Servers have different use cases, favorites should be contextual | — Pending |

---
*Last updated: 2026-01-26 after initialization*
