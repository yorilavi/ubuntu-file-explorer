# Feature Landscape: Folder Transfer & PDF Preview (v1.2)

**Domain:** SSH/SFTP file manager (Electron desktop app)
**Milestone:** v1.2 Folder Operations
**Researched:** 2026-01-29
**Context:** Subsequent milestone adding folder operations and PDF preview to existing file explorer

---

## Executive Summary

This research focuses on folder transfer and PDF preview features for v1.2 milestone. Based on analysis of SFTP client folder transfer behavior (FileZilla, WinSCP, Transmit, Cyberduck) and PDF preview implementations (macOS Preview, Windows PowerToys, Electron PDF.js integrations), this document categorizes features into table stakes (must-have), differentiators (competitive advantage), and anti-features (deliberately avoid).

**Key findings:**
- Folder transfer table stakes: recursive upload/download, overall progress, cancellation, cleanup
- PDF preview table stakes: render in panel, page navigation, basic zoom, lazy loading
- Smart hidden file handling is a low-complexity differentiator (macOS-specific)
- Conflict resolution UI is complex, defer to simpler "replace all" approach for v1.2
- PDF.js is the clear library choice for Electron PDF rendering

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

### Folder Transfer

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Recursive folder upload** | Standard SFTP `-r` behavior | Medium | Must preserve directory structure |
| **Recursive folder download** | Standard SFTP `-r` behavior | Medium | Must preserve directory structure |
| **Overall progress indicator** | Users need to know total completion status | Medium | Combines per-file progress into overall % |
| **Per-file progress indication** | Users want granular visibility | Low | **Reuse existing file transfer progress** |
| **Ability to cancel folder transfer** | Standard in all file managers | Medium | Must clean up partial files/folders |
| **Preserve permissions/timestamps** | Matches SFTP `-P` flag behavior | Low | SFTP library handles this natively |
| **Handle empty directories** | Edge case that breaks structure | Low | Must explicitly create empty dirs |
| **Clean up partial transfers on cancel** | Prevent orphaned files polluting filesystem | Medium | Delete incomplete files/folders created |

### PDF Preview

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Display PDF in preview panel** | Matches existing image/code preview pattern | Medium | Must integrate with existing preview panel |
| **Page navigation (next/prev)** | Multi-page PDFs require navigation | Low | Arrow keys or buttons |
| **Zoom controls (fit width, fit page, actual size)** | Standard PDF viewer feature | Low | 3 basic zoom modes are sufficient |
| **Page indicator (e.g., "Page 3 of 25")** | Users need to know position in document | Low | Simple text display |
| **Lazy loading for large PDFs** | Prevents memory crashes | High | Only render visible pages + buffer |

---

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Smart hidden file handling** | Auto-exclude .DS_Store, ._ files from transfers | Low | macOS-specific quality of life |
| **Folder transfer summary toast** | "Transferred 45 of 50 files (5 failed)" with details | Low | Better than generic "complete" message |
| **Percentage zoom levels (50-300%)** | Precise control vs just fit modes | Low | Standard PDF viewer feature set |
| **PDF preview in lightbox (Spacebar)** | Consistent with existing image lightbox | Medium | Reuse lightbox pattern from images |
| **Search within PDF** | Useful for long documents | Medium | PDF.js includes text layer support |
| **Folder transfer conflict preview** | Show replace/skip/keep both options per conflict | High | Defer to v1.3, start with "replace all" |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Automatic folder sync/bidirectional sync** | Massive complexity, conflict resolution nightmare | One-way transfers only (upload OR download) |
| **PDF editing (annotations, forms)** | Scope creep, this is a viewer not editor | Read-only preview, open in native app for editing |
| **Merge folders automatically on conflict** | Destructive, users lose data silently | Always prompt with replace/skip/keep both |
| **Transfer all hidden files by default** | Pollutes server with .DS_Store, ._ files | Filter macOS metadata files unless explicitly shown |
| **Load entire PDF into memory** | Crashes on large PDFs (100+ MB) | Lazy load pages, render only visible + buffer |
| **Show detailed SFTP error messages** | Technical jargon confuses users | User-friendly error messages with retry option |
| **Individual file conflict dialogs during transfer** | Interrupts flow, 1000 dialogs for 1000 files | Batch conflict resolution UI (future) or "replace all" (v1.2) |
| **Resume interrupted folder transfers** | Very high complexity, state persistence needed | Defer to v1.3+, network is generally reliable |

---

## Feature Dependencies

