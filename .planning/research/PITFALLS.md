# Pitfalls: Folder Transfer and PDF Preview

**Project:** Ubuntu File Explorer v1.2
**Context:** Adding folder upload/download and PDF preview to existing Electron SSH file explorer
**Researched:** 2026-01-29
**Overall Confidence:** HIGH

## Executive Summary

Adding folder transfer and PDF preview to an existing Electron SSH file explorer introduces specific integration challenges beyond typical feature development. The app already handles single-file transfers with streaming, progress tracking, and cancellation. The primary risks are:

1. **Memory explosion from recursive folder enumeration** - Known issue: ssh2 uses significantly more memory than native tools
2. **Partial failure complexity** - Some files succeed, others fail, requiring robust state management
3. **Progress tracking accuracy** - Nested folders make "X% complete" calculations complex
4. **PDF rendering security and memory** - PDF.js can leak memory, PDFs are potential XSS vectors
5. **Integration breakage** - New features may break existing batching (10-20 concurrent transfers) that prevents OOM

---

## Critical Pitfalls

### Pitfall 1: Recursive Folder Enumeration Memory Explosion

**What goes wrong:**

When recursively listing folder contents before transfer, ssh2-sftp-client loads the entire directory tree into memory. For folders with thousands of nested files, this can consume gigabytes of RAM before a single file transfer begins. Combine this with the known issue that "ssh2 uses significantly more memory than native tools" and OOM crashes become likely.

**Why it happens:**

- `sftp.list()` returns full arrays, not streams
- Recursive directory walking builds complete tree structure in memory
- File metadata (permissions, timestamps, sizes) multiplies memory footprint
- ssh2's internal buffering adds 2-3x overhead compared to native tools

**Consequences:**

- App crashes with OOM before transfer starts
- Electron renderer freezes during enumeration (if done in main process synchronously)
- Users can't transfer large project directories (e.g., node_modules with 50k+ files)
- MacOS shows "Application Not Responding" during enumeration

**Prevention:**

```typescript
// BAD: Load entire tree, then transfer
async function uploadFolder(localPath: string, remotePath: string) {
  const allFiles = await recursivelyListAllFiles(localPath); // OOM risk
  for (const file of allFiles) {
    await sftp.put(file.local, file.remote);
  }
}

// GOOD: Stream enumeration, transfer as you discover
async function* enumerateFolderStreaming(localPath: string, remotePath: string) {
  const entries = await fs.readdir(localPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      yield { local: path.join(localPath, entry.name), remote: path.join(remotePath, entry.name) };
    } else if (entry.isDirectory()) {
      yield* enumerateFolderStreaming(path.join(localPath, entry.name), path.join(remotePath, entry.name));
    }
  }
}

async function uploadFolder(localPath: string, remotePath: string) {
  for await (const file of enumerateFolderStreaming(localPath, remotePath)) {
    await transferQueue.add(() => sftp.put(file.local, file.remote));
  }
}
```

**Detection:**

- Memory profiler shows spike during folder listing
- Heapdumps reveal thousands of file metadata objects
- Transfer preparation takes >10 seconds for medium folders
- Console warnings: "MaxListenersExceededWarning" (related to accumulation)

**Phase to Address:** Phase 1 (Folder Transfer Architecture)

**Confidence:** HIGH - Verified by existing PROJECT.md knowledge: "ssh2 uses significantly more memory than native tools"

---

### Pitfall 2: Partial Transfer Failure State Management

**What goes wrong:**

During folder transfer, some files succeed while others fail (permissions, disk space, network hiccup). Without proper state management, the UI shows "Transfer Complete" when 80% succeeded, leaving users with corrupted folder states. Retrying the entire folder duplicates successful files or overwrites newer versions.

**Why it happens:**

- ssh2-sftp-client's `uploadDir()` and `downloadDir()` don't provide granular failure reporting
- Network interruptions mid-transfer leave partial state
- Existing single-file transfer code assumes "success or total failure"
- Progress tracking (which already exists) needs extension for multi-file semantics

**Consequences:**

- Silent data loss - users think transfer completed
- Duplicate files on retry without skip logic
- No way to resume interrupted folder transfers
- Support burden: "Why are only some files transferred?"

**Prevention:**

