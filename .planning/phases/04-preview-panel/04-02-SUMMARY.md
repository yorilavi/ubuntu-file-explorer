---
phase: 04-preview-panel
plan: 02
subsystem: ipc
tags: [electron, ipc, sftp, exifr, preview, caching]

# Dependency graph
requires:
  - phase: 04-01
    provides: Preview cache (getCachedFile, cacheFile, isCacheStale)
  - phase: 02-02
    provides: SSH service (getConnection), SFTP wrapper pattern
provides:
  - IPC handlers for preview operations (preview:read-file, preview:folder-info)
  - Preview API in preload (readFilePreview, getFolderInfo, onPreviewProgress)
  - File type detection from extension
  - EXIF metadata extraction for images
affects: [04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SFTP wrapper caching per connection for preview handlers
    - Progress events via mainWindow.webContents.send
    - File type detection by extension mapping

key-files:
  created:
    - src/main/ipc/preview-handlers.ts
  modified:
    - src/main/main.ts
    - src/preload/preload.ts

key-decisions:
  - "File type detection by extension only (no content sniffing)"
  - "Base64 data URLs for image transfer via IPC"
  - "50MB file size limit for previews"
  - "500 line truncation for code previews"

patterns-established:
  - "Preview handler pattern: check cache, stream file, send progress, cache result"
  - "File type categorization: image/code/text/binary"

# Metrics
duration: 4min
completed: 2026-01-28
---

# Phase 4 Plan 2: IPC Handlers and Preload Summary

**IPC bridge for preview operations with SFTP streaming, caching integration, and progress updates**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-28T01:58:51Z
- **Completed:** 2026-01-28T02:02:34Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created preview IPC handlers with file type detection and EXIF extraction
- Integrated with preview-cache for automatic caching and staleness checks
- Exposed preview API to renderer via preload script
- Progress events sent during file streaming for UI feedback

## Task Commits

Each task was committed atomically:

1. **Task 1: Create preview IPC handlers** - `3ac3c5e` (feat)
2. **Task 2: Register preview handlers in main** - `9eba1b4` (feat)
3. **Task 3: Extend preload with preview API** - `3ae2376` (feat)

## Files Created/Modified

- `src/main/ipc/preview-handlers.ts` - IPC handlers for preview:read-file and preview:folder-info
- `src/main/main.ts` - Register preview handlers
- `src/preload/preload.ts` - Expose preview API (readFilePreview, getFolderInfo, onPreviewProgress)

## Decisions Made

- **File type detection by extension only** - Content sniffing would require reading file contents; extension detection is instant and sufficient for common file types
- **Base64 data URLs for images** - Electron IPC safely handles base64 strings; blob transfer is more complex
- **Separate SFTP wrapper cache for previews** - Follows same pattern as ssh-handlers to avoid cross-module coupling
- **Progress events on data chunks** - Stream events provide natural progress updates without additional overhead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed exifr options type error**
- **Found during:** Task 1 (Create preview IPC handlers)
- **Issue:** exifr `ifd0` option requires `FormatOptions` object with `pick` array, not direct string array
- **Fix:** Changed `ifd0: ['Make', 'Model', ...]` to `ifd0: { pick: ['Make', 'Model', ...] }`
- **Files modified:** src/main/ipc/preview-handlers.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 3ac3c5e

**2. [Rule 1 - Bug] Removed unused PreviewType type**
- **Found during:** Task 3 (Extend preload with preview API)
- **Issue:** TypeScript error for unused type declaration
- **Fix:** Removed `type PreviewType = ...` line since PreviewData union already covers all cases
- **Files modified:** src/preload/preload.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 3ae2376

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for TypeScript compilation. No scope creep.

## Issues Encountered

None - plan executed smoothly after type fixes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IPC bridge complete, renderer can now request file previews
- Ready for 04-03: Preview panel component with image/code rendering
- All preview types defined and flowing through IPC

---
*Phase: 04-preview-panel*
*Completed: 2026-01-28*
