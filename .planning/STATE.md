# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-28)

**Core value:** Browse remote servers visually with instant image and code previews
**Current focus:** v1.1 Feature Completion

## Current Position

Phase: 11 - Performance & Polish (COMPLETE)
Plan: 2 of 2 complete
Status: Phase complete
Last activity: 2026-01-30 - Completed 11-01-PLAN.md

Progress: [############..............] v1.1 Phase 11 Complete (11 of ~11 plans)

## Milestone Goal

Complete v1.0 deferred features:
- Hidden files toggle with persistence (Phase 7) - COMPLETE
- Password authentication support (Phase 8) - COMPLETE
- Move file UI with RemoteFolderPicker modal (Phase 9) - COMPLETE
- Markdown lightbox viewer (Phase 10) - COMPLETE
- Lazy loading for large code files + resize handle reset (Phase 11) - COMPLETE

## Phase 11 Summary

**Goal:** Performance optimizations and UX polish for resize interactions

**Plan Status:**
- Plan 01: COMPLETE - Lazy loading for large code files
- Plan 02: COMPLETE - Double-click reset for resize handles

**Plan 01 Delivered:**
- CodeChunkData interface for streaming code chunks
- streamLargeCodeFile() with UTF-8 boundary handling
- preview:code-chunk IPC channel for progressive loading
- onCodeChunk listener in preload API
- VirtualizedCodePreview component using @tanstack/react-virtual
- CodePreview integration with streaming detection

**Plan 02 Delivered:**
- handleResizeDoubleClick callback in ColumnView.tsx
- Column resize reset to DEFAULT_COLUMN_WIDTH (220px)
- handlePreviewDoubleClick callback in App.tsx
- Preview panel resize reset to DEFAULT_PREVIEW_WIDTH (300px)
- IPC persistence for reset widths (survives app restart)

## Previous Phases

**Phase 10 - Markdown Lightbox (COMPLETE)**
- react-markdown, remark-gfm, github-markdown-css dependencies
- MarkdownRenderer component with GFM support and oneDark syntax highlighting
- MarkdownSlide and CodeSlide lightbox wrappers
- Spacebar toggle, arrow key navigation, position indicator

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
- Plans completed: 11 (07-01, 07-02, 08-01, 08-02, 09-01, 09-02, 10-01, 10-02, 11-01, 11-02)
- Duration: 43 min total

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
| Spacebar toggles lightbox | 10-02 | Consistent with macOS Quick Look UX |
| Disable scrollToZoom in lightbox | 10-02 | Allows content scrolling in markdown/code slides |
| Extended code file support | 10-02 | User requested .py support during verification |
| Default column width 220px | 11-02 | Established constant in codebase |
| Default preview width 300px | 11-02 | Matches initial preview panel width |
| Streaming threshold 500 lines | 11-01 | Matches existing MAX_CODE_LINES truncation |
| 50KB initial, 100KB subsequent chunks | 11-01 | Fast initial render, efficient throughput |

### Technical Notes

- Hidden files: Cmd+Shift+. shortcut matches macOS Finder behavior - IMPLEMENTED
- Password auth: Complete - eye toggle, save checkbox, stored password handling
- Move file: Complete - context menu, folder picker modal, move IPC, undo toast
- Markdown/Code lightbox: Complete - spacebar toggle, arrow navigation, position indicator
- Resize reset: Complete - double-click handlers on column and preview resize handles
- Lazy loading: Complete - streaming chunks, virtualized rendering for 10,000+ line files

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-30 02:55 UTC
Stopped at: Completed Phase 11 - Performance & Polish
Resume with: v1.1 milestone audit and release

---
*Last updated: 2026-01-30*
