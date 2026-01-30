# Roadmap: Ubuntu File Explorer v1.2

**Milestone:** v1.2 Folder Operations
**Phases:** 12-14 (continues from v1.1 which ended at Phase 11)
**Depth:** Standard
**Created:** 2026-01-30

## Overview

v1.2 adds bidirectional folder transfer capabilities and PDF preview support. Users can upload entire local folders to remote servers, download remote folders to their Mac, and preview PDF documents directly in the preview panel with page navigation and zoom controls.

---

## Phase 12: Folder Upload

**Goal:** Users can upload local folders to remote servers recursively with progress tracking and error recovery.

**Dependencies:** None (uses existing transfer infrastructure from v1.0-v1.1)

**Plans:** 3 plans

Plans:
- [x] 12-01-PLAN.md — Backend folder upload service with recursive mkdir and progress tracking
- [x] 12-02-PLAN.md — IPC handlers and preload API for folder upload
- [x] 12-03-PLAN.md — UI integration with context menu, progress toast, and cancellation

**Requirements:**
- FLDR-01: User can upload a local folder to a remote location recursively
- FLDR-02: Folder structure is preserved on the remote server
- FLDR-03: User sees overall progress (X of Y files) during folder upload
- FLDR-04: User can cancel folder upload with cleanup of partial transfers
- FLDR-05: Empty directories are created on remote during upload
- FLDR-06: .DS_Store and ._ metadata files are excluded when hidden files toggle is off
- FLDR-07: User can see which files failed and retry failed transfers

**Success Criteria:**
1. User can right-click in remote column and select "Upload Folder", which triggers native macOS folder picker and uploads all contents recursively
2. User sees real-time progress showing "Uploading 45 of 120 files" with overall percentage and current file name
3. User can press ESC during upload to cancel, and system cleans up partial transfers with visual confirmation
4. User uploads folder with empty subdirectories, and all empty folders exist on remote server after completion
5. User uploads folder containing .DS_Store files with hidden files toggle off, and these metadata files are not transferred to remote server

---

## Phase 13: Folder Download

**Goal:** Users can download remote folders to local Mac recursively with progress tracking and error recovery.

**Dependencies:** Phase 12 (shares folder traversal and progress tracking patterns)

**Plans:** TBD (to be created during phase planning)

Plans:
- [ ] 13-01-PLAN.md - TBD
- [ ] 13-02-PLAN.md - TBD

**Requirements:**
- FLDR-08: User can download a remote folder to local Mac recursively
- FLDR-09: Folder structure is preserved locally
- FLDR-10: User sees overall progress (X of Y files) during folder download
- FLDR-11: User can cancel folder download with cleanup of partial transfers
- FLDR-12: Empty directories are created locally during download
- FLDR-13: User can see which files failed and retry failed transfers

**Success Criteria:**
1. User can right-click on remote folder and select "Download Folder", which triggers native macOS folder picker and downloads all contents recursively
2. User sees real-time progress showing "Downloading 28 of 95 files" with overall percentage and current file name
3. User can press ESC during download to cancel, and system cleans up partial downloads with visual confirmation
4. User downloads folder with empty subdirectories, and all empty folders exist locally after completion
5. User downloads folder where 3 of 50 files fail, sees list of failed files with error messages, and can click "Retry Failed" to attempt only those transfers again

---

## Phase 14: PDF Preview

**Goal:** Users can preview PDF files in the preview panel with page navigation and zoom controls.

**Dependencies:** None (integrates with existing preview panel from v1.0)

**Plans:** TBD (to be created during phase planning)

Plans:
- [ ] 14-01-PLAN.md - TBD
- [ ] 14-02-PLAN.md - TBD

**Requirements:**
- PDF-01: User can preview PDF files in the preview panel
- PDF-02: User can navigate pages with arrow keys or prev/next buttons
- PDF-03: User sees page indicator (e.g., "Page 3 of 25")
- PDF-04: User can zoom to fit width, fit page, or actual size
- PDF-05: User can open PDF in fullscreen lightbox (spacebar)
- PDF-06: User can zoom to percentage levels (50%, 75%, 100%, 150%, 200%)

