# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-06-13

### Fixed

- **SSH config parsing**: Keywords are now read case-insensitively, matching how `ssh` itself behaves
  - A lowercase `identityFile` (or `hostname`/`user`/`port`) is now recognized instead of falling back to SSH-agent auth and failing to connect
  - Stray whitespace around the key path is trimmed
- **macOS auto-install**: The post-build copy to `/Applications` now uses `ditto`, preserving the app bundle's framework symlinks (the previous copy could corrupt the bundle and cause an unresponsive launch)

### Internal

- Added a vitest test setup (`npm test`) with coverage for SSH config parsing

## [1.3.0] - 2026-06-13

### Added

- **Connection Settings**: Review and edit existing connections from the sidebar
  - Gear (⚙) button on each server row in the left panel
  - Edit custom connections: host, port, username, display name, auth method, key path, and saved password
  - Read-only settings view for servers from `~/.ssh/config`

### Changed

- macOS builds now install to `/Applications` automatically after packaging, so Spotlight always launches the latest build

## [1.2.0] - 2026-01-30

### Added

- **Folder Upload**: Upload entire local folders to remote servers recursively
  - Progress tracking with file count and current file name
  - Cancel with ESC key or button
  - Retry failed transfers
  - Automatic .DS_Store filtering when hidden files toggle is off

- **Folder Download**: Download entire remote folders to local Mac recursively
  - Progress tracking with file count and byte size
  - Finder-style conflict resolution (adds suffix for duplicates)
  - Cancel with full cleanup of partial downloads
  - Retry failed transfers

- **PDF Preview**: Preview PDF files in the preview panel
  - Page navigation with arrow keys or buttons
  - Page indicator (e.g., "Page 3 of 25")
  - Zoom controls (fit width, fit page, 50%-200%)
  - Fullscreen lightbox with spacebar
  - Large PDF warning for 100+ page documents

## [1.1.0] - 2026-01-30

### Added

- **Hidden Files Toggle**: Show/hide dotfiles with `Cmd+Shift+.`
  - Preference persists across sessions
  - Visual indicator in toolbar

- **Password Authentication**: Connect with password instead of SSH key
  - Encrypted storage via macOS Keychain (safeStorage)
  - Per-server "remember password" option

- **Move Files**: Move files to different folders on the same server
  - Remote folder picker modal with tree navigation
  - 5-second undo window after move

- **Markdown Lightbox**: Full-screen markdown viewer
  - GitHub Flavored Markdown support
  - Syntax highlighting in code blocks
  - Arrow key navigation between files

- **Large File Streaming**: Handle files with 10,000+ lines
  - Streaming load with virtualized rendering
  - No UI freeze on large files

- **Resize Handle Reset**: Double-click resize handles to reset widths
  - Works for column dividers and preview panel

## [1.0.0] - 2026-01-28

### Added

- **SSH Connection**: Connect to remote servers via SSH
  - Parse `~/.ssh/config` for server list
  - Add custom SSH connections
  - SSH key authentication

- **Miller Column Navigation**: Finder-style column view
  - Keyboard navigation with arrow keys
  - Virtual scrolling for large directories (1000+ files)
  - Smart column management (scroll left columns away)

- **File Preview**: Preview files without downloading
  - Image preview (JPG, PNG, GIF, WebP, etc.)
  - Code preview with syntax highlighting
  - EXIF data display for photos

- **Lightbox Viewer**: Full-screen image viewing
  - Arrow key navigation between images
  - Zoom and pan support

- **File Operations**:
  - Download files to local Mac
  - Upload files from local Mac
  - Rename files on remote server
  - Delete files on remote server
  - Progress toasts with cancel option

- **Per-Server Favorites**: Bookmark folders for quick access
  - Drag to reorder
  - Persists across sessions

- **UI Persistence**:
  - Column widths persist across restarts
  - Preview panel width persists
  - Window size and position persist

[1.3.1]: https://github.com/yorilavi/ubuntu-file-explorer/releases/tag/v1.3.1
[1.3.0]: https://github.com/yorilavi/ubuntu-file-explorer/releases/tag/v1.3.0
[1.2.0]: https://github.com/yorilavi/ubuntu-file-explorer/releases/tag/v1.2
[1.1.0]: https://github.com/yorilavi/ubuntu-file-explorer/releases/tag/v1.1
[1.0.0]: https://github.com/yorilavi/ubuntu-file-explorer/releases/tag/v1.0
