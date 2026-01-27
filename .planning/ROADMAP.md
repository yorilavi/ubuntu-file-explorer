# Roadmap: Ubuntu File Explorer

## Overview

This roadmap delivers a macOS Finder-like SSH file explorer in 6 phases. We start with Electron scaffolding and security foundations, then build SSH connectivity, followed by the core differentiators (Miller column navigation and instant previews), then file operations, and finally polish with favorites and error handling. Each phase delivers a verifiable capability that builds toward the complete browsing experience.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Security** - Electron scaffolding with secure IPC bridge
- [ ] **Phase 2: SSH/SFTP Core** - Connect to servers and browse directories
- [ ] **Phase 3: Column View Navigator** - Miller column UI with keyboard navigation
- [ ] **Phase 4: Preview Panel** - Image and code previews with syntax highlighting
- [ ] **Phase 5: File Operations** - Upload, download, and file management
- [ ] **Phase 6: Favorites & Polish** - Sidebar bookmarks and UX refinements

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
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

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
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Column View Navigator
**Goal**: User can browse directories in Finder-style Miller columns with keyboard and mouse navigation
**Depends on**: Phase 2
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. Clicking a folder opens its contents in a new column to the right
  2. Arrow keys navigate between files (up/down) and columns (left/right)
  3. Path bar displays current location and allows click-to-navigate
  4. Large directories (1000+ files) render without UI freezing (virtual scrolling)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

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
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

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
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Favorites & Polish
**Goal**: User can bookmark folders for quick access and experiences polished error handling
**Depends on**: Phase 3, Phase 5
**Requirements**: ORG-01, ORG-02
**Success Criteria** (what must be TRUE):
  1. User can add a folder to favorites via context menu or shortcut
  2. Favorites appear in sidebar organized by server
  3. Favorites persist between app sessions
  4. Error messages are user-friendly with suggested actions
  5. User can cancel long-running operations
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Security | 0/TBD | Not started | - |
| 2. SSH/SFTP Core | 0/TBD | Not started | - |
| 3. Column View Navigator | 0/TBD | Not started | - |
| 4. Preview Panel | 0/TBD | Not started | - |
| 5. File Operations | 0/TBD | Not started | - |
| 6. Favorites & Polish | 0/TBD | Not started | - |

---
*Created: 2026-01-26*
*Depth: standard (5-8 phases)*
*Requirements: 17 v1 mapped to 6 phases*