```typescript
interface FolderTransferState {
  totalFiles: number;
  successFiles: string[];
  failedFiles: Array<{ path: string; error: string }>;
  skippedFiles: string[];
  inProgressFiles: string[];
}

async function uploadFolderWithState(
  localPath: string,
  remotePath: string,
  state: FolderTransferState,
  options: { skipExisting: boolean; retryFailed: boolean }
): Promise<FolderTransferState> {
  for await (const file of enumerateFolderStreaming(localPath, remotePath)) {
    // Skip if already successful
    if (state.successFiles.includes(file.remote)) {
      state.skippedFiles.push(file.remote);
      continue;
    }

    state.inProgressFiles = [file.remote];

    try {
      await sftp.put(file.local, file.remote);
      state.successFiles.push(file.remote);
    } catch (error) {
      state.failedFiles.push({ path: file.remote, error: error.message });
    } finally {
      state.inProgressFiles = [];
    }
  }

  return state;
}
```

**Detection:**

- User reports: "Only some files transferred"
- Transfer shows 100% but remote folder incomplete
- Retry duplicates files or shows errors about existing files
- No clear indication of what failed

**Phase to Address:** Phase 2 (Folder Transfer Implementation)

**Confidence:** HIGH - Common pattern in SFTP batch operations

---

### Pitfall 3: Progress Tracking Accuracy for Nested Folders

**What goes wrong:**

The existing single-file progress works via stream `data` events for bytes transferred. For folders, you need to calculate progress across multiple files of different sizes. Naive implementations show "50% complete" when transferring file 50 of 100, even if the first 49 were tiny and file 50 is 1GB (so actually 5% by bytes). Users lose trust in progress indicators.

**Why it happens:**

- Total byte count unknown until full enumeration completes (see Pitfall 1)
- Stream-based progress (existing implementation) works per-file, not per-folder
- File discovery and transfer happen concurrently (streaming enumeration)
- Existing progress toasts designed for single-file operations

**Consequences:**

- Progress bar jumps erratically (1%, 5%, 99%, 100% in 4 seconds)
- Estimated time remaining wildly inaccurate
- Users can't plan work ("How long will this take?")
- "Cancel" button pressed late because progress looked nearly done

**Prevention:**

```typescript
interface FolderProgress {
  phase: 'enumerating' | 'transferring' | 'verifying';
  filesDiscovered: number;
  filesTransferred: number;
  bytesTotal: number | null; // null during enumeration
  bytesTransferred: number;
}

// Two-pass approach for accurate progress
async function uploadFolderWithProgress(localPath: string, remotePath: string) {
  const progress: FolderProgress = {
    phase: 'enumerating',
    filesDiscovered: 0,
    filesTransferred: 0,
    bytesTotal: null,
    bytesTransferred: 0,
  };

  // Pass 1: Enumerate and calculate total
  const files: FileToTransfer[] = [];
  for await (const file of enumerateFolderStreaming(localPath, remotePath)) {
    const stat = await fs.stat(file.local);
    files.push({ ...file, size: stat.size });
    progress.filesDiscovered++;
    progress.bytesTotal = (progress.bytesTotal || 0) + stat.size;
    updateUI(progress); // Show "Preparing... found 123 files"
  }

  // Pass 2: Transfer with accurate percentage
  progress.phase = 'transferring';
  for (const file of files) {
    await transferWithProgress(file, (bytesTransferred) => {
      progress.bytesTransferred += bytesTransferred;
      updateUI(progress); // Show "45% (234 MB / 520 MB)"
    });
    progress.filesTransferred++;
  }
}
```

**Alternative: Streaming approach with estimated progress**

```typescript
// For massive folders where enumeration takes too long
async function uploadFolderStreamingProgress(localPath: string, remotePath: string) {
  let filesTransferred = 0;

  for await (const file of enumerateFolderStreaming(localPath, remotePath)) {
    await transferFile(file);
    filesTransferred++;
    updateUI({
      mode: 'indeterminate-with-count',
      message: `Transferred ${filesTransferred} files...`
    });
  }
}
```

**Detection:**

- Progress jumps from 10% to 90% instantly
- Users report progress is "wrong"
- Time estimates swing wildly (5 min, 30 min, 2 min, 1 hour)

**Phase to Address:** Phase 2 (Folder Transfer Implementation)

**Confidence:** MEDIUM - Based on web search findings about progress tracking challenges, not direct ssh2-sftp-client documentation

---

### Pitfall 4: PDF.js Memory Leaks and Missing Cleanup

**What goes wrong:**

PDF.js creates `loadingTask` objects that must be explicitly destroyed via `destroy()` method. If preview component unmounts without cleanup, PDF.js workers accumulate in memory. Viewing 20 PDFs can consume 5GB+ RAM. On page refresh, react-pdf adds another pdf.worker.js without stopping the previous one, compounding the leak.

**Why it happens:**

