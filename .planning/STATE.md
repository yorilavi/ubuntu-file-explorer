# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-28)

**Core value:** Browse remote servers visually with instant image and code previews
**Current focus:** v1.1 Feature Completion

## Current Position

Phase: 10 - Markdown Lightbox (IN PROGRESS)
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-01-30 - Completed 10-01-PLAN.md

Progress: [#########.................] v1.1 Phase 10 Plan 1 Complete (7 of ~11 plans)

## Milestone Goal

Complete v1.0 deferred features:
- Hidden files toggle with persistence (Phase 7) - COMPLETE
- Password authentication support (Phase 8) - COMPLETE
- Move file UI with RemoteFolderPicker modal (Phase 9) - COMPLETE
- Markdown lightbox viewer (Phase 10) - IN PROGRESS
- Lazy loading for large code files + resize handle reset (Phase 11)

## Phase 10 Summary

**Goal:** Render markdown files in lightbox with GFM formatting and syntax highlighting

**Plan Status:**
- Plan 01: COMPLETE - Markdown rendering infrastructure
- Plan 02: PENDING - Integration with PreviewPanel and spacebar handler

**Delivered (Plan 01):**
- react-markdown, remark-gfm, github-markdown-css dependencies
- MarkdownRenderer component with GFM support and oneDark syntax highlighting
- MarkdownSlide lightbox wrapper with fixed header and scrollable content
- Extended Lightbox supporting both legacy single-image and new slides array
- openExternal IPC for opening links in system browser

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
- Plans completed: 7 (07-01, 07-02, 08-01, 08-02, 09-01, 09-02, 10-01)
- Duration: 24 min total (3 min + 4 min + 3 min + 3 min + 4 min + 3 min + 4 min)

## Accumulated Context

### Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Default showHiddenFiles to false | 07-01 | Matches macOS Finder default behavior |
| Eye icon open when showing hidden | 07-02 | Common UI convention - "you can see" |
| Hidden files at 50% opacity | 07-02 | Visible but clearly distinguished |
| clearCredential only deletes credential, not connection | 08-01 | Separation of concerns |
| Eye shows when hidden, eye-off when visible | 08-02 | Standard password toggle convention |
| Save password checkbox default checked | 08-02 | Per CONTEXT.md user preference |
| 16px indentation per tree depth level | 09-01 | Clear visual hierarchy in folder tree |
| Auto-expand to source file's parent | 09-01 | User sees current location on modal open |
| Source folder marked with badge, not selectable | 09-01 | Prevents moving file to same location |
| 5-second undo window for move operations | 09-02 | Matches common patterns like Gmail undo |
| Refresh active column after move/undo | 09-02 | Keep view current after file operations |
| Backward compatible Lightbox interface | 10-01 | Supports both legacy src prop and new slides array |
| ExtendedSlide with customType discriminator | 10-01 | Avoids TypeScript conflicts with library types |
| URL validation in openExternal | 10-01 | Only http/https allowed for security |

### Technical Notes

- Hidden files: Cmd+Shift+. shortcut matches macOS Finder behavior - IMPLEMENTED
- Password auth: Complete - eye toggle, save checkbox, stored password handling
- Move file: Complete - context menu, folder picker modal, move IPC, undo toast
- Markdown: Infrastructure complete (MarkdownRenderer, MarkdownSlide, Lightbox extended)
- Lazy loading: Implement viewport-based content loading for large files

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-30 01:10 UTC
Stopped at: Completed 10-01-PLAN.md (Markdown rendering infrastructure)
Resume with: Phase 10 Plan 02 (Markdown lightbox integration)

---
*Last updated: 2026-01-30*
