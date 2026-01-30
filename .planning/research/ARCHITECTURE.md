# Architecture Integration: Folder Transfer & PDF Preview

**Milestone:** v1.2 Folder Operations
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

This document defines how folder upload/download and PDF preview integrate with the existing Electron SSH file explorer architecture. Both features extend established patterns: folder transfers build on the stream-based file transfer engine with recursive enumeration and progress aggregation, while PDF preview follows the existing type-detection → fetch → render pattern using browser-native rendering.

**Key architectural decision:** PDF rendering uses Electron's built-in Chromium PDF viewer (PDFium-based since Electron 9.0.0) via data URLs, avoiding the 815KB JavaScript overhead of PDF.js and its memory management complexity.

---

## Integration Points with Existing Architecture

### Current Architecture Recap

```
Main Process (Node.js with SSH2)
├── SSH Connection Manager
├── SFTP Session Handler (ssh2-sftp-client wrapper)
├── File Transfer Engine (stream-based, AbortController cancellation)
├── IPC Handlers (invoke/handle pattern)
└── Preview Cache

Renderer Process (React 19, sandbox: true)
├── Column View Navigator (Miller columns)
├── Preview Panel (image, code, markdown)
├── Lightbox Viewer (image and markdown)
└── Toast Notifications (Sonner)

IPC Bridge (typed preload)
├── file-ops:download / file-ops:upload
├── preview:read-file / preview:folder-info
├── file-ops:progress (Main → Renderer event)
└── preview:code-chunk (Main → Renderer event for streaming)
```

### New Components Required

| Component | Location | Integration Point |
|-----------|----------|-------------------|
| **Recursive Directory Enumerator** | Main: file-operations-service.ts | Extends existing file transfer functions |
| **Folder Progress Aggregator** | Main: file-operations-service.ts | Uses existing progress callback pattern |
| **Folder Picker Dialog Handler** | Main: file-operations-handlers.ts | Extends existing dialog patterns |
| **PDF Type Detector** | Main: preview-handlers.ts | Extends existing detectFileType() |
| **PDF Renderer** | Renderer: PreviewPanel/PDFPreview.tsx | New component following ImagePreview.tsx pattern |
| **Folder Transfer UI** | Renderer: FileItem.tsx context menu | Extends existing upload/download actions |

---

## Folder Transfer Architecture

### Pattern: Recursive Enumeration + Stream Aggregation

Folder transfers extend the existing stream-based transfer pattern with recursive directory enumeration and aggregated progress tracking.

#### Data Flow

```
User initiates folder upload/download
         │
         ▼
Renderer calls api.uploadFolder() / api.downloadFolder()
         │
         ▼
Main process enumerates directory tree recursively
         │
         ├─ Build file list with relative paths
         ├─ Calculate total size for progress
         └─ Generate operation ID
         │
         ▼
Main process transfers files sequentially with shared progress callback
         │
         ├─ Current file progress (0-100%)
         ├─ Overall progress (files complete / total files)
         └─ Aggregate bytes transferred / total bytes
         │
         ▼
Main emits 'file-ops:progress' events with aggregated progress
         │
         ▼
Renderer receives progress via onFileOperationProgress callback
         │
         ▼
Toast displays: "Uploading folder (5/20 files, 45%)"
         │
         ▼
Transfer complete or cancelled via AbortController
```

#### Recursive Enumeration Algorithm

**Main Process: file-operations-service.ts**

