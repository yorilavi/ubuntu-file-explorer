# Project Research Summary

**Project:** Ubuntu File Explorer v1.2
**Domain:** Electron SSH/SFTP file manager enhancement
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

This research covers adding folder upload/download and PDF preview capabilities to an existing Electron SSH file explorer. The app already handles single-file transfers with streaming, progress tracking, and cancellation - these new features extend proven patterns rather than introducing new architectural concepts.

The recommended approach is minimal new dependencies: ssh2-sftp-client (v12.0.1) for promise-based folder operations wrapping the existing ssh2 connection, and react-pdf (v10.3.0) for PDF rendering. The critical architectural decision for PDF preview is to use Electron's built-in Chromium PDFium renderer via data URLs instead of PDF.js, eliminating 815KB of JavaScript overhead and avoiding memory management complexity. For folder transfers, use file-by-file streaming with the existing transfer queue (10-20 concurrent limit) to prevent OOM crashes - avoid tar/gzip compression which adds server-side extraction complexity without meaningful benefit for typical SSH file explorer use cases.

Key risks are memory explosion from recursive folder enumeration, partial transfer state management, and PDF.js memory leaks if not properly cleaned up. These are all addressable with streaming enumeration, granular progress tracking, and proper React lifecycle cleanup. Overall confidence is HIGH - both features extend well-proven patterns with established libraries.

## Key Findings

### Recommended Stack

Minimal new dependencies required. The existing ssh2 package (v1.17.0 already installed) provides the SFTP foundation. Only two new packages needed:

**Core technologies:**
- **ssh2-sftp-client v12.0.1**: Promise-based SFTP with built-in `uploadDir()`/`downloadDir()` methods, wraps existing ssh2 connection, includes TypeScript definitions
- **react-pdf v10.3.0**: React component for PDF rendering using PDF.js, integrates with existing preview panel pattern (follows react-markdown/react-syntax-highlighter pattern)
- **pdfjs-dist v5.4.530**: PDF.js rendering engine (peer dependency of react-pdf)

**Alternative considered and rejected:**
- **archiver/tar-stream for folder compression**: Rejected due to server-side extraction coordination, temporary storage overhead, all-or-nothing transfer risk, and minimal benefit for typical use cases (<1000 files)

**Why this stack:**
- Reuses existing ssh2 connection (no replacement, just enhancement)
- Promise-based API cleaner than ssh2's callback/stream API
- Built-in progress tracking via `step` callback
- Configurable concurrency (default 10, tunable)

### Expected Features

**Must have (table stakes):**
- Recursive folder upload with structure preservation
- Recursive folder download with structure preservation
- Overall progress indicator (combines per-file progress)
- Per-file progress (reuse existing toast pattern)
- Cancel folder transfer with cleanup of partial files
- Preserve permissions/timestamps (SFTP library handles natively)
- Handle empty directories explicitly
- PDF preview in panel with basic rendering
- PDF page navigation (arrow keys)
- PDF zoom controls (fit width, fit page, actual size)
- Lazy loading for large PDFs (prevent memory crashes)

**Should have (competitive differentiators):**
- Smart hidden file handling (auto-exclude .DS_Store, ._ files from transfers)
- Folder transfer summary toast ("Transferred 45 of 50 files, 5 failed")
- Percentage zoom levels (50%, 75%, 100%, 125%, 150%, 200%, 300%)
- PDF preview in lightbox (Spacebar, reuse existing image lightbox)
- Search within PDF (PDF.js includes text layer support)

**Defer to v2+ (high complexity, not critical):**
- Folder transfer conflict preview UI (start with "replace all" or "skip all")
- Resume interrupted folder transfers (requires state persistence)
- Automatic folder sync/bidirectional sync (massive complexity)
- PDF editing/annotations (this is a viewer not editor)
- Merge folders automatically on conflict (destructive)

**Anti-features (explicitly avoid):**
- Loading entire PDF into memory (use lazy loading)
- Individual file conflict dialogs during transfer (interrupts flow)
- Automatic transfer of all hidden files by default (pollutes server)
- Detailed SFTP error messages (use user-friendly messages)

### Architecture Approach

Both features extend established patterns: folder transfers build on the stream-based file transfer engine with recursive enumeration and progress aggregation, while PDF preview follows the existing type-detection → fetch → render pattern.

**Major components:**

1. **Recursive Directory Enumerator** (Main: file-operations-service.ts) - Streams folder enumeration to avoid loading entire tree into memory, uses async generators for file-by-file discovery
2. **Folder Progress Aggregator** (Main: file-operations-service.ts) - Combines per-file stream progress into overall percentage, tracks files complete/total, reuses existing progress callback pattern
3. **PDF Type Detector & Renderer** (Main: preview-handlers.ts + Renderer: PDFPreview.tsx) - Extends detectFileType() for PDF, uses data URLs with Chromium PDFium rendering (not PDF.js to avoid 815KB overhead)

