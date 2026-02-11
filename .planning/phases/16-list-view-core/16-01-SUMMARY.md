---
phase: 16-list-view-core
plan: 01
subsystem: ui
tags: [react, css-grid, list-view, sort, context-menu, bem]

# Dependency graph
requires:
  - phase: 15-shared-utilities-metadata
    provides: "formatSize, formatDate, getFileKind utilities and useFileContextMenu hook"
provides:
  - "SortColumn, SortDirection, SortState type definitions"
  - "ListHeader sortable column header component"
  - "ListRow file entry row with metadata, context menu, and inline rename"
  - "ListView.css with CSS Grid layout for header and rows"
affects: [16-02-PLAN, 17-view-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CSS Grid shared grid-template-columns for header/row alignment", "Per-row useFileContextMenu hook pattern for list view"]

key-files:
  created:
    - src/renderer/types/listView.ts
    - src/renderer/components/ListView/ListHeader.tsx
    - src/renderer/components/ListView/ListRow.tsx
    - src/renderer/components/ListView/ListView.css

key-decisions:
  - "Reuse file-item__icon and file-item__context-menu CSS classes from FileItem for visual consistency"
  - "32px row height (vs 28px in Miller columns) for metadata readability"
  - "Scrollbar gutter compensation via padding-right: 29px on header"

patterns-established:
  - "List view CSS Grid: 28px 1fr 80px 160px 140px column template shared between header and rows"
  - "BEM naming: list-header, list-row, list-view with double-dash modifiers"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 16 Plan 01: List View Presentational Components Summary

**Sortable ListHeader and metadata-rich ListRow with CSS Grid layout, context menu integration, and Phase 15 shared utility imports**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T02:29:55Z
- **Completed:** 2026-02-11T02:32:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created SortColumn, SortDirection, SortState types following columnView.ts pattern
- Built ListHeader with 4 sortable columns (Name, Size, Date Modified, Kind) plus icon spacer, with ascending/descending arrow indicators
- Built ListRow integrating all Phase 15 utilities: formatSize for file sizes, formatDate for modification dates, getFileKind for kind labels, and useFileContextMenu for full context menu
- Created ListView.css with identical grid-template-columns on header and rows, scrollbar gutter compensation, and complete selection/focus/hover/hidden/empty/loading states

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sort types and ListHeader component** - `2643c35` (feat)
2. **Task 2: Create ListRow component with context menu and ListView CSS** - `be5ff6b` (feat)

## Files Created/Modified
- `src/renderer/types/listView.ts` - SortColumn, SortDirection, SortState type exports
- `src/renderer/components/ListView/ListHeader.tsx` - Sortable column header row with sort direction indicators
- `src/renderer/components/ListView/ListRow.tsx` - File entry row with icon, name (inline rename), formatted size/date/kind, and context menu via portal
- `src/renderer/components/ListView/ListView.css` - CSS Grid layout with 5-column template, scrollbar gutter compensation, all interactive states

## Decisions Made
- Reused existing `file-item__icon` and `file-item__context-menu` CSS classes from FileItem.css rather than duplicating icon and context menu styles, ensuring visual consistency between Miller column and list views
- Used 32px row height (vs 28px in Miller columns) per research recommendation for metadata readability
- Applied scrollbar gutter compensation (padding-right: 29px) on header per Pitfall 1 from research to prevent column misalignment when scroll appears

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ListHeader and ListRow are self-contained presentational components ready for the ListView container (Plan 16-02) to render
- ListView.css is ready with container, scroll, empty, and loading styles the container will use
- Phase 15 utility integration proven: formatSize, formatDate, getFileKind, and useFileContextMenu all work correctly at the row level

## Self-Check: PASSED

All 4 files verified on disk. Both commit hashes (2643c35, be5ff6b) found in git log.

---
*Phase: 16-list-view-core*
*Completed: 2026-02-11*