**Success Criteria:**
1. User selects PDF file in column view and sees first page rendered in preview panel within 1 second
2. User presses down arrow or clicks "Next Page" button and current page advances to next page with smooth transition
3. User views page 7 of 24-page PDF and sees "Page 7 of 24" indicator displayed in preview panel
4. User clicks zoom dropdown, selects "Fit Width", and PDF page scales to fill preview panel width while maintaining aspect ratio
5. User presses spacebar while PDF is selected and PDF opens in fullscreen lightbox with page navigation and zoom controls persisted

---

## Progress

| Phase | Name | Status | Requirements | Plans |
|-------|------|--------|--------------|-------|
| 12 | Folder Upload | Complete ✅ | FLDR-01, FLDR-02, FLDR-03, FLDR-04, FLDR-05, FLDR-06, FLDR-07 | 3/3 |
| 13 | Folder Download | Not Started | FLDR-08, FLDR-09, FLDR-10, FLDR-11, FLDR-12, FLDR-13 | 0/TBD |
| 14 | PDF Preview | Not Started | PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06 | 0/TBD |

**Overall:** 1/3 phases complete (33%)

---

## Requirement Coverage

| Requirement | Phase | Category | Description |
|-------------|-------|----------|-------------|
| FLDR-01 | 12 | Folder Upload | User can upload a local folder to a remote location recursively |
| FLDR-02 | 12 | Folder Upload | Folder structure is preserved on the remote server |
| FLDR-03 | 12 | Folder Upload | User sees overall progress (X of Y files) during folder upload |
| FLDR-04 | 12 | Folder Upload | User can cancel folder upload with cleanup of partial transfers |
| FLDR-05 | 12 | Folder Upload | Empty directories are created on remote during upload |
| FLDR-06 | 12 | Folder Upload | .DS_Store and ._ metadata files are excluded when hidden files toggle is off |
| FLDR-07 | 12 | Folder Upload | User can see which files failed and retry failed transfers |
| FLDR-08 | 13 | Folder Download | User can download a remote folder to local Mac recursively |
| FLDR-09 | 13 | Folder Download | Folder structure is preserved locally |
| FLDR-10 | 13 | Folder Download | User sees overall progress (X of Y files) during folder download |
| FLDR-11 | 13 | Folder Download | User can cancel folder download with cleanup of partial transfers |
| FLDR-12 | 13 | Folder Download | Empty directories are created locally during download |
| FLDR-13 | 13 | Folder Download | User can see which files failed and retry failed transfers |
| PDF-01 | 14 | PDF Preview | User can preview PDF files in the preview panel |
| PDF-02 | 14 | PDF Preview | User can navigate pages with arrow keys or prev/next buttons |
| PDF-03 | 14 | PDF Preview | User sees page indicator (e.g., "Page 3 of 25") |
| PDF-04 | 14 | PDF Preview | User can zoom to fit width, fit page, or actual size |
| PDF-05 | 14 | PDF Preview | User can open PDF in fullscreen lightbox (spacebar) |
| PDF-06 | 14 | PDF Preview | User can zoom to percentage levels (50%, 75%, 100%, 150%, 200%) |

**Coverage:** 19/19 requirements mapped (100%)

---

## Technical Notes

**Folder Operations:**
- Use raw ssh2 SFTP with recursive mkdir helper (not ssh2-sftp-client)
- Enumerate local folders using native fs.readdir with recursive option
- Create all directories depth-first before uploading files
- Track partial failures at file level for granular retry capability
- Respect showHiddenFiles setting for .DS_Store/._ file exclusion
- Use path.posix.join for remote paths (always forward slashes)

**PDF Preview:**
- Evaluate react-pdf v10.3.0 vs Chromium's built-in PDFium
- Reuse lightbox infrastructure from v1.0-v1.1 (ImageLightbox component)
- PDF zoom controls follow same pattern as image zoom (fit width, fit height, actual size)
- Page navigation follows markdown lightbox arrow key pattern

**Dependencies:**
- Phase 13 can reference folder traversal patterns from Phase 12
- Phase 14 independent (can run in parallel with 12-13 if needed)

---

*Roadmap created: 2026-01-30*
*Milestone: v1.2 Folder Operations*
