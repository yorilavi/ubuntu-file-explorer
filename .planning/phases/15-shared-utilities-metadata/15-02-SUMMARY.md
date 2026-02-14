---
phase: 15-shared-utilities-metadata
plan: 02
subsystem: ui
tags: [typescript, utilities, formatting, metadata, deduplication]

# Dependency graph
requires:
  - phase: 15-01
    provides: useFileContextMenu hook with temporary formatBytes function
provides:
  - "Shared formatSize, formatDate, formatPermissions in src/renderer/utils/formatters.ts"
  - "Shared getFileKind with extension map and known filename handling in src/renderer/utils/fileKinds.ts"
  - "META-01 (size), META-02 (date), META-03 (kind) formatting requirements satisfied"
affects: [16-list-view-core, 17-view-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-utility-extraction, pure-function-utilities]

key-files:
  created:
    - src/renderer/utils/formatters.ts
    - src/renderer/utils/fileKinds.ts
  modified:
    - src/renderer/hooks/useFileContextMenu.ts
    - src/renderer/components/FileRow.tsx
    - src/renderer/components/PreviewPanel/PreviewPanel.tsx
    - src/renderer/components/PreviewPanel/ImagePreview.tsx
    - src/renderer/components/PreviewPanel/PDFPreview.tsx

key-decisions:
  - "Threshold-based formatSize (not Math.log) for clarity and edge-case safety"
  - "formatDate accepts Date | string | undefined for IPC compatibility and null safety"
  - "getFileKind uses lastIndexOf for extension to handle files like archive.tar.gz"

patterns-established:
  - "Shared utilities in src/renderer/utils/ as pure functions with zero framework dependencies"
  - "Named exports only (no default export) for utility modules"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 15 Plan 02: Shared Formatters & File Kinds Summary

**Shared formatSize/formatDate/formatPermissions utilities and getFileKind extension mapper, replacing 8 duplicate functions across 5 consumer files**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-11T01:48:32Z
- **Completed:** 2026-02-11T01:51:37Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 updated)

## Accomplishments
- Created `formatters.ts` with three pure formatting functions (formatSize, formatDate, formatPermissions)
- Created `fileKinds.ts` with comprehensive extension-to-label mapping and known filename handling
- Eliminated 8 duplicate format function definitions across 5 consumer files (net -84 lines)
- All META-01 (size), META-02 (date), META-03 (kind) formatting requirements ready for Phase 16

## Task Commits

Each task was committed atomically:

1. **Task 1: Create formatters.ts and fileKinds.ts utilities** - `7f61ff3` (feat)
2. **Task 2: Replace all duplicate formatters across codebase** - `c84580a` (refactor)

## Files Created/Modified
- `src/renderer/utils/formatters.ts` - Shared formatSize, formatDate, formatPermissions (pure functions)
- `src/renderer/utils/fileKinds.ts` - getFileKind with FILE_KIND_MAP (140+ extensions) and KNOWN_FILENAMES (30+ entries)
- `src/renderer/hooks/useFileContextMenu.ts` - Removed formatBytes, imports formatSize from shared
- `src/renderer/components/FileRow.tsx` - Removed 3 local functions, imports from shared
- `src/renderer/components/PreviewPanel/PreviewPanel.tsx` - Removed formatSize, imports from shared
- `src/renderer/components/PreviewPanel/ImagePreview.tsx` - Removed formatSize/formatDate, imports from shared
- `src/renderer/components/PreviewPanel/PDFPreview.tsx` - Removed formatSize, imports from shared

## Decisions Made
- Used threshold-based if/else for formatSize (not Math.log) for clarity and to avoid floating-point edge cases
- formatDate accepts `Date | string | undefined` to handle IPC serialization and null safety with isNaN guard
- getFileKind uses `lastIndexOf('.')` for extension extraction (not `split('.').pop()`) to handle multi-dot filenames correctly
- FILE_KIND_MAP includes 140+ extensions covering images, documents, code, web, data, text, shell, archives, media, config, fonts, and binaries
- KNOWN_FILENAMES handles both extensionless files (Makefile, Dockerfile, LICENSE) case-insensitively and dotfiles (.gitignore, .prettierrc, .env) with exact match

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 15 complete: both context menu hook (15-01) and shared utilities (15-02) are ready
- Phase 16 (List View Core) can import formatSize, formatDate, formatPermissions, getFileKind directly
- FileRow.tsx already consumes the shared utilities and serves as reference for list view column rendering

## Self-Check: PASSED

- [x] src/renderer/utils/formatters.ts exists
- [x] src/renderer/utils/fileKinds.ts exists
- [x] Commit 7f61ff3 exists
- [x] Commit c84580a exists
- [x] Zero duplicate format functions outside utils/

---
*Phase: 15-shared-utilities-metadata*
*Completed: 2026-02-11*
