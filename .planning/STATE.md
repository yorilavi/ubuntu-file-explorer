# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-28)

**Core value:** Browse remote servers visually with instant image and code previews
**Current focus:** v1.1 Feature Completion

## Current Position

Phase: 7 - Hidden Files Toggle
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-01-29 - Completed 07-01-PLAN.md

Progress: [###.................] v1.1 Phase 7 of 11 (Plan 1/2)

## Milestone Goal

Complete v1.0 deferred features:
- Hidden files toggle with persistence (Phase 7) - IN PROGRESS
- Password authentication support (Phase 8)
- Move file UI with RemoteFolderPicker modal (Phase 9)
- Markdown lightbox viewer (Phase 10)
- Lazy loading for large code files + resize handle reset (Phase 11)

## Phase 7 Overview

**Goal:** Users can control visibility of dotfiles with persistent preference

**Requirements:**
- NAV-01: User can toggle visibility of dotfiles (hidden files)
- NAV-02: Hidden files toggle accessible via Cmd+Shift+. keyboard shortcut
- NAV-03: Hidden files toggle state persists across sessions
- NAV-04: Current toggle state visible in UI (toolbar or status bar)

**Plan Status:**
- Plan 01: COMPLETE - Backend preference storage and IPC
- Plan 02: PENDING - Renderer toggle UI and keyboard shortcut

**Success Criteria:**
1. User can press Cmd+Shift+. and hidden files appear/disappear in column view
2. User can see current toggle state in toolbar (icon changes or indicator visible)
3. User closes and reopens app, hidden files setting is preserved
4. Toggle works consistently across all columns in Miller view

## Previous Milestone

**v1.0 MVP - Shipped 2026-01-28**

- 6 phases, 22 plans completed
- 8,227 lines TypeScript/TSX/CSS
- All core features working: SSH connect, Miller columns, previews, file ops, favorites
- Git tag: v1.0

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 22
- Average duration: 4 min
- Total execution time: 1 hour 23 min

**v1.1 Progress:**
- Plans completed: 1 (07-01)
- Duration: 3 min

## Accumulated Context

### Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Default showHiddenFiles to false | 07-01 | Matches macOS Finder default behavior |

### Technical Notes

- Hidden files: Cmd+Shift+. shortcut matches macOS Finder behavior
- Password auth: ssh2 supports password auth natively, add UI and safeStorage path
- Move file: Backend `sftp:moveFile` IPC ready, needs RemoteFolderPicker UI component
- Markdown: Lightbox component exists for images, extend for markdown rendering
- Lazy loading: Implement viewport-based content loading for large files

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-29 19:49 UTC
Stopped at: Completed 07-01-PLAN.md (backend storage)
Resume with: `/gsd:execute-phase 07-hidden-files-toggle` for plan 02

---
*Last updated: 2026-01-29*