- PDF.js loadingTask resources (workers, canvas buffers) aren't garbage collected automatically
- React component lifecycle doesn't guarantee cleanup if user navigates quickly
- Large PDFs (100+ pages) decompress entire document into memory for rendering
- Existing preview panel architecture may not account for heavyweight preview types

**Consequences:**

- Memory grows continuously when browsing PDFs
- App eventually crashes with OOM
- MacOS Activity Monitor shows Electron Helper consuming multiple GB
- PDF preview becomes sluggish after viewing several documents

**Prevention:**

```typescript
import { getDocument } from 'pdfjs-dist';

function PDFPreview({ fileContent }: { fileContent: Uint8Array }) {
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);

  useEffect(() => {
    const loadPDF = async () => {
      // Clean up previous PDF if exists
      if (loadingTaskRef.current) {
        await loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
      }

      const loadingTask = getDocument({ data: fileContent });
      loadingTaskRef.current = loadingTask;

      try {
        const pdf = await loadingTask.promise;
        // Render PDF...
      } catch (error) {
        if (error.name !== 'AbortException') {
          // Handle actual errors
        }
      }
    };

    loadPDF();

    // CRITICAL: Cleanup on unmount
    return () => {
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
      }
    };
  }, [fileContent]);

  // Component render...
}
```

**Additional safeguard for worker management:**

```typescript
// Ensure single worker instance
import { GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

// Set once on app initialization
GlobalWorkerOptions.workerSrc = pdfjsWorker;
```

**Detection:**

- Memory profiler shows PDF.js worker processes accumulating
- Heap snapshots reveal unreleased canvas ImageData
- Console warning: "Warning: Ignoring invalid test task" (PDF.js internal)
- Memory usage climbs by 100-500MB per PDF viewed

**Phase to Address:** Phase 3 (PDF Preview Implementation)

**Confidence:** HIGH - Multiple GitHub issues confirm this pattern ([wojtekmaj/react-pdf#504](https://github.com/wojtekmaj/react-pdf/issues/504), [wojtekmaj/react-pdf#305](https://github.com/wojtekmaj/react-pdf/issues/305))

---

### Pitfall 5: Large PDF File Handling Without Size Limits

**What goes wrong:**

Transferring a 500MB PDF over SFTP into Electron's renderer via IPC causes memory overflow. Even if transfer succeeds, loading it into PDF.js decompresses the content to multiple GB. Users expect preview to "just work" like in browser, but Electron has tighter memory constraints.

**Why it happens:**

- Existing image preview uses base64 data URLs (from PROJECT.md: "Base64 data URLs for images")
- Extending this pattern to PDFs creates 133% overhead (base64 encoding)
- PDF.js loads entire document into memory for rendering
- IPC message size limits (Chromium's default ~128MB) can be exceeded

**Consequences:**

- App crashes when opening large PDF in preview
- IPC transfer fails silently or with cryptic errors
- Even if IPC succeeds, renderer runs out of memory during PDF.js parsing
- Users blame app for "not supporting PDFs" when it's size-specific

**Prevention:**

```typescript
const MAX_PDF_PREVIEW_SIZE = 50 * 1024 * 1024; // 50MB

async function handleFileSelection(file: RemoteFileEntry) {
  if (file.type === 'pdf') {
    if (file.size > MAX_PDF_PREVIEW_SIZE) {
      showPreviewPlaceholder({
        icon: 'pdf',
        message: `PDF too large for preview (${formatBytes(file.size)})`,
        actions: [
          { label: 'Download', onClick: () => downloadFile(file) },
          { label: 'Open Externally', onClick: () => downloadAndOpen(file) },
        ],
      });
      return;
    }

    // For smaller PDFs, use file system instead of IPC
    const tempPath = await downloadToTemp(file);
    showPDFPreview({ filePath: tempPath }); // Pass path, not blob
  }
}

// In renderer, load from file path not data URL
function PDFPreview({ filePath }: { filePath: string }) {
  useEffect(() => {
    const loadPDF = async () => {
      // PDF.js can load from file:// URL in Electron
      const loadingTask = getDocument(`file://${filePath}`);
      // ... rest of loading logic
    };
    loadPDF();
  }, [filePath]);
}
```

**Alternative: Lazy page loading for large PDFs**

```typescript
// Only load visible pages, not entire document
function PDFPreview({ filePath }: { filePath: string }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCache] = useState(new Map<number, PDFPageProxy>());

  const loadPage = async (pageNum: number) => {
    if (pageCache.has(pageNum)) return pageCache.get(pageNum);

    const pdf = await getDocument(`file://${filePath}`).promise;
    const page = await pdf.getPage(pageNum);
    pageCache.set(pageNum, page);

    // Limit cache size to prevent memory growth
    if (pageCache.size > 5) {
      const oldestPage = pageCache.keys().next().value;
      pageCache.delete(oldestPage);
    }

    return page;
  };
}
```

**Detection:**

- App crashes when selecting large PDF files
- Console errors: "JavaScript heap out of memory"
- IPC errors: "message too large" or silent failures
- PDF preview shows blank page for large files

**Phase to Address:** Phase 3 (PDF Preview Implementation)

**Confidence:** MEDIUM - Based on Electron IPC best practices and PDF.js memory characteristics

---

## Moderate Pitfalls

### Pitfall 6: Breaking Existing Batching with Folder Operations

**What goes wrong:**

The app currently batches 10-20 concurrent transfers to prevent OOM (from PROJECT.md: "batching 10-20 concurrent transfers prevents OOM"). Folder upload naively spawns one transfer per file, ignoring this limit. 100-file folder creates 100 concurrent transfers, triggering the same OOM issue that batching was designed to prevent.

**Why it happens:**

- New folder transfer code doesn't integrate with existing transfer queue
- Developer assumes "it's just calling upload() many times"
- Existing batching is implicit, not enforced by API
- Queue concurrency limit is per-connection, folder transfer may use multiple

**Consequences:**

- Regression: OOM errors that were previously fixed
- Users report "app was stable, now crashes on large operations"
- Folder transfers work for small folders, fail for large ones
- Difficult to debug because it's timing/size dependent

**Prevention:**

```typescript
// Existing transfer queue (from v1.0/v1.1)
class TransferQueue {
  private concurrentLimit = 15; // Current sweet spot
  private activeTransfers = 0;
  private queue: Array<() => Promise<void>> = [];

