# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-30)

**Core value:** Browse remote servers visually with instant image and code previews
**Current focus:** v1.2 Folder Operations - roadmap created

## Current Position

Phase: 12 (ready to plan)
Plan: —
Status: Roadmap created, ready for phase planning
Last activity: 2026-01-30 — v1.2 roadmap created

Progress: [########################] v1.1 Complete (11 phases shipped) → v1.2 Phase 12 ready

## Milestone Summary

**v1.2 Folder Operations** — PLANNING

Goal: Enable full folder transfer in both directions plus PDF preview.

Roadmap:
- Phase 12: Folder Upload (7 requirements)
- Phase 13: Folder Download (6 requirements)
- Phase 14: PDF Preview (6 requirements)
- Total: 19 requirements, 100% coverage

Next: `/gsd:plan-phase 12`

---

**v1.1 Feature Completion** — SHIPPED 2026-01-30

Delivered:
- Hidden files toggle with Cmd+Shift+. keyboard shortcut
- Password authentication with safeStorage encryption
- Move file operations with RemoteFolderPicker modal
- Markdown lightbox with GFM rendering
- Lazy loading for large code files (10,000+ lines)
- Double-click reset for resize handles

Stats:
- 5 phases (7-11)
- 10 plans
- 21 requirements
- 74 files changed
- 11,528 lines added

## Performance Metrics

**Velocity (cumulative):**
- Total plans completed: 32 (22 v1.0 + 10 v1.1)
- Total phases: 11
- Total milestones: 2

**v1.1 Execution:**
- Duration: 3 days (2026-01-28 → 2026-01-30)
- Plans: 10
- Phases: 5

## Accumulated Context

### Decisions (v1.1)

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Default showHiddenFiles to false | 07-01 | Matches macOS Finder default behavior |
| Eye icon open when showing hidden | 07-02 | Common UI convention - "you can see" |
| Hidden files at 50% opacity | 07-02 | Visible but clearly distinguished |
| clearCredential only deletes credential | 08-01 | Separation of concerns |
| Eye shows when hidden, eye-off when visible | 08-02 | Standard password toggle convention |
| Save password checkbox default checked | 08-02 | Per CONTEXT.md user preference |
| 16px indentation per tree depth level | 09-01 | Clear visual hierarchy in folder tree |
| Auto-expand to source file's parent | 09-01 | User sees current location on modal open |
| Source folder marked with badge, not selectable | 09-01 | Prevents moving file to same location |
| 5-second undo window for move operations | 09-02 | Matches common patterns like Gmail undo |
| Refresh active column after move/undo | 09-02 | Keep view current after file operations |
| Backward compatible Lightbox interface | 10-01 | Supports both legacy and new slides array |
| ExtendedSlide with customType discriminator | 10-01 | Avoids TypeScript conflicts |
| URL validation in openExternal | 10-01 | Only http/https allowed for security |
| Spacebar toggles lightbox | 10-02 | Consistent with macOS Quick Look UX |
| Disable scrollToZoom in lightbox | 10-02 | Allows content scrolling in markdown |
| Extended code file support | 10-02 | User requested .py support |
| Default column width 220px | 11-02 | Established constant in codebase |
| Default preview width 300px | 11-02 | Matches initial preview panel width |
| Streaming threshold 500 lines | 11-01 | Matches existing MAX_CODE_LINES |
| 50KB initial, 100KB subsequent chunks | 11-01 | Fast initial render, efficient throughput |

### Technical Notes

All v1.1 features implemented and verified:
- Hidden files toggle with persistence
- Password auth with safeStorage encryption
- Move file with folder picker and undo
- Markdown lightbox with GFM and syntax highlighting
- Large file streaming with virtualization
- Resize handle double-click reset

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-30
Stopped at: v1.2 roadmap created
Resume with: `/gsd:plan-phase 12`

---
*Last updated: 2026-01-30*