```
Folder Transfer Dependencies:
- File upload/download (✓ ALREADY EXISTS) → Folder upload/download
- Progress toasts (✓ ALREADY EXISTS) → Overall folder progress
- Cancel mechanism (✓ ALREADY EXISTS) → Cancel folder transfer
- Hidden files toggle (✓ ALREADY EXISTS) → Smart hidden file filtering

PDF Preview Dependencies:
- Preview panel (✓ ALREADY EXISTS) → PDF preview panel
- Lightbox viewer (✓ ALREADY EXISTS for images) → PDF lightbox
- Arrow key navigation (✓ ALREADY EXISTS) → PDF page navigation
- Spacebar toggle (✓ ALREADY EXISTS) → PDF lightbox toggle
```

---

## MVP Recommendation (v1.2)

### Must Have (Table Stakes)

**Folder Transfer:**
1. ✅ **Folder upload** - Recursive transfer with structure preservation
2. ✅ **Folder download** - Recursive transfer with structure preservation
3. ✅ **Overall progress indicator** - Single progress bar showing total % complete
4. ✅ **Per-file progress** - Reuse existing toast-based file progress
5. ✅ **Cancel folder transfer** - Abort operation, clean up partial transfers
6. ✅ **Handle empty directories** - Explicitly create during transfer

**PDF Preview:**
7. ✅ **PDF preview in panel** - Basic rendering with PDF.js
8. ✅ **PDF page navigation** - Arrow keys for next/prev page
9. ✅ **PDF zoom controls** - Fit width, fit page, actual size
10. ✅ **Lazy loading for PDFs** - Render only visible pages to avoid memory issues

### Nice to Have (Differentiators)

11. ✅ **Smart hidden file handling** - Auto-exclude .DS_Store from uploads (LOW complexity)
12. ✅ **PDF preview in lightbox** - Spacebar to open full-screen PDF viewer (reuse existing)
13. ✅ **Percentage zoom levels** - 50%, 75%, 100%, 125%, 150%, 200%, 300%
14. ✅ **Page indicator** - "Page 3 of 25" display
15. ✅ **Folder transfer summary** - "Transferred 45 of 50 files (5 failed)"

### Defer to Post-v1.2

- **Folder transfer conflict UI**: High complexity, requires pre-transfer scanning and modal UI. Start with "replace all" or "skip all" simpler approach, add granular control in v1.3 if needed.
- **Resume interrupted transfers**: Very high complexity, requires transfer state persistence. Network is generally reliable, not critical for v1.2.
- **Search within PDF**: Medium complexity, nice-to-have but not blocking. PDF.js supports it, but focus on core viewing first.

---

## Implementation Notes

### Folder Transfer Approach

Based on SFTP best practices and existing architecture:

#### Recursive Transfer Algorithm

1. **Walk directory tree** - Enumerate all files and folders
2. **Create directory structure first** - Handle empty directories explicitly
3. **Queue all files for transfer** - Build transfer list with paths
4. **Transfer files sequentially** - Reuse existing file transfer with progress callbacks
5. **Update overall progress** - `(completedFiles / totalFiles) * 100`

#### Hidden File Filtering (macOS-specific)

**Files to exclude when `showHiddenFiles: false` (default):**
- `.DS_Store` - Finder metadata
- `._*` - Resource fork files (AppleDouble format)
- `.Spotlight-V100` - Spotlight index
- `.Trashes` - Trash folder
- `.fseventsd` - File system events
- `.TemporaryItems` - Temporary files

**User override:** Enable "Show Hidden Files" (Cmd+Shift+.) to transfer all files including dotfiles.

#### Error Handling Strategy

| Scenario | Behavior | User Experience |
|----------|----------|-----------------|
| **Per-file failure** | Log error, continue with remaining files | Final summary shows failures |
| **Network failure** | Abort entire operation | Show user-friendly error with retry option |
| **Cleanup on cancel** | Delete partial files/folders created | "Transfer canceled. Cleaned up 12 partial files." |
| **Permissions error** | Skip file, log error, continue | Include in failure summary |

#### Progress Indication

**Reuse existing Sonner toast infrastructure:**
- **Overall progress bar**: `(completedBytes / totalBytes) * 100`
- **Subtext**: "Transferring file 12 of 45: long-filename.txt"
- **Cancel button**: ESC key or click X (reuse existing AbortController pattern)
- **Final toast**: "Transferred 45 of 50 files (5 failed)" with expandable details

### PDF Preview Approach

Based on Electron + PDF.js ecosystem research:

#### Library Choice: PDF.js