```typescript
interface FolderEnumerationResult {
  files: Array<{
    relativePath: string;
    fullPath: string;
    size: number;
  }>;
  totalSize: number;
  totalFiles: number;
}

// For local folder upload
async function enumerateLocalFolder(
  basePath: string
): Promise<FolderEnumerationResult> {
  const files: Array<{ relativePath: string; fullPath: string; size: number }> = [];
  let totalSize = 0;

  async function walk(currentPath: string, relativeTo: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(relativeTo, fullPath);

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        await walk(fullPath, relativeTo);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        files.push({ relativePath, fullPath, size: stats.size });
        totalSize += stats.size;
      }
      // Skip symlinks to avoid loops
    }
  }

  await walk(basePath, basePath);
  return { files, totalSize, totalFiles: files.length };
}

// For remote folder download
async function enumerateRemoteFolder(
  sftp: SFTPWrapper,
  basePath: string
): Promise<FolderEnumerationResult> {
  const files: Array<{ relativePath: string; fullPath: string; size: number }> = [];
  let totalSize = 0;

  async function walk(currentPath: string, relativeTo: string) {
    const entries = await new Promise<FileEntry[]>((resolve, reject) => {
      sftp.readdir(currentPath, (err, list) => err ? reject(err) : resolve(list));
    });

    for (const entry of entries) {
      const fullPath = path.posix.join(currentPath, entry.filename);
      const relativePath = path.posix.relative(relativeTo, fullPath);

      if (entry.attrs.isDirectory()) {
        await walk(fullPath, relativeTo);
      } else if (entry.attrs.isFile()) {
        files.push({ relativePath, fullPath, size: entry.attrs.size });
        totalSize += entry.attrs.size;
      }
    }
  }

  await walk(basePath, basePath);
  return { files, totalSize, totalFiles: files.length };
}
```

**Key considerations:**
- Skip symlinks to avoid infinite loops
- Use path.posix for remote paths (always forward slashes)
- Use path.join/path.relative for local paths (OS-aware)
- Enumeration happens upfront before transfer starts (enables accurate progress)

#### Progress Aggregation Pattern

```typescript
async function uploadFolder(
  serverId: string,
  localFolderPath: string,
  remoteDir: string,
  operationId: string,
  onProgress: (percent: number, filesComplete: number, totalFiles: number) => void
): Promise<{ remotePath: string; operationId: string }> {
  const sftp = await getSFTPWrapper(serverId);
  const controller = new AbortController();
  activeOperations.set(operationId, controller);

  // 1. Enumerate all files upfront
  const { files, totalSize, totalFiles } = await enumerateLocalFolder(localFolderPath);

  let bytesTransferred = 0;
  let filesComplete = 0;

  try {
    // 2. Transfer files sequentially
    for (const file of files) {
      if (controller.signal.aborted) {
        throw new Error('Operation cancelled');
      }

      // Create remote directory structure as needed
      const remoteDirPath = path.posix.join(
        remoteDir,
        path.dirname(file.relativePath)
      );
      await ensureRemoteDirectory(sftp, remoteDirPath);

      // Transfer file with per-file progress
      await uploadFile(serverId, file.fullPath, remoteDirPath, undefined, (filePercent) => {
        // Aggregate progress: bytes from completed files + current file progress
        const currentFileBytes = Math.round((filePercent / 100) * file.size);
        const totalBytesNow = bytesTransferred + currentFileBytes;
        const overallPercent = Math.round((totalBytesNow / totalSize) * 100);

        onProgress(overallPercent, filesComplete, totalFiles);
      });

      // File complete
      bytesTransferred += file.size;
      filesComplete++;
      onProgress(Math.round((bytesTransferred / totalSize) * 100), filesComplete, totalFiles);
    }

    const folderName = path.basename(localFolderPath);
    const remotePath = path.posix.join(remoteDir, folderName);
    return { remotePath, operationId };
  } finally {
    activeOperations.delete(operationId);
  }
}
```

**Progress granularity:**
- Overall percentage: aggregates bytes from all files
- File count: "5/20 files" for user-visible progress
- Current file progress: smooth updates within each file transfer

#### Cancellation Integration

Folder transfers reuse the existing AbortController pattern:

```typescript
// User clicks cancel in toast
api.cancelOperation(operationId);

// Main process
function cancelOperation(operationId: string): boolean {
  const controller = activeOperations.get(operationId);
  if (controller) {
    controller.abort(); // Stops current file transfer immediately
    activeOperations.delete(operationId);
    return true;
  }
  return false;
}
```

**Behavior:**
- Cancellation stops the current file transfer mid-stream
- Partial folder upload/download leaves some files transferred
- Cleanup removes partial current file (existing pattern)
- No retry logic needed (user can re-initiate)

### New IPC Channels

| Channel | Direction | Purpose | Parameters |
|---------|-----------|---------|------------|
| `file-ops:upload-folder` | Renderer → Main | Upload local folder to remote server | serverId, localPath, remoteDir |
| `file-ops:download-folder` | Renderer → Main | Download remote folder to local Mac | serverId, remotePath, folderName |

