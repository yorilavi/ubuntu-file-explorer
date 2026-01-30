# Phase 12: Folder Upload - Research

**Researched:** 2026-01-30
**Domain:** Recursive folder upload via SFTP, progress tracking, cancellation handling
**Confidence:** HIGH

## Summary

This phase implements recursive folder upload functionality for an Electron app that already has working single-file upload infrastructure using raw ssh2. The research identified that the existing codebase uses ssh2 directly (not ssh2-sftp-client as mentioned in the roadmap), so the implementation must build on the existing patterns in `file-operations-service.ts`.

The key technical challenges are: (1) enumerating local folders efficiently without memory explosion, (2) creating remote directory trees before uploading files, (3) tracking progress across multiple files with cancellation support, and (4) filtering macOS metadata files based on the showHiddenFiles setting.

Node.js 24.x (project's version) supports the native `fs.readdir` with `recursive: true` option (added in Node 18.17.0), eliminating the need for external packages. The existing single-file upload pattern using streams with AbortController provides a solid foundation that should be extended for batch operations.

**Primary recommendation:** Build a folder upload service that (1) enumerates local folder contents using native fs.readdir recursive, (2) creates remote directory tree first with a recursive mkdir helper, (3) uploads files sequentially respecting existing concurrency limits, and (4) tracks overall progress with per-file status for retry capability.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ssh2 | ^1.17.0 | SFTP operations | Already in use; raw control needed |
| fs/promises | (Node built-in) | Local file enumeration | Native recursive readdir, no deps |
| path | (Node built-in) | Cross-platform path handling | Use path.posix for remote paths |
| electron dialog | (Electron built-in) | Folder picker | showOpenDialog with openDirectory |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-virtual | ^3.13.18 | Already in project | If file list in progress UI needs virtualization |
| sonner | ^2.0.7 | Already in project | Toast notifications for completion/errors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fs.readdir recursive | readdirp package | Native is sufficient for Node 18.17+; no external dep needed |
| Sequential upload | Parallel with p-limit | Project already has 10-20 concurrent limit logic; respect existing patterns |
| Custom recursive mkdir | ssh2-sftp-client | Would add dependency; project deliberately uses raw ssh2 |

**Installation:**
```bash
# No new dependencies needed - use existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   ├── ssh/
│   │   ├── sftp-service.ts           # Add mkdir helper (existing file)
│   │   ├── file-operations-service.ts # Add folder upload (existing file)
│   │   └── types.ts                   # Add FolderUploadProgress type
│   └── ipc/
│       └── file-operations-handlers.ts # Add folder upload handler (existing file)
├── preload/
│   └── preload.ts                     # Add uploadFolder IPC (existing file)
└── renderer/
    └── components/
        ├── FolderUploadProgress.tsx   # NEW: Progress UI component
        └── FileItem.tsx               # Add upload folder context menu (existing file)
```

### Pattern 1: Recursive Mkdir Helper
**What:** Create remote directory trees before uploading files
**When to use:** Before starting any file uploads in a folder upload operation
**Example:**
```typescript
// Source: Based on ssh2-sftp-client patterns (adapted for raw ssh2)
async function mkdirRecursive(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  const parts = remotePath.split('/').filter(Boolean);
  let current = '';

  for (const part of parts) {
    current = current + '/' + part;

    try {
      await new Promise<void>((resolve, reject) => {
        sftp.stat(current, (err) => {
          if (err) {
            // Directory doesn't exist, create it
            sftp.mkdir(current, (mkdirErr) => {
              if (mkdirErr && mkdirErr.code !== 4) { // 4 = already exists
                reject(mkdirErr);
              } else {
                resolve();
              }
            });
          } else {
            resolve(); // Already exists
          }
        });
      });
    } catch (err) {
      throw new Error(`Failed to create directory ${current}: ${err}`);
    }
  }
}
```

### Pattern 2: Local Folder Enumeration with Filtering
**What:** Enumerate local folder contents with filter for hidden/metadata files
**When to use:** At start of folder upload to build file list
**Example:**
```typescript
// Source: Node.js fs documentation (Node 20.1.0+)
import { readdir, stat } from 'fs/promises';
import path from 'path';

interface LocalFileEntry {
  localPath: string;    // Absolute local path
  relativePath: string; // Path relative to source folder
  isDirectory: boolean;
  size: number;
}

async function enumerateFolder(
  sourcePath: string,
  showHidden: boolean
): Promise<LocalFileEntry[]> {
  const entries: LocalFileEntry[] = [];

  // Use recursive readdir (Node 18.17.0+)
  const files = await readdir(sourcePath, { recursive: true, withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(file.parentPath || file.path, file.name);
    const relativePath = path.relative(sourcePath, fullPath);

    // Filter hidden files if needed
    if (!showHidden) {
      // Skip .DS_Store, ._ files, and other dotfiles
      const segments = relativePath.split(path.sep);
      const hasHidden = segments.some(seg =>
        seg.startsWith('.') || seg === '.DS_Store'
      );
      if (hasHidden) continue;
    }

    entries.push({
      localPath: fullPath,
      relativePath,
      isDirectory: file.isDirectory(),
      size: file.isDirectory() ? 0 : (await stat(fullPath)).size,
    });
  }

  return entries;
}
```

### Pattern 3: Folder Upload with Progress Tracking
**What:** Upload folder with overall "X of Y files" progress and per-file tracking
**When to use:** Main folder upload operation
**Example:**
```typescript
// Source: Based on existing file-operations-service.ts patterns
interface FolderUploadProgress {
  currentFile: string;
  currentFileIndex: number;
  totalFiles: number;
  overallPercent: number;  // (completedFiles / totalFiles) * 100
  currentFilePercent: number;
  failedFiles: Array<{ path: string; error: string }>;
}

async function uploadFolder(
  serverId: string,
  localFolder: string,
  remoteDir: string,
  showHidden: boolean,
  onProgress: (progress: FolderUploadProgress) => void,
  signal: AbortSignal
): Promise<{ success: boolean; failedFiles: Array<{ path: string; error: string }> }> {
  // 1. Enumerate local folder
  const entries = await enumerateFolder(localFolder, showHidden);
  const files = entries.filter(e => !e.isDirectory);
  const directories = entries.filter(e => e.isDirectory);

  const folderName = path.basename(localFolder);
  const remoteBase = path.posix.join(remoteDir, folderName);

  // 2. Create all remote directories first
  const sftp = await getSFTPWrapper(serverId);
  await mkdirRecursive(sftp, remoteBase);
  for (const dir of directories) {
    if (signal.aborted) throw new Error('Operation cancelled');
    const remotePath = path.posix.join(remoteBase, dir.relativePath.split(path.sep).join('/'));
    await mkdirRecursive(sftp, remotePath);
  }

  // 3. Upload files with progress
  const failedFiles: Array<{ path: string; error: string }> = [];

  for (let i = 0; i < files.length; i++) {
    if (signal.aborted) throw new Error('Operation cancelled');

    const file = files[i];
    const remotePath = path.posix.join(remoteBase, file.relativePath.split(path.sep).join('/'));
    const remoteFileDir = path.posix.dirname(remotePath);

    try {
      await uploadFileInternal(
        sftp,
        file.localPath,
        remoteFileDir,
        (percent) => {
          onProgress({
            currentFile: file.relativePath,
            currentFileIndex: i + 1,
            totalFiles: files.length,
            overallPercent: Math.round((i / files.length) * 100 + (percent / files.length)),
            currentFilePercent: percent,
            failedFiles,
          });
        }
      );
    } catch (err) {
      failedFiles.push({
        path: file.relativePath,
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  }

  return { success: failedFiles.length === 0, failedFiles };
}
```

### Pattern 4: Cancellation with Cleanup
**What:** Cancel folder upload and clean up partial transfers
**When to use:** When user cancels (ESC key or cancel button)
**Example:**
```typescript
// Source: Based on existing cancelOperation pattern
async function cancelFolderUpload(
  operationId: string,
  remoteBasePath: string,
  uploadedFiles: string[]
): Promise<void> {
  // 1. Abort the operation
  cancelOperation(operationId);

  // 2. Optional: Clean up uploaded files (configurable)
  // Note: May want to offer user choice to keep partial uploads
  const sftp = await getSFTPWrapper(serverId);

  // Delete files in reverse order (deepest first)
  for (const filePath of uploadedFiles.reverse()) {
    try {
      await new Promise<void>((resolve) => {
        sftp.unlink(filePath, () => resolve());
      });
    } catch {
      // Ignore cleanup errors
    }
  }

  // Note: Recursive directory deletion is complex
  // For MVP, leave empty directories created
}
```

### Anti-Patterns to Avoid
- **Enumerating entire folder into memory at once for huge folders:** Use streaming enumeration or async iteration for very large folders (10K+ files)
- **Creating directories during file upload:** Create all directories first to avoid race conditions
- **Ignoring existing directories:** Always check if directory exists before mkdir (stat first)
- **Using path.join for remote paths:** Always use path.posix.join for remote SFTP paths
- **Uploading all files in parallel:** Respect the existing 10-20 concurrent connection limit

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local folder enumeration | Custom recursive walker | fs.readdir recursive | Native Node.js, tested, handles edge cases |
| Path normalization | String manipulation | path / path.posix | Cross-platform handling built-in |
| Folder picker dialog | Custom file picker | Electron dialog.showOpenDialog | Native macOS UI, accessibility |
| Progress bar in dock | Custom implementation | BrowserWindow.setProgressBar | Already used in existing file ops |
| File filtering | Custom glob matching | Simple string checks | .DS_Store/._ are simple patterns |

**Key insight:** The existing single-file upload infrastructure in file-operations-service.ts handles streams, progress, and cancellation correctly. Folder upload should compose these existing primitives rather than reimplementing them.

## Common Pitfalls

### Pitfall 1: Memory Explosion on Large Folders
**What goes wrong:** App crashes or freezes when uploading folders with thousands of files
**Why it happens:** Loading entire file list into memory at once; creating too many concurrent upload promises
**How to avoid:** Use streaming enumeration; process files in batches; limit concurrent uploads
**Warning signs:** Memory usage grows unbounded; GC pauses become frequent

### Pitfall 2: Remote Path Separator Issues
**What goes wrong:** Directories not created correctly on Linux servers
**Why it happens:** Using Windows-style backslashes or native path.join for remote paths
**How to avoid:** Always use path.posix.join() and forward slashes for remote SFTP paths
**Warning signs:** "No such file" errors when uploading; weird directory names

### Pitfall 3: Directory Creation Race Conditions
**What goes wrong:** mkdir fails with "already exists" or files fail with "no such directory"
**Why it happens:** Creating directories and uploading files concurrently without ordering
**How to avoid:** Create all directories first (depth-first), then upload files
**Warning signs:** Intermittent failures; works sometimes, fails other times

### Pitfall 4: Incomplete Progress on Cancel
**What goes wrong:** Progress bar shows 50% but only 10% of files were actually uploaded
**Why it happens:** Counting scheduled files as progress instead of completed files
**How to avoid:** Track actually completed uploads; show "X of Y complete" not "X of Y started"
**Warning signs:** Mismatch between progress UI and actual server state

### Pitfall 5: .DS_Store Leaking to Server
**What goes wrong:** macOS metadata files appear on Linux servers
**Why it happens:** Not filtering .DS_Store and ._ files based on showHiddenFiles setting
**How to avoid:** Check showHiddenFiles state; filter .DS_Store, ._, and other dotfiles
**Warning signs:** .DS_Store files visible on remote server

### Pitfall 6: Electron 37+ Directory Picker Bug
**What goes wrong:** Dialog shows file picker instead of directory picker
**Why it happens:** Known bug in Electron 37.x with openDirectory property
**How to avoid:** Project uses Electron 40.0.0 - verify this is fixed; if not, may need workaround
**Warning signs:** Users can't select folders, only files

## Code Examples

Verified patterns from official sources:

### Native Electron Folder Picker
```typescript
// Source: https://www.electronjs.org/docs/latest/api/dialog
import { dialog, BrowserWindow } from 'electron';

async function selectFolder(mainWindow: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select folder to upload',
    buttonLabel: 'Upload',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}
```

### Native fs.readdir Recursive (Node 18.17.0+)
```typescript
// Source: https://nodejs.org/api/fs.html#fsreaddirpath-options-callback
import { readdir } from 'fs/promises';

// Simple recursive listing
const entries = await readdir('/path/to/folder', {
  recursive: true,
  withFileTypes: true
});

// entries is Dirent[] with:
// - name: string
// - parentPath: string (Node 20.12.0+) or path: string (older)
// - isDirectory(): boolean
// - isFile(): boolean
// - isSymbolicLink(): boolean
```

### ssh2 SFTP mkdir (Non-recursive)
```typescript
// Source: https://github.com/mscdex/ssh2/blob/master/SFTP.md
sftp.mkdir(path, attrs, callback)
// attrs is optional { mode: 0o755 }
// callback is (err: Error | undefined)

// Example:
sftp.mkdir('/remote/path/newdir', (err) => {
  if (err && err.code !== 4) { // 4 = FAILURE (often "already exists")
    console.error('mkdir failed:', err);
  }
});
```

### ssh2 SFTP stat (Check if exists)
```typescript
// Source: https://github.com/mscdex/ssh2/blob/master/SFTP.md
sftp.stat(path, callback)
// callback is (err: Error | undefined, stats: Stats)

// Use to check if directory exists before creating:
sftp.stat('/remote/path', (err, stats) => {
  if (err) {
    // Doesn't exist - create it
  } else if (stats.isDirectory()) {
    // Already exists as directory
  } else {
    // Exists but is a file - error
  }
});
```

### Progress UI Pattern
```typescript
// Source: Based on existing patterns in App.tsx and file-operations-handlers.ts
interface FolderUploadProgress {
  currentFile: string;
  currentFileIndex: number;
  totalFiles: number;
  overallPercent: number;
  currentFilePercent: number;
  failedFiles: Array<{ path: string; error: string }>;
  status: 'enumerating' | 'creating-dirs' | 'uploading' | 'complete' | 'cancelled';
}

// IPC event for progress updates
mainWindow.webContents.send('folder-upload:progress', progress);

// Set dock progress bar
mainWindow.setProgressBar(progress.overallPercent / 100);
```

### Filter macOS Metadata Files
```typescript
// Source: macOS file system conventions
const MACOS_METADATA = ['.DS_Store', '.AppleDouble', '.Spotlight-V100', '.fseventsd'];

function shouldExclude(fileName: string, showHidden: boolean): boolean {
  if (showHidden) return false;

  // Skip dotfiles
  if (fileName.startsWith('.')) return true;

  // Skip ._ resource fork files
  if (fileName.startsWith('._')) return true;

  // Skip known macOS metadata directories
  if (MACOS_METADATA.includes(fileName)) return true;

  return false;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm package for recursive readdir | Native fs.readdir recursive | Node 18.17.0 (July 2023) | No external dependency needed |
| Manual directory walking | withFileTypes + recursive | Node 20.1.0 (April 2023) | Simpler code, better performance |
| ssh2-sftp-client uploadDir | Raw ssh2 + custom logic | Project decision | More control, matches existing patterns |

**Deprecated/outdated:**
- **readdirp package**: Still works but unnecessary with Node 18.17.0+ native recursive
- **fs.readdir without withFileTypes**: Extra stat() calls; use withFileTypes for efficiency

## Open Questions

Things that couldn't be fully resolved:

1. **Cleanup on Cancel Policy**
   - What we know: Can delete uploaded files when cancelled; can leave them
   - What's unclear: What do users expect? Delete partial uploads or keep them?
   - Recommendation: Delete uploaded files on cancel (cleaner); show toast with option to "Undo cleanup" that re-shows list of what was deleted

2. **Retry UX for Failed Files**
   - What we know: Can track which files failed and allow retry
   - What's unclear: Show inline retry button? Separate dialog? Automatic retry?
   - Recommendation: Show failed files in progress UI with "Retry" button; keep modal open until user dismisses

3. **Concurrent Upload Limit for Folder Upload**
   - What we know: Project has 10-20 concurrent transfer limit mentioned in roadmap
   - What's unclear: Is this currently enforced? Should folder upload use same limit?
   - Recommendation: Start with sequential uploads (1 at a time) for simplicity; can add parallelism later if performance is an issue

4. **Very Large Folders (10K+ files)**
   - What we know: fs.readdir recursive returns all at once; could be memory issue
   - What's unclear: What's the practical limit? Should we stream enumeration?
   - Recommendation: Test with large folders; if issues arise, switch to async generator pattern with fs.opendir

## Sources

### Primary (HIGH confidence)
- [Node.js fs documentation](https://nodejs.org/api/fs.html) - readdir recursive option, withFileTypes
- [ssh2 SFTP.md](https://github.com/mscdex/ssh2/blob/master/SFTP.md) - mkdir, stat, createWriteStream
- [Electron dialog docs](https://www.electronjs.org/docs/latest/api/dialog) - showOpenDialog with openDirectory
- Existing codebase: `src/main/ssh/file-operations-service.ts` - uploadFile, cancelOperation patterns

### Secondary (MEDIUM confidence)
- [ssh2-sftp-client GitHub](https://github.com/theophilusx/ssh2-sftp-client) - uploadDir implementation patterns
- [Electron BrowserWindow.setProgressBar](https://www.electronjs.org/docs/latest/api/browser-window#winsetprogressbarprogress-options) - Dock progress bar

### Tertiary (LOW confidence)
- [Electron 37 openDirectory bug issue](https://github.com/electron/electron/issues/48217) - May be fixed in Electron 40, needs verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing stack (ssh2, native Node.js); no new dependencies
- Architecture: HIGH - Patterns verified from existing codebase and official docs
- Pitfalls: HIGH - Based on ssh2 documentation and common SFTP issues

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (30 days - stable patterns)