  async add(transferFn: () => Promise<void>): Promise<void> {
    if (this.activeTransfers < this.concurrentLimit) {
      return this.execute(transferFn);
    }

    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await transferFn();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async execute(transferFn: () => Promise<void>) {
    this.activeTransfers++;
    try {
      await transferFn();
    } finally {
      this.activeTransfers--;
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeTransfers < this.concurrentLimit) {
      const next = this.queue.shift();
      if (next) this.execute(next);
    }
  }
}

// GOOD: Folder transfer integrates with existing queue
async function uploadFolder(localPath: string, remotePath: string) {
  for await (const file of enumerateFolderStreaming(localPath, remotePath)) {
    await transferQueue.add(() => sftp.put(file.local, file.remote)); // Respects limit
  }
}

// BAD: Bypasses queue
async function uploadFolder(localPath: string, remotePath: string) {
  const files = await getAllFiles(localPath);
  await Promise.all(files.map(f => sftp.put(f.local, f.remote))); // 100 concurrent!
}
```

**Detection:**

- OOM crashes during folder transfers
- Memory spikes visible in Activity Monitor
- Works fine for 10 files, crashes at 50+ files
- Error: "JavaScript heap out of memory" during folder operations

**Phase to Address:** Phase 1 (Folder Transfer Architecture) - Must integrate with existing queue from day one

**Confidence:** HIGH - Directly related to known constraint from PROJECT.md

---

### Pitfall 7: Symlink Handling in Recursive Folder Transfers

**What goes wrong:**

SFTP does not follow symbolic links during recursive transfers. A folder containing symlinks transfers the link itself (if server supports it) or fails silently. Circular symlinks (e.g., `project/link -> project/`) cause infinite recursion and stack overflow. Different SFTP servers handle symlinks inconsistently.

**Why it happens:**

- SSH2 SFTP protocol doesn't standardize symlink handling
- Some servers report symlinks as files, others as directories, others as special type
- Circular symlink detection requires tracking visited inodes or paths
- Native SFTP clients handle this; ssh2-sftp-client requires manual logic

**Consequences:**

- Folder upload hangs indefinitely on circular symlink
- Symlinked files/folders missing in transferred directory
- App crash with "Maximum call stack size exceeded"
- Inconsistent behavior across different servers (Linux vs macOS vs Windows OpenSSH)

**Prevention:**

```typescript
interface PathTracker {
  visited: Set<string>;
  maxDepth: number;
  currentDepth: number;
}

async function* enumerateFolderWithSymlinkDetection(
  localPath: string,
  remotePath: string,
  tracker: PathTracker = { visited: new Set(), maxDepth: 50, currentDepth: 0 }
): AsyncGenerator<FileToTransfer> {
  // Detect recursion limit
  if (tracker.currentDepth > tracker.maxDepth) {
    console.warn(`Maximum recursion depth reached at ${localPath}`);
    return;
  }

  // Resolve to real path for cycle detection
  const realPath = await fs.realpath(localPath);
  if (tracker.visited.has(realPath)) {
    console.warn(`Circular symlink detected: ${localPath} -> ${realPath}`);
    return;
  }
  tracker.visited.add(realPath);

  const entries = await fs.readdir(localPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(localPath, entry.name);

    if (entry.isSymbolicLink()) {
      // Option 1: Skip symlinks
      console.log(`Skipping symlink: ${entryPath}`);
      continue;

      // Option 2: Follow symlinks (with cycle detection)
      // const linkTarget = await fs.readlink(entryPath);
      // const targetStat = await fs.stat(entryPath); // Follows symlink
      // if (targetStat.isDirectory()) {
      //   yield* enumerateFolderWithSymlinkDetection(entryPath, remotePath, {
      //     ...tracker,
      //     currentDepth: tracker.currentDepth + 1
      //   });
      // }
    } else if (entry.isFile()) {
      yield { local: entryPath, remote: path.join(remotePath, entry.name) };
    } else if (entry.isDirectory()) {
      yield* enumerateFolderWithSymlinkDetection(
        entryPath,
        path.join(remotePath, entry.name),
        { ...tracker, currentDepth: tracker.currentDepth + 1 }
      );
    }
  }
}
```

**User-facing option:**

```typescript
interface FolderTransferOptions {
  followSymlinks: boolean; // Default: false
  maxDepth: number; // Default: 50
  onSymlinkDetected?: (path: string, target: string) => 'skip' | 'follow' | 'abort';
}
```

**Detection:**

- App hangs during folder enumeration
- Console error: "Maximum call stack size exceeded"
- Some folders transfer with missing files/subdirectories
- Different results when transferring same folder to different servers

**Phase to Address:** Phase 1-2 (Folder Transfer Architecture/Implementation)

**Confidence:** MEDIUM - Based on web search findings about SFTP symlink behavior

---

### Pitfall 8: PDF Preview Security and XSS Risks

**What goes wrong:**

PDFs can contain JavaScript and embedded content. Loading untrusted PDFs in Electron without proper sandboxing creates XSS vectors. A malicious PDF could attempt to escape sandbox via PDF.js vulnerabilities or exploit improper Content Security Policy configuration. This is especially risky for SSH file explorers browsing unknown servers.

**Why it happens:**

- PDF.js executes in renderer context
- Default CSP may allow unsafe-eval (required by some PDF.js versions)
- Developers assume PDFs are "just documents"
- Existing app has security-first architecture (contextIsolation: true, sandbox: true), but PDF preview might bypass

**Consequences:**

- XSS attack via malicious PDF
- Potential RCE if nodeIntegration accidentally enabled for PDF viewer
- Credential theft if PDF.js can access Electron APIs
- App flagged by security audits

**Prevention:**

```typescript
// 1. Load PDF in isolated context
function PDFPreview({ pdfPath }: { pdfPath: string }) {
  return (
    <webview
      src={`pdfviewer.html?file=${encodeURIComponent(pdfPath)}`}
      webpreferences="contextIsolation=true, nodeIntegration=false, sandbox=true"
      partition="persist:pdfviewer"
    />
  );
}

// 2. Set strict CSP for PDF viewer page
// In pdfviewer.html:
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self' data:;
  connect-src 'none';
" />

// 3. Disable PDF JavaScript execution
import { GlobalWorkerOptions } from 'pdfjs-dist';

const loadingTask = getDocument({
  url: pdfPath,
  disableAutoFetch: true,
  disableStream: true,
  isEvalSupported: false, // Disable JS in PDF
});

// 4. Validate PDF before rendering
async function validatePDF(pdfBuffer: Uint8Array): Promise<boolean> {
  // Check magic bytes
  const magicBytes = new Uint8Array(pdfBuffer.slice(0, 5));
  const isPDF = String.fromCharCode(...magicBytes) === '%PDF-';

  if (!isPDF) {
    throw new Error('Invalid PDF file');
  }

  // Check file size
  if (pdfBuffer.length > MAX_PDF_PREVIEW_SIZE) {
    throw new Error('PDF too large');
  }

  return true;
}
```

**Detection:**

- Security audit tools flag PDF viewer
- CSP violations in console when opening PDFs
- PDF viewer can access window.electron or other exposed APIs
- Dev tools show eval() usage in PDF.js

**Phase to Address:** Phase 3 (PDF Preview Implementation)

**Confidence:** MEDIUM-HIGH - Based on Electron security best practices and documented PDF.js XSS risks

---

### Pitfall 9: Incorrect Permission Preservation in Cross-Platform Transfers

**What goes wrong:**

SFTP's `-p` flag preserves permissions by copying UID/GID numbers, not names. Transferring from Linux server (UID 1000 = user "john") to Mac (UID 1000 = user "alice") results in wrong ownership. Even when preserving permissions, umask on remote system can restrict them. Developers expect "preserve permissions" to work like rsync, but SFTP behaves differently.

**Why it happens:**

- SFTP preserves numeric IDs, not symbolic names
- Remote server umask applies even with preserve flag
- ssh2-sftp-client doesn't expose granular permission control by default
- Different behavior across platforms (Linux, macOS, Windows OpenSSH)

**Consequences:**

- Files uploaded with wrong permissions
- Users can't execute scripts after upload
- Folders become inaccessible (missing execute bit)
- "Why did my file become read-only?"

**Prevention:**

```typescript
interface TransferOptions {
  preservePermissions: boolean; // Default: false
  defaultFileMode?: number; // e.g., 0o644
  defaultDirMode?: number; // e.g., 0o755
  warningOnPreserve?: boolean; // Warn about UID/GID behavior
}

async function uploadFileWithPermissions(
  localPath: string,
  remotePath: string,
  options: TransferOptions
) {
  await sftp.put(localPath, remotePath);

  if (options.preservePermissions) {
    const stat = await fs.stat(localPath);
    try {
      // SFTP chmod
      await sftp.chmod(remotePath, stat.mode & 0o777);
    } catch (error) {
      // Some SFTP servers don't support chmod
      console.warn(`Could not set permissions for ${remotePath}:`, error);
    }
  } else if (options.defaultFileMode) {
    await sftp.chmod(remotePath, options.defaultFileMode);
  }
}

// For folders: ensure directories are executable
async function uploadFolder(localPath: string, remotePath: string, options: TransferOptions) {
  // Create directories first with proper permissions
  for await (const dir of enumerateDirectories(localPath, remotePath)) {
    await sftp.mkdir(dir.remote, true); // recursive
    const mode = options.defaultDirMode || 0o755;
    await sftp.chmod(dir.remote, mode); // Ensure readable + executable
  }

  // Then transfer files
  for await (const file of enumerateFiles(localPath, remotePath)) {
    await uploadFileWithPermissions(file.local, file.remote, options);
  }
}
```

**User education:**

```typescript
// Show warning on first preserve-permissions use
if (options.preservePermissions && !userHasSeenPermissionWarning) {
  showDialog({
    title: 'Permission Preservation',
    message: 'SFTP preserves numeric user/group IDs, not names. ' +
             'File ownership may differ on the remote system if user IDs do not match.',
    checkbox: 'Don\'t show this again',
  });
}
```

**Detection:**

- Users report "files have wrong owner after upload"
- Scripts not executable after transfer
- Folders with missing execute bit
- Behavior differs between servers (Linux vs macOS)

**Phase to Address:** Phase 2 (Folder Transfer Implementation)

**Confidence:** MEDIUM - Based on web search findings about SFTP permission handling

---

## Minor Pitfalls

### Pitfall 10: Folder Transfer Cancellation Complexity

**What goes wrong:**

Existing single-file transfers support cancellation via AbortController (from PROJECT.md: "AbortController for cancellation"). Canceling a folder transfer mid-operation leaves partial state: some files transferred, some not, some mid-transfer. Users expect "Cancel" to cleanly abort, but implementation must track what was transferred to enable resume.

**Prevention:**

Extend existing cancellation pattern to track per-file state:

```typescript
class FolderTransferOperation {
  private abortController = new AbortController();
  private state: FolderTransferState;

