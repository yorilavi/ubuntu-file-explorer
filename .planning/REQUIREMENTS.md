# Requirements: Ubuntu File Explorer

**Defined:** 2026-01-28
**Core Value:** Browse remote servers visually with instant image and code previews

## v1.1 Requirements

Requirements for v1.1 Feature Completion milestone. Each maps to roadmap phases.

### File Operations

- [ ] **FILE-01**: User can move a file to a different folder on the server
- [ ] **FILE-02**: User can browse remote folders in a modal to select move destination
- [ ] **FILE-03**: User can navigate up/down folder hierarchy in folder picker
- [ ] **FILE-04**: Move operation shows progress/completion feedback via toast

### Preview & Viewing

- [ ] **PREV-01**: User can press spacebar on .md file to open rendered markdown lightbox
- [ ] **PREV-02**: Markdown renders with proper formatting (headers, lists, code blocks, links)
- [ ] **PREV-03**: User can close markdown lightbox with Escape or click outside
- [ ] **PREV-04**: Markdown lightbox supports arrow key navigation between .md files

### Navigation & Display

- [ ] **NAV-01**: User can toggle visibility of dotfiles (hidden files)
- [ ] **NAV-02**: Hidden files toggle accessible via Cmd+Shift+. keyboard shortcut
- [ ] **NAV-03**: Hidden files toggle state persists across sessions
- [ ] **NAV-04**: Current toggle state visible in UI (toolbar or status bar)
- [ ] **NAV-05**: Large code files (>500 lines) load initial content quickly
- [ ] **NAV-06**: Scrolling in large files triggers incremental loading
- [ ] **NAV-07**: No UI freeze when opening very large code files

### UI Polish

- [ ] **UI-01**: User can double-click column resize handle to reset to default width
- [ ] **UI-02**: User can double-click preview panel resize handle to reset to default width

### Authentication

- [ ] **AUTH-01**: User can connect to server using password authentication
- [ ] **AUTH-02**: Password field appears in connection form when password auth selected
- [ ] **AUTH-03**: Password stored securely via safeStorage
- [ ] **AUTH-04**: Connection remembers auth method preference per server

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
| FILE-01 | Phase 9 | Pending |
| FILE-02 | Phase 9 | Pending |
| FILE-03 | Phase 9 | Pending |
| FILE-04 | Phase 9 | Pending |
| PREV-01 | Phase 10 | Pending |
| PREV-02 | Phase 10 | Pending |
| PREV-03 | Phase 10 | Pending |
| PREV-04 | Phase 10 | Pending |
| NAV-01 | Phase 7 | Pending |
| NAV-02 | Phase 7 | Pending |
| NAV-03 | Phase 7 | Pending |
| NAV-04 | Phase 7 | Pending |
| NAV-05 | Phase 11 | Pending |
| NAV-06 | Phase 11 | Pending |
| NAV-07 | Phase 11 | Pending |
| UI-01 | Phase 11 | Pending |
| UI-02 | Phase 11 | Pending |
| AUTH-01 | Phase 8 | Pending |
| AUTH-02 | Phase 8 | Pending |
| AUTH-03 | Phase 8 | Pending |
| AUTH-04 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-29 after roadmap creation*
