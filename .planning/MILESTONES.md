# Project Milestones: Ubuntu File Explorer

## v1.1 Feature Completion (Shipped: 2026-01-30)

**Delivered:** Complete v1.0 backlog with move file UI, markdown lightbox, hidden files toggle, lazy loading, resize reset, and password authentication.

**Phases completed:** 7-11 (10 plans total)

**Key accomplishments:**

- Hidden files toggle with Cmd+Shift+. keyboard shortcut and persistent preference
- Password authentication with encrypted storage via safeStorage and per-server preference
- Move file operations with RemoteFolderPicker modal, tree navigation, and 5-second undo
- Markdown lightbox with GFM rendering, syntax highlighting, and arrow key navigation
- Lazy loading for large code files (10,000+ lines) with streaming and virtualization
- Double-click reset for column and preview panel resize handles

**Stats:**

- 74 files created/modified
- 11,528 lines added (575 removed)
- 5 phases, 10 plans, 21 requirements
- 3 days from v1.0 to ship (2026-01-28 → 2026-01-30)

**Git range:** `feat(07-01)` → `docs(11)`

**What's next:** v1.2 enhancements - folder upload, additional features TBD

---

## v1.0 MVP (Shipped: 2026-01-28)

**Delivered:** A macOS Finder-like SSH file explorer with Miller column navigation, instant image and code previews, and per-server favorites.

**Phases completed:** 1-6 (22 plans total)

**Key accomplishments:**

- Established secure Electron foundation with typed IPC bridge (nodeIntegration: false, contextIsolation: true, sandbox: true)
- Full SSH/SFTP integration with ~/.ssh/config parsing, custom connections, and encrypted credential storage via safeStorage
- Finder-style Miller column navigation with keyboard support, virtual scrolling for 1000+ files, and smart column management
- Instant preview panel for images and code with syntax highlighting, lightbox viewer, and keyboard navigation in lightbox
- Complete file operations: download, upload, delete, rename with progress toasts and ESC cancellation
- Per-server favorites system with drag-to-reorder and persistence across sessions

**Stats:**

- 48 source files created
- 8,227 lines of TypeScript/TSX/CSS
- 6 phases, 22 plans
- 3 days from project start to ship (2026-01-26 → 2026-01-28)

**Git range:** `feat(01-01)` → `feat(ui)`

**What's next:** v1.1 enhancements - Move file UI (requires custom remote folder picker), markdown lightbox viewer, lazy loading for large files

---