**Response format (matches existing FileOperationResult):**

```typescript
interface FileOperationResult {
  success: boolean;
  path?: string;
  error?: string;
  operationId?: string;
  cancelled?: boolean;
}
```

**Progress events (reuse existing channel):**

```typescript
// Main → Renderer via 'file-ops:progress'
interface FolderProgress extends TransferProgress {
  filePath: string;          // Current file being transferred
  filesComplete: number;     // Files successfully transferred
  totalFiles: number;        // Total files in folder
}
```

### UI Integration Points

#### FileItem.tsx Context Menu Extension

```typescript
// Existing context menu actions
const menuItems = [
  { label: 'Download', action: handleDownload },
  { label: 'Upload File', action: handleUpload },
  // NEW: Add folder operations
  { label: 'Upload Folder...', action: handleUploadFolder, disabled: !isDirectory },
  { label: 'Download Folder', action: handleDownloadFolder, hidden: !isDirectory },
  { label: 'Rename', action: handleRename },
  { label: 'Delete', action: handleDelete },
];
```

#### Toast Progress Display

```typescript
// Renderer: Modify existing progress toast to show folder context
const showFolderTransferProgress = (
  type: 'upload' | 'download',
  folderName: string,
  operationId: string
) => {
  toast.promise(
    () => transferPromise,
    {
      loading: ({ filesComplete, totalFiles, percent }) =>
        `${type === 'upload' ? 'Uploading' : 'Downloading'} ${folderName} (${filesComplete}/${totalFiles} files, ${percent}%)`,
      success: `${folderName} ${type === 'upload' ? 'uploaded' : 'downloaded'}`,
      error: 'Transfer failed',
      action: {
        label: 'Cancel',
        onClick: () => api.cancelOperation(operationId),
      },
    }
  );
};
```

### Memory Management Considerations

**Folder size limits:**
- No hard limit on folder size (sequential transfer prevents memory issues)
- Enumeration phase: O(n) memory where n = number of files (lightweight metadata only)
- Transfer phase: O(1) memory (one file at a time, streaming)

**Large folder scenarios:**
- 1,000 files: ~100KB enumeration overhead (negligible)
- 10,000 files: ~1MB enumeration overhead (acceptable)
- 100,000 files: ~10MB enumeration overhead (still acceptable, rare on servers)

**Optimization:** If enumeration overhead becomes an issue, implement streaming enumeration (enumerate directories on-demand as files transfer). Current upfront enumeration is simpler and provides better UX (accurate progress from start).

---

## PDF Preview Architecture

### Pattern: Browser-Native Rendering via Data URLs

PDF preview extends the existing preview pattern (type detection → fetch → render) using Electron's built-in Chromium PDF viewer instead of PDF.js.

#### Why Not PDF.js?