  async cancel() {
    this.abortController.abort();

    // Save state for potential resume
    await saveTransferState(this.state);

    // Clean up in-progress files (delete .part files)
    for (const inProgressFile of this.state.inProgressFiles) {
      await sftp.delete(`${inProgressFile}.part`).catch(() => {});
    }

    return {
      status: 'cancelled',
      successCount: this.state.successFiles.length,
      totalCount: this.state.totalFiles,
      resumeToken: this.state.id,
    };
  }
}

// UI shows resume option
function TransferToast({ operation }: { operation: FolderTransferOperation }) {
  const handleCancel = async () => {
    const result = await operation.cancel();
    toast(`Transfer cancelled. ${result.successCount}/${result.totalCount} files transferred.`, {
      action: {
        label: 'Resume',
        onClick: () => resumeTransfer(result.resumeToken),
      },
    });
  };
}
```

**Phase to Address:** Phase 2 (Folder Transfer Implementation)

**Confidence:** MEDIUM

---

### Pitfall 11: PDF Preview Doesn't Work in Sandboxed Renderer

**What goes wrong:**

Electron's sandbox mode restricts access to Node.js APIs and file system. If PDF viewer tries to load PDFs via `fs.readFile()` or access file:// URLs directly, it fails with permission errors. Developers disable sandbox to "fix" it, creating security vulnerability.

**Prevention:**

```typescript
// WRONG: Trying to access file system from renderer
function PDFPreview({ filePath }: { filePath: string }) {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    // This fails in sandbox mode
    fs.readFile(filePath, (err, data) => { // fs is undefined
      setPdfData(data);
    });
  }, [filePath]);
}