**Integration points:**
- Folder transfers reuse existing transfer queue (10-20 concurrent limit prevents OOM)
- Progress tracking extends existing Sonner toast pattern
- Cancellation uses existing AbortController pattern
- PDF preview integrates into existing preview panel (type-based component switching)
- Cache pattern reuses existing preview cache for PDFs

**Key architectural decision:**
- PDF rendering uses Electron's built-in Chromium PDFium viewer via embed element with data URLs, NOT PDF.js library
- Rationale: Zero JavaScript overhead, native rendering accuracy, no worker management, no memory leaks
- PDFium has been in Electron since 9.0.0 (May 2020), battle-tested

### Critical Pitfalls

1. **Recursive folder enumeration memory explosion** - ssh2 uses significantly more memory than native tools. Upfront enumeration of 1000+ files can consume gigabytes. Prevention: Use streaming enumeration with async generators, transfer as you discover, not "list all then transfer all"

2. **Partial transfer failure state management** - Some files succeed, others fail (permissions, network, disk space). Without granular tracking, UI shows "complete" when 80% succeeded. Prevention: Track successFiles[], failedFiles[], inProgressFiles[], show final summary with retry option for failed files

3. **Progress tracking accuracy for nested folders** - Naive "50% at file 50 of 100" ignores file sizes. First 49 files = 1KB each, file 50 = 1GB means actually 5% by bytes. Prevention: Use two-pass approach (enumerate to get total bytes, then transfer with accurate percentage) or streaming approach with indeterminate progress

4. **PDF.js memory leaks from missing cleanup** - PDF.js loadingTask objects must be explicitly destroyed. Viewing 20 PDFs without cleanup consumes 5GB+. Prevention: Use useEffect cleanup to call loadingTask.destroy(), ensure single worker instance. **Note:** Using Chromium PDFium instead avoids this entirely.

5. **Breaking existing batching with folder operations** - App batches 10-20 concurrent transfers to prevent OOM. Folder upload spawning one transfer per file ignores this limit, causing OOM regression. Prevention: Integrate folder transfers with existing transfer queue from day one

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Folder Upload (2-3 days)
**Rationale:** Upload is more common than download. Local file enumeration simpler than remote SFTP enumeration. Must integrate with existing transfer queue immediately to prevent OOM regression.

**Delivers:**
- Recursive folder upload with structure preservation
- Overall progress indicator showing files complete/total
- Cancellation with cleanup of partial files
- Smart hidden file filtering (exclude .DS_Store by default)

**Features from FEATURES.md:**
- Recursive folder upload (table stakes)
- Overall progress indicator (table stakes)
- Per-file progress (table stakes, reuse existing)
- Cancel folder transfer (table stakes)
- Smart hidden file handling (differentiator, low complexity)

**Avoids pitfalls:**
- Pitfall 1: Use streaming enumeration (async generators)
- Pitfall 6: Integrate with existing transfer queue (10-20 concurrent limit)
- Pitfall 7: Detect and skip symlinks to prevent infinite loops

**Research flag:** Standard SFTP patterns, no additional research needed

### Phase 2: Folder Download (2-3 days)
**Rationale:** Builds on Phase 1 patterns. Remote enumeration requires SFTP readdir recursion. Same progress aggregation and queue integration logic.

**Delivers:**
- Recursive folder download to local Mac
- Same progress tracking as upload
- Permission preservation (configurable)
- Folder transfer summary toast

**Features from FEATURES.md:**
- Recursive folder download (table stakes)
- Handle empty directories (table stakes)
- Preserve permissions/timestamps (table stakes)
- Folder transfer summary (differentiator)

**Avoids pitfalls:**
- Pitfall 2: Granular failure tracking (successFiles, failedFiles, summary toast)
- Pitfall 3: Accurate progress via total bytes calculation
- Pitfall 9: Permission preservation with UID/GID awareness
- Pitfall 10: Cancellation state management
- Pitfall 12: Conflict resolution (start with "replace all", defer granular UI)

**Research flag:** Standard patterns, no additional research needed

### Phase 3: PDF Preview (1-2 days, can run parallel to Phase 1/2)
**Rationale:** Independent of folder operations. Trivial implementation leveraging existing preview panel patterns and Chromium's built-in PDFium renderer.

**Delivers:**
- PDF preview in existing preview panel
- Basic zoom controls (fit width, fit page, actual size)
- Page navigation with arrow keys
- PDF lightbox view (Spacebar)

**Features from FEATURES.md:**
- Display PDF in preview panel (table stakes)
- Page navigation (table stakes)
- Zoom controls (table stakes)
- Page indicator (table stakes)
- PDF preview in lightbox (differentiator, reuse existing)
- Percentage zoom levels (differentiator)