| Factor | PDF.js | Chromium PDFium (Native) |
|--------|--------|--------------------------|
| **JavaScript size** | 815KB (190KB frontend + 624KB worker) | 0KB (built into Chromium) |
| **Parse/compile time** | Significant (45,971 lines of JS) | Instant (native code) |
| **Memory overhead** | High (separate worker process) | Low (native rendering) |
| **Rendering accuracy** | Good | Excellent (Chrome's PDF engine) |
| **Maintenance** | Requires updates | Maintained by Chromium team |
| **Integration complexity** | Moderate (worker setup) | Trivial (data URL or blob URL) |

**Decision:** Use Chromium's built-in PDF viewer. It's been available since Electron 9.0.0 (May 2020) and provides superior performance and accuracy with zero JavaScript overhead.

Sources:
- [Insomnia Tale of Learning to Love Electron](https://konghq.com/blog/engineering/learning-to-love-electron) - Documents dropping PDF.js for PDFium in Electron
- [How to build an Electron PDF viewer with PDF.js](https://pspdfkit.com/blog/2021/how-to-build-an-electron-pdf-viewer-with-pdfjs/) - Alternative approach with PDF.js
- [Comparing the best React PDF viewers for developers](https://www.nutrient.io/blog/top-react-pdf-viewers/) - PDFium advantages

#### Data Flow

```
User selects PDF file in column view
         │
         ▼
PreviewPanel calls api.readFilePreview(serverId, filePath, fileName, fileSize)
         │
         ▼
Main process detects type: 'pdf' via extension
         │
         ▼
Main process checks cache, fetches via SFTP if cache miss
         │
         ▼
Main process creates data URL: `data:application/pdf;base64,${buffer.toString('base64')}`
         │
         ▼
Main returns { type: 'pdf', dataUrl, fileSize }
         │
         ▼
Renderer receives preview data
         │
         ▼
PDFPreview.tsx renders: <embed src={dataUrl} type="application/pdf" />
         │
         ▼
Chromium PDFium renders PDF natively in preview panel
```

#### Type Detection Extension

**Main Process: preview-handlers.ts**

```typescript
function detectFileType(filename: string): FileTypeInfo {
  const ext = filename.toLowerCase().split('.').pop() || '';

  // Image extensions
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
  if (imageExts.includes(ext)) {
    return { category: 'image', mimeType: mimeMap[ext] || 'image/unknown' };
  }

  // PDF extension (NEW)
  if (ext === 'pdf') {
    return { category: 'pdf', mimeType: 'application/pdf' };
  }

  // Code/text extensions...
  // (existing code)
}
```

#### Preview Data Extension

**Shared Types: src/shared/types.ts**

```typescript
export type PreviewData =
  | { type: 'image'; dataUrl: string; metadata: ImageMetadata; fileSize: number; mimeType: string }
  | { type: 'code'; content: string; language: string; lineCount: number; truncated: boolean }
  | { type: 'pdf'; dataUrl: string; fileSize: number; pageCount?: number } // NEW
  | { type: 'folder'; name: string; itemCount: number; totalSize: number }
  | { type: 'binary'; name: string; fileSize: number; mimeType: string }
  | { type: 'too-large'; name: string; fileSize: number }
  | { type: 'error'; message: string }
  | { type: 'loading'; progress: number };
```

**Note:** `pageCount` is optional because extracting page count from PDF requires parsing (not essential for MVP, can show "PDF Document" without page count).

#### PDF Renderer Component

**Renderer: PreviewPanel/PDFPreview.tsx**

```typescript
import React from 'react';

interface PDFPreviewProps {
  dataUrl: string;
  fileSize: number;
  pageCount?: number;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({
  dataUrl,
  fileSize,
  pageCount
}) => {
  return (
    <div className="pdf-preview">
      {/* Header with metadata */}
      <div className="pdf-preview-header">
        <span className="pdf-icon">📄</span>
        <span className="pdf-info">
          PDF Document
          {pageCount && ` • ${pageCount} pages`}
          {` • ${formatFileSize(fileSize)}`}
        </span>
      </div>

      {/* Native PDF embed */}
      <embed
        src={dataUrl}
        type="application/pdf"
        className="pdf-preview-embed"
        style={{ width: '100%', height: 'calc(100% - 40px)' }}
      />
    </div>
  );
};
```

**Integration in PreviewPanel.tsx:**

```typescript
function PreviewPanel({ selectedFile }: PreviewPanelProps) {
  const { preview, loading } = usePreview(selectedFile);

  if (loading) return <LoadingSpinner />;
  if (!preview) return <EmptyState />;

  switch (preview.type) {
    case 'image':
      return <ImagePreview {...preview} />;
    case 'code':
      return <CodePreview {...preview} />;
    case 'pdf': // NEW
      return <PDFPreview {...preview} />;
    case 'folder':
      return <FolderInfo {...preview} />;
    // ... other cases
  }
}
```

#### Memory Management for PDFs

**File size limit (existing):**
- MAX_PREVIEW_SIZE = 50MB (from preview-handlers.ts)
- Applies to PDFs same as images/code files

**Memory considerations:**

| PDF Size | Base64 Overhead | Data URL Size | Memory Impact |
|----------|----------------|---------------|---------------|
| 1MB | 1.33MB | 1.33MB | Low (typical) |
| 10MB | 13.3MB | 13.3MB | Moderate |
| 50MB | 66.5MB | 66.5MB | High (limit) |

**Base64 encoding overhead:** 33% size increase (4 chars per 3 bytes)

**Optimization opportunities (not MVP):**
1. Use Blob URLs instead of data URLs to avoid base64 overhead
2. Implement progressive loading for large PDFs (first page only)
3. Add dedicated PDF size limit lower than general preview limit

**MVP approach:** Use data URLs (consistent with existing image preview pattern). 50MB limit is reasonable for typical server PDFs.

#### Cache Integration

PDFs use the existing preview cache pattern:

```typescript
// Main Process: preview-handlers.ts (in readFilePreview handler)
if (fileType.category === 'pdf') {
  // Check cache first
  const cached = await getCachedFile(serverId, filePath);
  if (cached && !isCacheStale(sftp, filePath, cached.mtime, cached.size)) {
    const dataUrl = `data:application/pdf;base64,${cached.data.toString('base64')}`;
    return { type: 'pdf', dataUrl, fileSize: cached.size };
  }

  // Fetch, cache, return
  const buffer = await fetchFileViaSFTP(sftp, filePath);
  await cacheFile(serverId, filePath, buffer, mtime, size);
  const dataUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
  return { type: 'pdf', dataUrl, fileSize: buffer.length };
}
```

**Cache behavior:**
- PDFs cached same as images (LRU cache with mtime staleness check)
- No special handling needed
- Base64 encoding happens on read, not on cache write (buffer cached)

#### No Lightbox for PDFs

Unlike images and markdown, PDFs do **not** open in lightbox viewer.

**Rationale:**
- PDF embed already provides full navigation (zoom, scroll, page controls)
- Chromium's built-in PDF viewer includes all expected features
- Adding lightbox wrapper adds no value, only complexity
- Spacebar opens lightbox for images/markdown, does nothing for PDFs (expected UX)

**Implementation:**
```typescript
// In useKeyboardShortcuts.ts
const handleSpacebar = () => {
  if (preview.type === 'image' || preview.type === 'code' && preview.language === 'markdown') {
    openLightbox();
  }
  // PDFs: do nothing (embed has its own controls)
};
```

---

## Component Integration Matrix

### Modified Components

| Component | File | Modification | Integration Type |
|-----------|------|--------------|------------------|
| `file-operations-service.ts` | Main | Add uploadFolder(), downloadFolder(), enumerateFolders() | Extend existing service |
| `file-operations-handlers.ts` | Main | Add IPC handlers for folder operations | New IPC channels |
| `preview-handlers.ts` | Main | Extend detectFileType() to recognize PDF | Extend existing function |
| `preload.ts` | Preload | Add uploadFolder(), downloadFolder() to API surface | Extend existing API |
| `types.ts` | Shared | Add 'pdf' to PreviewData union | Extend existing type |
| `FileItem.tsx` | Renderer | Add folder upload/download to context menu | Extend existing menu |
| `PreviewPanel.tsx` | Renderer | Add case for 'pdf' preview type | Extend existing switch |

### New Components

| Component | File | Purpose | Pattern Source |
|-----------|------|---------|----------------|
| `PDFPreview.tsx` | Renderer | Render PDF via embed element | ImagePreview.tsx pattern |

**Total new files:** 1 (PDFPreview.tsx)

**Total modified files:** 7 (service, handlers, preload, types, FileItem, PreviewPanel, keyboard shortcuts)

---

## Build Order and Dependencies

### Suggested Implementation Order

#### Phase 1: Folder Upload (2-3 days)

**Goal:** Upload local folders to remote server with progress

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 1.1 | Local enumeration | enumerateLocalFolder() working | 1.2 |
| 1.2 | Upload logic | uploadFolder() transfers files with progress | 1.3 |
| 1.3 | IPC integration | file-ops:upload-folder handler working | 1.4 |
| 1.4 | UI integration | Context menu action triggers upload | Test |

**Rationale:** Upload is more common use case than download. Local file enumeration is simpler (fs.readdir) than remote (SFTP).

#### Phase 2: Folder Download (2-3 days)

**Goal:** Download remote folders to local Mac with progress

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 2.1 | Remote enumeration | enumerateRemoteFolder() working | 2.2 |
| 2.2 | Download logic | downloadFolder() transfers files with progress | 2.3 |
| 2.3 | IPC integration | file-ops:download-folder handler working | 2.4 |
| 2.4 | UI integration | Context menu action triggers download | Test |

**Rationale:** Builds on folder upload pattern. Remote enumeration requires SFTP readdir recursion.

#### Phase 3: PDF Preview (1-2 days)

**Goal:** Display PDF files in preview panel

| Step | Component | Deliverable | Blocks |
|------|-----------|-------------|--------|
| 3.1 | Type detection | detectFileType() recognizes PDF | 3.2 |
| 3.2 | Preview handler | preview:read-file returns PDF data URL | 3.3 |
| 3.3 | PDF component | PDFPreview.tsx renders embed | 3.4 |
| 3.4 | Integration | PreviewPanel shows PDFs | Test |

**Rationale:** Independent of folder operations. Trivial implementation leveraging existing patterns.

**Total estimated time:** 5-8 days (1 week with testing/polish)

### Dependency Graph

```
Phase 1: Folder Upload
├── Local enumeration (no deps)
├── Upload logic (depends on: existing uploadFile)
├── IPC handlers (depends on: upload logic)
└── UI (depends on: IPC handlers)

Phase 2: Folder Download
├── Remote enumeration (depends on: existing getSFTPWrapper)
├── Download logic (depends on: existing downloadFile, remote enumeration)
├── IPC handlers (depends on: download logic)
└── UI (depends on: IPC handlers)

Phase 3: PDF Preview (parallel to folder ops)
├── Type detection (no deps)
├── Preview handler (depends on: type detection, existing fetchFile)
├── PDF component (no deps)
└── Integration (depends on: preview handler, PDF component)
```

**Critical path:** Phase 1 → Phase 2 (sequential)

**Parallel opportunities:** Phase 3 can be implemented concurrently with Phase 1/2

---

## Testing Strategy

### Folder Transfer Tests

**Unit tests (Main process):**
- `enumerateLocalFolder()` with nested directories, symlinks, empty folders
- `enumerateRemoteFolder()` with SFTP mocked
- `uploadFolder()` progress calculation accuracy
- `downloadFolder()` creates correct local directory structure

**Integration tests (IPC):**
- Upload folder, verify all files transferred
- Download folder, verify directory structure preserved
- Cancel mid-transfer, verify cleanup
- Upload folder with existing files (overwrite behavior)

**Manual tests:**
- Large folder (1000+ files) transfers with UI progress
- Folder with deep nesting (10+ levels)
- Folder with special characters in filenames
- Cancel transfer at various stages

### PDF Preview Tests

**Unit tests (Main process):**
- `detectFileType()` recognizes .pdf extension
- Data URL generation for PDF buffers
- Cache hit/miss for PDF files

**Integration tests (IPC):**
- Preview small PDF (<1MB)
- Preview large PDF (near 50MB limit)
- Preview PDF over limit (error handling)

**Manual tests:**
- PDF renders correctly in preview panel
- PDF zoom, scroll, page controls work
- Navigate between PDF and non-PDF files
- Cached PDF loads instantly

---

## Known Limitations and Future Enhancements

### Folder Transfer Limitations (MVP)

| Limitation | Impact | Future Enhancement |
|------------|--------|-------------------|
| Sequential file transfer | Slower than concurrent | Implement concurrent transfer queue (limit 3-5 simultaneous) |
| No folder merge logic | Overwrites existing files | Add merge options (skip, overwrite, rename) |
| No symlink handling | Symlinks skipped silently | Add symlink resolution or warning |
| Upfront enumeration | Delay before transfer starts | Implement streaming enumeration for huge folders |

### PDF Preview Limitations (MVP)

| Limitation | Impact | Future Enhancement |
|------------|--------|-------------------|
| Base64 overhead (33%) | Higher memory for large PDFs | Use Blob URLs instead of data URLs |
| No page count extraction | Missing metadata in UI | Parse PDF header for page count |
| 50MB file size limit | Can't preview very large PDFs | Progressive loading (first page only) |
| No lightbox view | Less immersive experience | Debate: is fullscreen PDF viewing useful? |

### Security Considerations

**Folder transfers:**
- Validate all paths to prevent directory traversal attacks
- Check available disk space before download (prevent fill attack)
- Limit concurrent transfers to prevent resource exhaustion

**PDF preview:**
- PDFs rendered in sandboxed renderer process (secure by default)
- No server-side execution risk (PDFium is Chromium's hardened engine)
- Data URLs are memory-only (no temp file exposure)

---

## Performance Benchmarks (Expected)

### Folder Transfer Performance

| Scenario | Files | Total Size | Expected Time | Notes |
|----------|-------|------------|---------------|-------|
| Small folder | 10 files | 10MB | 5-10 sec | Network limited |
| Medium folder | 100 files | 100MB | 1-2 min | SSH overhead per file |
| Large folder | 1000 files | 1GB | 10-15 min | Sequential transfer |

**Optimization:** Concurrent transfers could reduce medium/large folder times by 50-70%.

### PDF Preview Performance

| Scenario | Size | Expected Time | Notes |
|----------|------|---------------|-------|
| Typical PDF | 1MB | <500ms | Cache hit: instant |
| Large PDF | 10MB | 2-3 sec | Network + render |
| Max size PDF | 50MB | 10-15 sec | Base64 + PDFium load |

**Chromium PDFium rendering:** Near-instant for PDFs up to 50MB (native code performance).

---

## References and Sources

### Folder Transfer Research

- [ssh2-sftp-client - npm](https://www.npmjs.com/package/ssh2-sftp-client) - uploadDir/downloadDir methods documentation
- [How to Upload a Folder to an SFTP Server Using TypeScript and ssh2-sftp-client](https://www.timsanteford.com/posts/how-to-upload-a-folder-to-an-sftp-server-using-typescript-and-ssh2-sftp-client/) - Recursive folder upload patterns
- [Electron IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc) - Official IPC patterns
- [Electron AbortController Pattern](https://github.com/electron/electron/issues/31737) - Cancellation patterns in Electron IPC

### PDF Preview Research

- [Insomnia Tale of Learning to Love Electron](https://konghq.com/blog/engineering/learning-to-love-electron) - PDFium vs PDF.js in Electron
- [How to build an Electron PDF viewer with PDF.js](https://pspdfkit.com/blog/2021/how-to-build-an-electron-pdf-viewer-with-pdfjs/) - Alternative PDF.js approach
- [Comparing the best React PDF viewers for developers](https://www.nutrient.io/blog/top-react-pdf-viewers/) - PDFium advantages and alternatives
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) - Security best practices for sandboxed rendering
- [Top five JavaScript PDF viewers for 2025](https://www.nutrient.io/blog/top-5-javascript-pdf-viewers/) - PDF.js alternatives and comparisons

### Architecture Patterns

- [Advanced Electron.js architecture - LogRocket Blog](https://blog.logrocket.com/advanced-electron-js-architecture/) - Electron architecture best practices
- [Building High-Performance Electron Apps](https://www.johnnyle.io/read/electron-performance) - Performance optimization patterns

---

## Roadmap Implications

### Phase Structure Recommendation

Based on dependency analysis and complexity:

**Milestone v1.2: Folder Operations (5-8 days)**

1. **Phase 1: Folder Upload** (2-3 days)
   - Local enumeration → upload logic → IPC → UI
   - Critical path for folder operations

2. **Phase 2: Folder Download** (2-3 days)
   - Remote enumeration → download logic → IPC → UI
   - Builds on Phase 1 patterns

3. **Phase 3: PDF Preview** (1-2 days, parallel to Phase 1/2)
   - Type detection → preview handler → component → integration
   - Independent, can be developed concurrently

**Testing & Polish** (1-2 days)
- Integration tests for all three features
- Manual testing with real server folders
- Progress toast refinement
- Error handling polish

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Recursive enumeration performance issues | Low | Medium | Limit folder depth warning at 1000+ files |
| PDF rendering compatibility | Low | Low | PDFium is Chrome's engine, excellent compatibility |
| Progress aggregation complexity | Medium | Low | Existing pattern handles it, just more state |
| Folder structure edge cases | Medium | Medium | Comprehensive test suite with symlinks, unicode, etc. |

**Overall confidence:** HIGH - Both features extend well-proven patterns with minimal new concepts.