// RIGHT: Use IPC to get data from main process
// In preload.ts
contextBridge.exposeInMainWorld('electron', {
  readPDFFile: (filePath: string) => ipcRenderer.invoke('read-pdf-file', filePath),
});

// In main process
ipcMain.handle('read-pdf-file', async (event, filePath: string) => {
  // Validate path to prevent directory traversal
  if (!isAllowedPath(filePath)) {
    throw new Error('Invalid file path');
  }

  return await fs.promises.readFile(filePath);
});

// In renderer
function PDFPreview({ filePath }: { filePath: string }) {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    window.electron.readPDFFile(filePath).then(setPdfData);
  }, [filePath]);

  if (!pdfData) return <div>Loading...</div>;

  return <PDFRenderer data={pdfData} />;
}
```

**Phase to Address:** Phase 3 (PDF Preview Implementation)

**Confidence:** HIGH - Common Electron sandboxing issue

---

### Pitfall 12: Duplicate File Handling in Folder Uploads

**What goes wrong:**

User uploads folder that already exists on remote server. Without skip/overwrite/rename options, either all files are duplicated (wasting space), all are overwritten (losing remote changes), or transfer fails entirely.

**Prevention:**

```typescript
enum ConflictResolution {
  Skip = 'skip',
  Overwrite = 'overwrite',
  Rename = 'rename',
  Ask = 'ask',
}