**Avoids pitfalls:**
- Pitfall 4: Avoided by using PDFium instead of PDF.js (no cleanup needed)
- Pitfall 5: 50MB size limit, show placeholder for larger PDFs
- Pitfall 8: PDFium renders in sandboxed context (secure by default)
- Pitfall 11: Use IPC to pass data from main to renderer, not direct file access

**Uses stack elements:**
- react-pdf v10.3.0 OR direct embed element with data URL (decision point: embed simpler, react-pdf more features)
- Chromium PDFium (built into Electron)

**Implements architecture component:**
- PDF Type Detector (extends detectFileType())
- PDFPreview.tsx component (follows ImagePreview.tsx pattern)

**Research flag:** No additional research needed - pattern is well-established

### Phase Ordering Rationale

- **Sequential for folder ops:** Phase 1 → Phase 2 because download builds on upload patterns (enumeration, progress aggregation, queue integration)
- **Parallel for PDF:** Phase 3 independent, can develop concurrently with folder ops to reduce calendar time
- **Testing after all features:** Integration testing validates folder+PDF together, ensures no memory issues from combined usage

**Total estimated effort:** 5-8 days (1-2 weeks with testing/polish)

**Critical path:** Phase 1 → Phase 2 (sequential), Phase 3 can run in parallel

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1:** ssh2-sftp-client uploadDir() is well-documented, streaming enumeration is standard Node.js pattern
- **Phase 2:** Builds on Phase 1, SFTP readdir is standard, permission handling documented
- **Phase 3:** Electron PDFium rendering is established pattern, multiple tutorials confirm approach

**No phases require additional research** - all patterns are well-documented with HIGH confidence sources.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | ssh2-sftp-client verified v12.0.1 via npm registry, react-pdf verified v10.3.0, existing ssh2 v1.17.0 already in package.json |
| Features | HIGH | SFTP folder transfer patterns from FileZilla/WinSCP/Transmit analysis, PDF preview from macOS Preview/Windows PowerToys behavior |
| Architecture | HIGH | Both features extend existing patterns (streaming transfers, preview panel), Chromium PDFium documented since Electron 9.0.0 |
| Pitfalls | HIGH | Memory issues confirmed by PROJECT.md ("ssh2 uses significantly more memory than native tools"), PDF.js memory leaks confirmed by multiple GitHub issues |

**Overall confidence:** HIGH

### Gaps to Address

**Minor gaps that need validation during implementation:**

- **Exact memory overhead of folder enumeration:** Research indicates streaming enumeration prevents OOM, but exact memory footprint for 1000+ files not benchmarked. Mitigation: Add memory profiling during Phase 1 testing, warn users for folders >500 files
- **PDF page count extraction:** Extracting page count without loading entire PDF requires parsing header. LOW priority - can defer to "PDF Document" without count if complex. Mitigation: Check PDF.js lightweight metadata extraction during Phase 3
- **Cross-platform permission preservation:** UID/GID mapping behavior varies across Linux/macOS/Windows OpenSSH. Research identifies issue but not exact behavior for all combinations. Mitigation: Test on multiple server types during Phase 2, document known limitations

**No critical gaps blocking implementation** - all core patterns are verified.

## Sources

### Primary (HIGH confidence)
- [ssh2-sftp-client npm](https://www.npmjs.com/package/ssh2-sftp-client) - Official package documentation for uploadDir/downloadDir
- [react-pdf GitHub](https://github.com/wojtekmaj/react-pdf) - Official React PDF library documentation
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc) - Official Electron IPC patterns
- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security) - Sandboxing and context isolation best practices
- [Insomnia Learning to Love Electron](https://konghq.com/blog/engineering/learning-to-love-electron) - PDFium vs PDF.js in Electron (production case study)
- PROJECT.md knowledge: "ssh2 uses significantly more memory than native tools", "batching 10-20 concurrent transfers prevents OOM", existing architecture patterns

### Secondary (MEDIUM confidence)
- [How to Upload Folder to SFTP Server with TypeScript](https://www.timsanteford.com/posts/how-to-upload-a-folder-to-an-sftp-server-using-typescript-and-ssh2-sftp-client/) - Implementation patterns for ssh2-sftp-client
- [SFTP Best Practices](https://www.myworkdrive.com/blog/how-to-use-sftp) - File-by-file vs compression tradeoffs
- [Multiple PDF viewer tutorials](https://www.nutrient.io/blog/how-to-build-an-electron-pdf-viewer-with-pdfjs/) - Alternative PDF.js approach
- GitHub issues: react-pdf #504, #305 (memory leaks), #1691 (performance)
- Community consensus from FileZilla, WinSCP, Transmit (SFTP client behavior analysis)

### Tertiary (LOW confidence, needs validation)
- Exact SFTP symlink handling behavior across different servers (varies by implementation)
- PDF.js text layer performance characteristics (not tested at scale)
- IPC message size limits for large data URLs (Chromium default ~128MB, not hard-verified)

---
*Research completed: 2026-01-29*
*Ready for roadmap: yes*