**Why PDF.js:**
- Mozilla's open-source PDF renderer (HIGH confidence)
- Well-maintained, current standard for web PDF viewing
- Excellent Electron integration via iframe or direct canvas rendering
- No licensing costs (vs commercial alternatives like PSPDFKit, Nutrient)
- Memory management built-in with lazy loading support

**Implementation Options:**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **PDF.js Express (community)** | Pre-built viewer with controls, easier integration | Heavier bundle, less control | ❌ Not recommended |
| **PDF.js Core + Custom UI** | Lighter bundle, full control, consistent with app style | More implementation work | ✅ **Recommended** |

#### Memory Management Strategy

**Critical for large PDFs (100+ MB):**
- Set `maxPages` limit for concurrent rendering (25 pages max per PDF.js docs)
- Unload pages outside viewport + 2-page buffer
- Use canvas recycling for rendered pages
- Monitor memory usage, clear cache on navigation away from PDF

```typescript
// Pseudo-code for memory management
const VISIBLE_PAGE_BUFFER = 2; // Pages before/after visible page to keep loaded
const MAX_CONCURRENT_PAGES = 25; // PDF.js recommendation

function getPageRangeToLoad(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - VISIBLE_PAGE_BUFFER);
  const end = Math.min(totalPages, currentPage + VISIBLE_PAGE_BUFFER);
  return { start, end };
}

function unloadPagesOutsideRange(loadedPages: Set<number>, range: {start: number, end: number}) {
  loadedPages.forEach(pageNum => {
    if (pageNum < range.start || pageNum > range.end) {
      unloadPage(pageNum); // Free canvas, clear cache
    }
  });
}
```

#### Zoom Implementation

**Standard zoom levels:**

```typescript
const ZOOM_LEVELS = {
  FIT_WIDTH: 'fit-width',   // Scale to match window width
  FIT_PAGE: 'fit-page',     // Scale to fit entire page in view
  ACTUAL_SIZE: 1.0,         // 100% (original size)
  PERCENTAGES: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0] // 50%, 75%, ..., 300%
};
```

**How zoom modes work:**
- **Fit width**: Relative zoom, sets width to match container (dynamic based on window size)
- **Fit page**: Scales entire page to fit viewport (dynamic)
- **Actual size**: Fixed 100% zoom
- **Percentages**: Fixed zoom levels

#### Lightbox Integration

**Reuse existing lightbox modal from images/markdown:**
- Same keyboard shortcuts: Spacebar (toggle), ESC (close), Arrow keys (navigate pages)
- Same modal structure and styling
- Add PDF-specific controls: Zoom buttons, page counter, search (future)

**Benefits of reuse:**
- Consistent UX across preview types
- Minimal additional code
- Users already familiar with lightbox behavior

---

## Complexity Assessment

| Feature | Complexity | Estimated Effort | Dependencies |
|---------|------------|------------------|--------------|
| Folder upload | Medium | 2-3 days | File upload (exists) |
| Folder download | Medium | 2-3 days | File download (exists) |
| Overall progress | Medium | 1-2 days | Progress toasts (exists) |
| Cancel + cleanup | Medium | 1-2 days | AbortController (exists) |
| Smart hidden file filter | Low | 0.5 day | Hidden files toggle (exists) |
| PDF.js integration | Medium | 2-3 days | Preview panel (exists) |
| PDF page navigation | Low | 0.5 day | Arrow key nav (exists) |
| PDF zoom controls | Low | 1 day | None |
| PDF lazy loading | High | 3-4 days | PDF.js core |
| PDF lightbox | Medium | 1-2 days | Lightbox modal (exists) |

**Total estimated effort:** 12-18 days (2-3 weeks)

---

## Confidence Assessment

| Area | Confidence | Source | Notes |
|------|------------|--------|-------|
| Folder transfer patterns | **HIGH** | SFTP standard behavior, well-documented | Multiple SFTP clients follow same patterns |
| Progress indication | **HIGH** | Existing implementation + file manager best practices | Existing toast system proven |
| Hidden file filtering | **HIGH** | macOS Finder behavior is well-known | Clear list of files to exclude |
| Error handling approach | **MEDIUM** | Best practices from managed file transfer systems | WebSearch verified with retry patterns |
| PDF.js for Electron | **HIGH** | Multiple tutorials, active community | Well-established integration pattern |
| PDF memory management | **MEDIUM** | PDF.js docs + community discussions | Not tested at scale, but pattern is clear |
| Zoom level standards | **HIGH** | Adobe and browser PDF viewer patterns | Industry standard zoom modes |
| Conflict resolution UI | **LOW** | Deferred to future, needs UX research | Complex feature, needs dedicated research |

