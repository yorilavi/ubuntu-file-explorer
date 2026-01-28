# Roadmap: Ubuntu File Explorer

## Overview

This roadmap delivers a macOS Finder-like SSH file explorer in 6 phases. We start with Electron scaffolding and security foundations, then build SSH connectivity, followed by the core differentiators (Miller column navigation and instant previews), then file operations, and finally polish with favorites and error handling. Each phase delivers a verifiable capability that builds toward the complete browsing experience.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Security** - Electron scaffolding with secure IPC bridge
- [x] **Phase 2: SSH/SFTP Core** - Connect to servers and browse directories
- [x] **Phase 3: Column View Navigator** - Miller column UI with keyboard navigation
- [x] **Phase 4: Preview Panel** - Image and code previews with syntax highlighting
- [x] **Phase 5: File Operations** - Upload, download, and file management
- [x] **Phase 6: Favorites & Polish** - Sidebar bookmarks and UX refinements

## Phase Details

### Phase 1: Foundation & Security
**Goal**: Establish Electron + React + TypeScript project with secure IPC patterns that all subsequent phases build upon
**Depends on**: Nothing (first phase)
**Requirements**: None (infrastructure phase)
**Success Criteria** (what must be TRUE):
  1. Electron app launches and displays a React-rendered window
  2. Main process and renderer communicate via typed IPC (invoke/handle pattern works end-to-end)
  3. Security defaults are enforced (nodeIntegration: false, contextIsolation: true, sandbox: true)
  4. Development build supports hot module reloading
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Create Electron + React + TypeScript foundation with HMR
- [x] 01-02-PLAN.md — Establish typed IPC bridge with contextBridge

### Phase 2: SSH/SFTP Core
**Goal**: User can connect to remote servers and browse directory contents
**Depends on**: Phase 1
**Requirements**: CONN-01, CONN-02, CONN-03
**Success Criteria** (what must be TRUE):
  1. User sees list of servers parsed from ~/.ssh/config
  2. User can add a custom SSH connection and it persists across app restarts
  3. User can connect to a server using SSH key authentication
  4. Connected server shows root directory listing with file names and metadata
  5. Credentials are stored securely (macOS Keychain via safeStorage API)
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Install SSH dependencies and create foundational types/storage
- [x] 02-02-PLAN.md — Create SSH/SFTP services and IPC handlers
- [x] 02-03-PLAN.md — Create server sidebar UI with connection status
- [x] 02-04-PLAN.md — Create directory listing UI with sorting and metadata

### Phase 3: Column View Navigator
**Goal**: User can browse directories in Finder-style Miller columns with keyboard and mouse navigation
**Depends on**: Phase 2
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. Clicking a folder opens its contents in a new column to the right
  2. Arrow keys navigate between files (up/down) and columns (left/right)
  3. Path bar displays current location and allows click-to-navigate
  4. Large directories (1000+ files) render without UI freezing (virtual scrolling)
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Install dependencies and create types/navigation hook
- [x] 03-02-PLAN.md — Create FileItem and Column components with virtualization
- [x] 03-03-PLAN.md — Create ColumnView container with resizable panels
- [x] 03-04-PLAN.md — Create PathBar and integrate into App

### Phase 4: Preview Panel
**Goal**: User sees instant previews of images and code files in a right-side panel
**Depends on**: Phase 3
**Requirements**: PREV-01, PREV-02, PREV-03, PREV-04
**Success Criteria** (what must be TRUE):
  1. Selecting an image file shows thumbnail preview in right panel
  2. Selecting a code/text file shows syntax-highlighted preview in right panel
  3. Pressing spacebar on an image opens enlarged lightbox view
  4. Navigating with arrow keys updates the preview automatically (debounced to prevent thrashing)
  5. Preview loading does not block navigation (async with loading indicator)
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md — Install dependencies, define types, and create disk cache
- [x] 04-02-PLAN.md — Create IPC handlers and extend preload with preview API
- [x] 04-03-PLAN.md — Create usePreview hook and preview components
- [x] 04-04-PLAN.md — Create lightbox and integrate preview panel into App

### Phase 5: File Operations
**Goal**: User can transfer and manage files between local Mac and remote server
**Depends on**: Phase 2 (requires SSH connection, can run in parallel with Phase 3-4 if needed)
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05
**Success Criteria** (what must be TRUE):
  1. User can download a file from server to local Mac
  2. User can upload a file from local Mac to server
  3. User can delete a file or folder on remote server (with confirmation)
  4. User can rename a file on remote server
  5. User can move a file to a different folder on remote server
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Create file operations service with download/upload/delete/rename/move
- [x] 05-02-PLAN.md — Create IPC handlers and extend preload with file operations API
- [x] 05-03-PLAN.md — Add context menu to FileItem and integrate with directory refresh

### Phase 6: Favorites & Polish
**Goal**: User can bookmark folders for quick access and experiences polished error handling
**Depends on**: Phase 3, Phase 5
**Requirements**: ORG-01, ORG-02
**Success Criteria** (what must be TRUE):
  1. User can add a folder to favorites via context menu
  2. Favorites appear in sidebar organized by server
  3. Favorites persist between app sessions
  4. Error messages are user-friendly with suggested actions
  5. User can cancel long-running file operations (download/upload)
**Plans**: 5 plans

Plans:
- [x] 06-01-PLAN.md — Install dependencies and create favorites storage with IPC bridge
- [x] 06-02-PLAN.md — Set up toast notification infrastructure using sonner
- [x] 06-03-PLAN.md — Create collapsible server sections with draggable favorites in sidebar
- [x] 06-04-PLAN.md — Add "Add to Favorites" context menu, wire navigation, and show progress toasts
- [x] 06-05-PLAN.md — Add AbortController cancellation support for file operations

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Security | 2/2 | ✓ Complete | 2026-01-27 |
| 2. SSH/SFTP Core | 4/4 | ✓ Complete | 2026-01-27 |
| 3. Column View Navigator | 4/4 | ✓ Complete | 2026-01-27 |
| 4. Preview Panel | 4/4 | ✓ Complete | 2026-01-28 |
| 5. File Operations | 3/3 | ✓ Complete | 2026-01-28 |
| 6. Favorites & Polish | 5/5 | ✓ Complete | 2026-01-28 |

## Post-v1 Polish (2026-01-28)

Bug fixes and enhancements from user testing:

**Session 2 - Bug Fixes:**
- Fixed CSP blocking image previews (added data:/blob: to img-src)
- Fixed duplicate servers in sidebar
- Fixed favorites not updating sidebar immediately
- Fixed keyboard navigation requiring initial click
- Rewrote column resize system (custom pixel-based instead of react-resizable-panels)
- Added preview panel resize handle
- Increased preview panel max width

**Session 3 - Enhancements:**
- Dynamic preview panel max width (can expand to nearly full width)
- Arrow key navigation in lightbox (browse images while enlarged)

See `.planning/gsd_handoff.md` for full details and code locations.

---
*Created: 2026-01-26*
*Depth: standard (5-8 phases)*
*Requirements: 17 v1 mapped to 6 phases*