async function uploadFileWithConflictHandling(
  localPath: string,
  remotePath: string,
  resolution: ConflictResolution
) {
  const exists = await sftp.exists(remotePath);

  if (!exists) {
    return await sftp.put(localPath, remotePath);
  }

  switch (resolution) {
    case ConflictResolution.Skip:
      return { skipped: true };

    case ConflictResolution.Overwrite:
      return await sftp.put(localPath, remotePath);

    case ConflictResolution.Rename:
      const newPath = await generateUniqueName(remotePath); // file (1).txt
      return await sftp.put(localPath, newPath);

    case ConflictResolution.Ask:
      const userChoice = await showConflictDialog(remotePath);
      return await uploadFileWithConflictHandling(localPath, remotePath, userChoice);
  }
}

// Remember user choice for bulk operations
let conflictResolutionForSession: ConflictResolution | null = null;

function showConflictDialog(filePath: string): Promise<ConflictResolution> {
  return new Promise((resolve) => {
    dialog.show({
      message: `File already exists: ${path.basename(filePath)}`,
      buttons: ['Skip', 'Overwrite', 'Rename'],
      checkbox: 'Apply to all conflicts',
      onClose: (buttonIndex, checked) => {
        const resolution = [
          ConflictResolution.Skip,
          ConflictResolution.Overwrite,
          ConflictResolution.Rename,
        ][buttonIndex];

        if (checked) {
          conflictResolutionForSession = resolution;
        }

        resolve(resolution);
      },
    });
  });
}
```

**Phase to Address:** Phase 2 (Folder Transfer Implementation)

**Confidence:** MEDIUM

---

## Integration Risks with Existing System

### Risk 1: IPC Message Size Limits

**Current system:** Uses base64 data URLs for image preview (small payloads)
**New risk:** Large PDFs encoded as base64 exceed IPC message size (~128MB limit)

**Mitigation:** Use file system paths instead of passing blob data through IPC

### Risk 2: Toast Notification Overload

**Current system:** One toast per file transfer with progress bar
**New risk:** Folder with 100 files creates 100 toasts, making UI unusable

**Mitigation:** Single toast for folder operation, updated in-place with aggregate progress

### Risk 3: UI State Complexity

**Current system:** Single selected file, single preview
**New risk:** Folder transfers are long-running background operations that should persist across navigation

**Mitigation:** Add "Transfers" panel (like browser download manager) for ongoing folder operations

---

## Phase Assignments

### Phase 1: Folder Transfer Architecture (Week 1)
- **Must address:**
  - Pitfall 1: Recursive enumeration memory
  - Pitfall 6: Integration with existing batching
  - Pitfall 7: Symlink handling (detection, at minimum)

### Phase 2: Folder Transfer Implementation (Week 2)
- **Must address:**
  - Pitfall 2: Partial failure state management
  - Pitfall 3: Progress tracking accuracy
  - Pitfall 9: Permission preservation
  - Pitfall 10: Cancellation
  - Pitfall 12: Duplicate file handling

### Phase 3: PDF Preview Implementation (Week 3)
- **Must address:**
  - Pitfall 4: PDF.js memory leaks
  - Pitfall 5: Large PDF file size limits
  - Pitfall 8: Security and XSS risks
  - Pitfall 11: Sandboxed renderer compatibility

### Testing & Integration (Week 4)
- **Must validate:**
  - All integration risks with existing system
  - Memory usage under load
  - Cancellation and resume flows
  - Security configuration

---

## Testing Checklist

**Folder Transfer:**
- [ ] Upload folder with 1000+ files stays under 500MB memory
- [ ] Cancel mid-transfer and verify clean state
- [ ] Network failure during transfer shows correct retry/resume UI
- [ ] Circular symlink doesn't crash app
- [ ] Concurrent folder + file transfers respect batching limit
- [ ] Progress percentage matches actual bytes transferred
- [ ] Partial failure shows specific failed files, allows retry

**PDF Preview:**
- [ ] View 20 consecutive PDFs without memory leak
- [ ] 100MB PDF shows "too large" message, doesn't crash
- [ ] PDF with JavaScript doesn't execute in sandbox
- [ ] Switching from PDF to image preview cleans up PDF.js resources
- [ ] CSP violations don't appear in console
- [ ] Sandboxed renderer can load and display PDFs

---

## Sources

**Folder Transfer:**
- [ssh2-sftp-client npm](https://www.npmjs.com/package/ssh2-sftp-client)
- [How to download multiple files? Issue #50](https://github.com/theophilusx/ssh2-sftp-client/issues/50)
- [SFTP recursive transfer best practices](https://www.linuxjournal.com/content/fault-tolerant-sftp-scripting-retry-failed-transfers-automatically)
- [SFTP symlink handling](https://forum.filezilla-project.org/viewtopic.php?t=51515)
- [Automatic reconnect on failure - ComponentPro](https://doc.componentpro.com/ComponentPro-Sftp/automatic-reconnect-on-failure)
- [SFTP file permissions preservation](https://access.redhat.com/solutions/3291161)

**PDF Preview:**
- [Memory leak - react-pdf Issue #718](https://github.com/diegomura/react-pdf/issues/718)
- [Memory consumption after rendering - react-pdf Issue #305](https://github.com/wojtekmaj/react-pdf/issues/305)
- [Memory leak phenomenon pdf.worker.js - Issue #504](https://github.com/wojtekmaj/react-pdf/issues/504)
- [Performance issues large PDFs - Discussion #1691](https://github.com/wojtekmaj/react-pdf/discussions/1691)
- [How to Fix Memory Leaks in JavaScript PDF Viewers](https://medium.com/syncfusion/how-to-fix-memory-leaks-in-javascript-pdf-viewers-best-practices-and-debugging-tips-ba9037ea2884)

**Electron Security:**
- [Security | Electron Official Docs](https://www.electronjs.org/docs/latest/tutorial/security)
- [Context Isolation | Electron](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Modern Alchemy: Turning XSS into RCE - Doyensec](https://blog.doyensec.com/2017/08/03/electron-framework-security.html)
- [CVE-2024-1648: XSS in electron-pdf](https://security.snyk.io/vuln/SNYK-JS-ELECTRONPDF-6253730)
- [Penetration Testing of Electron Apps](https://deepstrike.io/blog/penetration-testing-of-electron-based-applications)

**Memory and Performance:**
- [Overcoming Memory Issues in Electron Apps](https://infinitejs.com/posts/overcoming-memory-issues-electron-apps/)
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Out of memory with fastPut - ssh2 Issue #316](https://github.com/mscdex/ssh2/issues/316)
- [Connection reuse in AWS Lambda - Issue #364](https://github.com/theophilusx/ssh2-sftp-client/issues/364)

**IPC and File Transfer:**
- [How to efficiently pass large array - Electron Issue #1948](https://github.com/electron/electron/issues/1948)
- [Inter-Process Communication | Electron](https://www.electronjs.org/docs/latest/tutorial/ipc)
