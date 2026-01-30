# Requirements: Ubuntu File Explorer

**Defined:** 2026-01-28
**Core Value:** Browse remote servers visually with instant image and code previews

## v1.1 Requirements

Requirements for v1.1 Feature Completion milestone. Each maps to roadmap phases.

### File Operations

- [x] **FILE-01**: User can move a file to a different folder on the server
- [x] **FILE-02**: User can browse remote folders in a modal to select move destination
- [x] **FILE-03**: User can navigate up/down folder hierarchy in folder picker
- [x] **FILE-04**: Move operation shows progress/completion feedback via toast

### Preview & Viewing

- [x] **PREV-01**: User can press spacebar on .md file to open rendered markdown lightbox
- [x] **PREV-02**: Markdown renders with proper formatting (headers, lists, code blocks, links)
- [x] **PREV-03**: User can close markdown lightbox with Escape or click outside
- [x] **PREV-04**: Markdown lightbox supports arrow key navigation between .md files

### Navigation & Display

- [x] **NAV-01**: User can toggle visibility of dotfiles (hidden files)
- [x] **NAV-02**: Hidden files toggle accessible via Cmd+Shift+. keyboard shortcut
- [x] **NAV-03**: Hidden files toggle state persists across sessions
- [x] **NAV-04**: Current toggle state visible in UI (toolbar or status bar)
- [x] **NAV-05**: Large code files (>500 lines) load initial content quickly
- [x] **NAV-06**: Scrolling in large files triggers incremental loading
- [x] **NAV-07**: No UI freeze when opening very large code files

### UI Polish

- [x] **UI-01**: User can double-click column resize handle to reset to default width
- [x] **UI-02**: User can double-click preview panel resize handle to reset to default width

### Authentication

- [x] **AUTH-01**: User can connect to server using password authentication
- [x] **AUTH-02**: Password field appears in connection form when password auth selected
- [x] **AUTH-03**: Password stored securely via safeStorage
- [x] **AUTH-04**: Connection remembers auth method preference per server

## Out of Scope

Explicitly excluded for v1.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Folder upload | Complex (tar/gzip + extraction check), defer to v1.2 |
| Video playback | Streaming over SSH is hard, not core value |
| PDF preview | Can add later if needed |
| OAuth/SSO | Enterprise feature, personal use focus |
| File editing | This is a browser, not an editor |
| Folder sync | Two-way sync is complex |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FILE-01 | Phase 9 | Complete |
| FILE-02 | Phase 9 | Complete |
| FILE-03 | Phase 9 | Complete |
| FILE-04 | Phase 9 | Complete |
| PREV-01 | Phase 10 | Complete |
| PREV-02 | Phase 10 | Complete |
| PREV-03 | Phase 10 | Complete |
| PREV-04 | Phase 10 | Complete |
| NAV-01 | Phase 7 | Complete |
| NAV-02 | Phase 7 | Complete |
| NAV-03 | Phase 7 | Complete |
| NAV-04 | Phase 7 | Complete |
| NAV-05 | Phase 11 | Complete |
| NAV-06 | Phase 11 | Complete |
| NAV-07 | Phase 11 | Complete |
| UI-01 | Phase 11 | Complete |
| UI-02 | Phase 11 | Complete |
| AUTH-01 | Phase 8 | Complete |
| AUTH-02 | Phase 8 | Complete |
| AUTH-03 | Phase 8 | Complete |
| AUTH-04 | Phase 8 | Complete |

**Coverage:**
- v1.1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-30 after Phase 11 completion*
