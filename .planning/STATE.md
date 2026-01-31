# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-30)

**Core value:** Browse remote servers visually with instant image and code previews
**Current focus:** v1.2 Folder Operations - Phase 14 in progress

## Current Position

Phase: 14 of 14 (PDF Preview) - IN PROGRESS
Plan: 02 of 03
Status: In progress
Last activity: 2026-01-31 - Completed 14-02-PLAN.md

Progress: [################################] v1.1 Complete + Phase 12-13 complete + 14-01-02 (8/9 v1.2 plans)

## Milestone Summary

**v1.2 Folder Operations** — IN PROGRESS

Goal: Enable full folder transfer in both directions plus PDF preview.

Roadmap:
- Phase 12: Folder Upload (7 requirements) - COMPLETE
- Phase 13: Folder Download (6 requirements) - COMPLETE
- Phase 14: PDF Preview (6 requirements) - 2/3 plans complete
- Total: 19 requirements, 17 complete (89%)

Next: Execute Phase 14 Plan 03 (PDF Lightbox)

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
- Total plans completed: 42 (22 v1.0 + 10 v1.1 + 10 v1.2)
- Total phases: 13 complete, 1 in progress
- Total milestones: 2 complete, 1 in progress

**v1.2 Phase 14 Execution:**
- Duration: In progress
- Plans: 2/3 complete
- Plan 01: 4 min
- Plan 02: 3 min

## Accumulated Context

### Decisions (v1.1+)

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
| Filter hidden files via segment check | 12-01 | Catches .DS_Store and ._* in any path segment |
| Sequential file upload with progress | 12-01 | Simpler than parallel, reliable progress tracking |
| Depth-sorted directory creation | 12-01 | Ensures parents exist before children |
| Dock progress bar during folder upload | 12-02 | Visual feedback in macOS dock |
| Progress includes operationId | 12-02 | Enables tracking of multiple concurrent uploads |
| Subscribe to progress before IPC call | 12-03 | Prevents race condition missing early events |
| Use 'close' event for SFTP WriteStream | 12-03 | ssh2 streams don't reliably emit 'finish' |
| 15-second toast for retry button | 12-03 | Gives users time to review failed files |
| Show current file in progress toast | 12-03 | Detailed visual feedback during upload |
| Mirror folder-upload-service patterns | 13-01 | Consistency between upload and download services |
| Finder-style rename for conflicts | 13-01 | "file (1).ext" pattern for conflict resolution |
| Track file count and byte count | 13-01 | Detailed progress for UI feedback |
| Clean up partial files on cancel/error | 13-01 | Prevents leaving corrupt partial downloads |
| Same progress channel pattern as upload | 13-02 | Consistency across upload/download features |
| Include operationId in progress events | 13-02 | Enables UI to track multiple concurrent operations |
| Dock progress based on file count | 13-02 | Simpler, matches folder upload pattern |
| Default to 'rename' conflict strategy | 13-03 | Finder-style behavior, non-destructive |
| Show both file count and byte size | 13-03 | More informative progress display |
| Clean up entire folder on cancel | 13-03 | Prevents leaving partial downloads on disk |
| pageCount defaults to 0 from backend | 14-01 | Renderer determines with react-pdf |
| isLarge defaults to false from backend | 14-01 | Renderer checks pageCount > 100 |
| Worker config in same file as usage | 14-02 | Avoids import order issues per RESEARCH.md |
| Preload current + 2 adjacent pages | 14-02 | Smooth navigation without memory bloat |
| 100+ pages for large PDF warning | 14-02 | Balance between UX and performance warning |
| Fit Width as default zoom mode | 14-02 | Best fit for preview panel width |

### Technical Notes

All v1.1 features implemented and verified:
- Hidden files toggle with persistence
- Password auth with safeStorage encryption
- Move file with folder picker and undo
- Markdown lightbox with GFM and syntax highlighting
- Large file streaming with virtualization
- Resize handle double-click reset

Phase 12 Complete:
- Plan 01: Backend service with folder enumeration and streaming upload
- Plan 02: IPC handlers and preload API exposed
- Plan 03: UI integration with context menu, progress tracking, and retry

Phase 13 Complete:
- Plan 01: Backend folder download service
  - Types: FolderDownloadProgress, FolderDownloadResult, RemoteFileEntry, ConflictStrategy
  - Service: downloadFolder, cancelFolderDownload, retryFailedDownloads
  - Patterns: recursive enumeration, streaming download, conflict resolution
- Plan 02: IPC handlers and preload API
  - Handlers: file-ops:download-folder, file-ops:cancel-folder-download, file-ops:retry-failed-downloads
  - Preload: downloadFolder, onFolderDownloadProgress, cancelFolderDownload, retryFailedDownloads
  - Shared types: ConflictStrategy, FolderDownloadProgress, FolderDownloadResult
- Plan 03: UI integration
  - "Download Folder..." context menu option
  - Progress toast with file count + byte size
  - Cancel via ESC or button with full cleanup
  - Retry Failed button for partial failures

Phase 14 In Progress:
- Plan 01: Backend types and detection (COMPLETE)
  - PDF type in PreviewData union
  - PDF category in FileTypeInfo
  - PDF detection and preview handler
- Plan 02: PDF Renderer Component (COMPLETE)
  - PDFPreview component with react-pdf
  - Page navigation (prev/next buttons + arrow keys)
  - Zoom controls (fit width/page/actual + percentages)
  - Large PDF warning for 100+ pages
  - Integration into PreviewPanel

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-31
Stopped at: Completed 14-02-PLAN.md
Resume file: None - ready for 14-03-PLAN.md

---
*Last updated: 2026-01-31*
