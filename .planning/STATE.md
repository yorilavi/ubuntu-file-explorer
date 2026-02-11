# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Browse remote servers visually with instant image and code previews
**Current focus:** Phase 16 - List View Core

## Current Position

Phase: 16 of 17 (List View Core) -- COMPLETE
Plan: 2 of 2 in current phase (all plans complete)
Status: Phase Complete
Last activity: 2026-02-11 — Completed 16-02 ListView container

Progress: [██████░░░░] 57% (4/7 plans)

## Performance Metrics

**Velocity (cumulative):**
- Total plans completed: 41 (22 v1.0 + 10 v1.1 + 9 v1.2)
- Total phases: 14 complete
- Total milestones: 3 complete (v1.0, v1.1, v1.2)

**v1.3 Velocity:**
- Plans completed: 4
- Phases completed: 2/3 (Phase 15, 16 complete)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 15-01 | Context menu hook | 4min | 2 | 2 |
| 15-02 | Shared formatters & file kinds | 3min | 2 | 7 |
| 16-01 | List view presentational components | 2min | 2 | 4 |
| 16-02 | ListView container | 2min | 2 | 3 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.3 roadmap]: 3-phase structure (utilities extraction -> list view core -> view integration)
- [v1.3 roadmap]: Miller column sorting deferred to future milestone (MSORT-01, MSORT-02)
- [v1.3 research]: Context menu hook extraction identified as highest-risk refactor
- [15-01]: ConflictStrategy imported from shared/types (not redefined in hook)
- [15-01]: Ref-based pattern for circular callback dependencies (retry <-> operation handlers)
- [15-01]: formatBytes kept temporarily in hook for 15-02 extraction
- [15-02]: Threshold-based formatSize (not Math.log) for clarity
- [15-02]: formatDate accepts Date | string | undefined for IPC compatibility
- [15-02]: getFileKind uses lastIndexOf for multi-dot filename handling
- [16-01]: Reuse file-item__icon and file-item__context-menu CSS classes for visual consistency across views
- [16-01]: 32px row height for list view (vs 28px Miller columns) for metadata readability
- [16-01]: Scrollbar gutter compensation via padding-right: 29px on list header
- [16-02]: 500ms type-ahead timeout (vs 800ms in useColumnNavigation) for faster search reset
- [16-02]: sortEntries defined outside component as pure function for testability
- [16-02]: ListView callback interface mirrors ColumnView (minus columnIndex on onFileSelect)

### Technical Notes

- SFTP readdir already returns full metadata (size, mtime, permissions) -- no backend changes needed
- Orphaned list view components exist (DirectoryList.tsx, FileRow.tsx) as reference but cannot be used directly
- @tanstack/react-virtual already in project for virtualization
- electron-conf already handles persistence (use showHiddenFiles pattern for view mode)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 16-02-PLAN.md (ListView container -- Phase 16 complete)
Resume file: None

---
*Last updated: 2026-02-11*
