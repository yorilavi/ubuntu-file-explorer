# Roadmap: Ubuntu File Explorer v1.1

**Milestone:** v1.1 Feature Completion
**Phases:** 7-11 (continues from v1.0 which ended at Phase 6)
**Depth:** Standard
**Created:** 2026-01-29

## Overview

v1.1 completes deferred v1.0 features: move file UI with folder picker, markdown lightbox viewer, hidden files toggle, lazy loading for large code files, resize handle reset, and password authentication. Five phases deliver 21 requirements across file operations, preview enhancements, navigation improvements, UI polish, and authentication.

---

## Phase 7: Hidden Files Toggle

**Goal:** Users can control visibility of dotfiles with persistent preference

**Dependencies:** None (self-contained)

**Plans:** 2 plans

Plans:
- [x] 07-01-PLAN.md - Backend persistence for showHiddenFiles preference
- [x] 07-02-PLAN.md - Toggle UI, keyboard shortcut, and hidden file styling

**Requirements:**
- NAV-01: User can toggle visibility of dotfiles (hidden files)
- NAV-02: Hidden files toggle accessible via Cmd+Shift+. keyboard shortcut
- NAV-03: Hidden files toggle state persists across sessions
- NAV-04: Current toggle state visible in UI (toolbar or status bar)

**Success Criteria:**
1. User can press Cmd+Shift+. and hidden files appear/disappear in column view
2. User can see current toggle state in toolbar (icon changes or indicator visible)
3. User closes and reopens app, hidden files setting is preserved
4. Toggle works consistently across all columns in Miller view

---

## Phase 8: Password Authentication

**Goal:** Users can connect to servers using password authentication as alternative to SSH keys

**Dependencies:** None (extends existing auth system)

**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md - Backend IPC for hasCredential and clearCredential
- [x] 08-02-PLAN.md - Enhanced password UI with visibility toggle and save checkbox

**Requirements:**
- AUTH-01: User can connect to server using password authentication
- AUTH-02: Password field appears in connection form when password auth selected
- AUTH-03: Password stored securely via safeStorage
- AUTH-04: Connection remembers auth method preference per server

**Success Criteria:**
1. User can select "Password" auth method in connection form and enter password
2. User can connect to server using password without SSH key configured
3. User saves connection, reconnects later without re-entering password
4. User's auth method preference (key vs password) is remembered per server

---

## Phase 9: Move File Operations

**Goal:** Users can move files to different folders using a visual folder picker

**Dependencies:** Phase 7 (hidden files affects folder picker display)

**Plans:** 2 plans

Plans:
- [x] 09-01-PLAN.md - RemoteFolderPicker modal with folder tree and breadcrumb
- [x] 09-02-PLAN.md - Context menu integration and toast undo

**Requirements:**
- FILE-01: User can move a file to a different folder on the server
- FILE-02: User can browse remote folders in a modal to select move destination
- FILE-03: User can navigate up/down folder hierarchy in folder picker
- FILE-04: Move operation shows progress/completion feedback via toast

**Success Criteria:**
1. User right-clicks file, selects "Move to...", folder picker modal opens
2. User can navigate folder hierarchy in modal (click folders, go up via breadcrumb)
3. User selects destination, confirms, file disappears from current location
4. User sees toast notification confirming move completed (or error if failed)
5. User navigates to destination folder and finds the moved file

---

## Phase 10: Markdown Lightbox

**Goal:** Users can preview markdown files in a rendered lightbox view

**Dependencies:** None (extends existing image lightbox)

**Plans:** 2 plans

Plans:
- [x] 10-01-PLAN.md - Markdown rendering infrastructure (MarkdownRenderer, MarkdownSlide, openExternal IPC)
- [x] 10-02-PLAN.md - App integration with spacebar trigger, arrow navigation, position indicator

**Requirements:**
- PREV-01: User can press spacebar on .md file to open rendered markdown lightbox
- PREV-02: Markdown renders with proper formatting (headers, lists, code blocks, links)
- PREV-03: User can close markdown lightbox with Escape or click outside
- PREV-04: Markdown lightbox supports arrow key navigation between .md files

**Success Criteria:**
1. User selects .md file, presses spacebar, lightbox opens with rendered markdown
2. User sees headers, bullet lists, code blocks, and links rendered correctly
3. User presses Escape or clicks outside, lightbox closes
4. User presses arrow keys, lightbox navigates to prev/next .md file in directory

---

## Phase 11: Performance & Polish

**Goal:** Large files load without freezing UI, resize handles have quick reset

**Dependencies:** None (independent enhancements)

**Requirements:**
- NAV-05: Large code files (>500 lines) load initial content quickly
- NAV-06: Scrolling in large files triggers incremental loading
- NAV-07: No UI freeze when opening very large code files
- UI-01: User can double-click column resize handle to reset to default width
- UI-02: User can double-click preview panel resize handle to reset to default width

**Success Criteria:**
1. User opens 10,000+ line code file, initial preview appears within 500ms
2. User scrolls in large file, content loads incrementally without stutter
3. User can interact with UI while large file is loading (no freeze)
4. User double-clicks column resize handle, column snaps to default width
5. User double-clicks preview panel resize handle, panel snaps to default width

---

## Progress

| Phase | Name | Status | Requirements |
|-------|------|--------|--------------|
| 7 | Hidden Files Toggle | Complete | NAV-01, NAV-02, NAV-03, NAV-04 |
| 8 | Password Authentication | Complete | AUTH-01, AUTH-02, AUTH-03, AUTH-04 |
| 9 | Move File Operations | Complete | FILE-01, FILE-02, FILE-03, FILE-04 |
| 10 | Markdown Lightbox | Complete | PREV-01, PREV-02, PREV-03, PREV-04 |
| 11 | Performance & Polish | Pending | NAV-05, NAV-06, NAV-07, UI-01, UI-02 |

**Total:** 5 phases, 21 requirements

## Requirement Coverage

All 21 v1.1 requirements mapped:

| Requirement | Phase | Category |
|-------------|-------|----------|
| NAV-01 | 7 | Hidden Files Toggle |
| NAV-02 | 7 | Hidden Files Toggle |
| NAV-03 | 7 | Hidden Files Toggle |
| NAV-04 | 7 | Hidden Files Toggle |
| AUTH-01 | 8 | Password Authentication |
| AUTH-02 | 8 | Password Authentication |
| AUTH-03 | 8 | Password Authentication |
| AUTH-04 | 8 | Password Authentication |
| FILE-01 | 9 | Move File Operations |
| FILE-02 | 9 | Move File Operations |
| FILE-03 | 9 | Move File Operations |
| FILE-04 | 9 | Move File Operations |
| PREV-01 | 10 | Markdown Lightbox |
| PREV-02 | 10 | Markdown Lightbox |
| PREV-03 | 10 | Markdown Lightbox |
| PREV-04 | 10 | Markdown Lightbox |
| NAV-05 | 11 | Performance & Polish |
| NAV-06 | 11 | Performance & Polish |
| NAV-07 | 11 | Performance & Polish |
| UI-01 | 11 | Performance & Polish |
| UI-02 | 11 | Performance & Polish |

**Coverage:** 21/21 requirements mapped (100%)

---
*Roadmap created: 2026-01-29*
*Milestone: v1.1 Feature Completion*