---

## Prior Research Reference

This document extends the original FEATURES.md research (2026-01-26) which covered core SSH file explorer features. That research established:

- **Table stakes**: SSH connection, file operations, transfer management, navigation/UX
- **Differentiators**: Miller column view, preview panel, image preview, syntax highlighting, native macOS design
- **Anti-features**: Terminal integration, folder sync (v1), cloud/multi-protocol, in-app editing, enterprise features

**Connection to v1.2:** Folder transfer and PDF preview build on the established foundation of file operations and preview capabilities. The existing architecture (progress toasts, preview panel, lightbox, keyboard navigation) enables rapid implementation of these features with consistent UX.

---

## Sources

### Folder Transfer Research
- [How To Use SFTP to Securely Transfer Files with a Remote Server | DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-use-sftp-to-securely-transfer-files-with-a-remote-server)
- [Using Sftp -R | JSCAPE](https://www.jscape.com/blog/sftp-r)
- [Best practices for file system transfers | Google Cloud](https://docs.cloud.google.com/storage-transfer/docs/on-prem-agent-best-practices)
- [Using Rclone To Sync Any SFTP Server With SFTP To Go](https://sftptogo.com/blog/rclone-sync-any-sftp-server/)
- [Synchronize Files with FTP Server or SFTP Server :: WinSCP](https://winscp.net/eng/docs/guide_synchronize)
- [Resumable File Upload in JavaScript: Handling Partial Updates | TECH CHAMPION](https://tech-champion.com/programming/javascript/resumable-file-upload-in-javascript-handling-partial-updates-and-one-time-uris/)
- [A Guide to Retry Pattern in Distributed Systems](https://blog.bytebytego.com/p/a-guide-to-retry-pattern-in-distributed)
- [fix: delete partial files on transfer cancellation | LocalSend PR #2493](https://github.com/localsend/localsend/pull/2493)
- [macOS Finder copy progress window behavior | MacRumors Forums](https://forums.macrumors.com/threads/did-apple-remove-the-file-copy-progress-window-from-finder.2328081/)
- [Transfer hidden files / dotfiles with sftp-deploy | Atlassian Community](https://community.atlassian.com/forums/Bitbucket-questions/Transfer-hidden-files-dotfiles-with-sftp-deploy/qaq-p/1570321)

### PDF Preview Research
- [How to build an Electron PDF viewer with PDF.js | Nutrient](https://www.nutrient.io/blog/how-to-build-an-electron-pdf-viewer-with-pdfjs/)
- [How to Build a PDF Viewer with Electron and PDF.js | Apryse](https://apryse.com/blog/electron/how-to-build-an-electron-pdf-viewer)
- [GitHub - praharshjain/Electron-PDF-Viewer](https://github.com/praharshjain/Electron-PDF-Viewer)
- [PowerToys File Explorer Add-ons Utility for Windows | Microsoft Learn](https://learn.microsoft.com/en-us/windows/powertoys/file-explorer)
- [Inside Preview in iOS 26 | Apple Insider](https://appleinsider.com/inside/ios-26/tips/inside-preview-in-ios-26---how-to-edit-pdfs-sign-documents-and-scan-files)
- [Adjusting PDF views | Adobe Acrobat](https://helpx.adobe.com/acrobat/using/adjusting-pdf-views.html)
- [Customize the zoom levels - React PDF Viewer](https://react-pdf-viewer.dev/examples/customize-the-zoom-levels/)
- [Understand lazy loading PDF pages | Study Raid](https://app.studyraid.com/en/read/11535/362631/lazy-loading-pdf-pages)
- [How to Fix Memory Leaks in JavaScript PDF Viewers | Syncfusion Blogs](https://www.syncfusion.com/blogs/post/memory-leaks-in-javascript-pdf-viewer)
- [Performance issues when rendering large PDFs | react-pdf Discussion #1691](https://github.com/wojtekmaj/react-pdf/discussions/1691)
- [Understand handling large PDF files efficiently | Study Raid](https://app.studyraid.com/en/read/11535/362627/handling-large-pdf-files-efficiently)

### Previous Research (2026-01-26)
- [Best SFTP Clients of 2025](https://sftptogo.com/blog/best-sftp-clients-of-2025-secure-fast-file-transfers/)
- [Transmit 5 Official](https://panic.com/transmit/)
- [Cyberduck vs FileZilla](https://www.dreamhost.com/blog/cyberduck-vs-filezilla/)
