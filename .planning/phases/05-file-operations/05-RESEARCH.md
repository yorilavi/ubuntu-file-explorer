# Phase 5: File Operations - Research

**Researched:** 2026-01-27
**Domain:** SFTP file transfers (download/upload/delete/rename/move) in Electron
**Confidence:** HIGH

## Summary

This phase implements file operations (download, upload, delete, rename, move) using the existing ssh2 SFTP infrastructure already established in Phase 2. The project has a working `sftp-service.ts` with a cached SFTP wrapper pattern (`getSFTPWrapper()`) that should be reused for all file operations.

The ssh2 library (v1.17.0, already installed) provides all necessary SFTP methods: `createReadStream`/`createWriteStream` for transfers, `unlink` for delete, `rename` for rename/move, and `mkdir`/`rmdir` for directory operations. Electron's native `dialog` module provides file pickers (`showOpenDialog`/`showSaveDialog`) and confirmation dialogs (`showMessageBox`). Progress reporting uses Electron's `BrowserWindow.setProgressBar()` for taskbar/dock progress.

**Primary recommendation:** Extend the existing `sftp-service.ts` and add a new `file-operations-handlers.ts` for IPC, using the established patterns from `ssh-handlers.ts` and `preview-handlers.ts`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ssh2 | 1.17.0 | SFTP operations | Already installed, provides full SFTP API |
| electron (dialog) | 40.0.0 | Native file pickers | Built-in, cross-platform file/save dialogs |
| electron (BrowserWindow) | 40.0.0 | Progress indication | setProgressBar() for taskbar/dock progress |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| path (Node.js built-in) | - | Path manipulation | Cross-platform path joining for local paths |
| fs/promises (Node.js) | - | Local file operations | Writing downloaded files, reading uploads |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ssh2 (raw) | ssh2-sftp-client | Simpler API but adds dependency; ssh2 already works |
| Manual progress | electron-progressbar | Taskbar progress is sufficient for MVP |

**Installation:**
```bash
# No additional packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   ├── ipc/
│   │   └── file-operations-handlers.ts  # NEW: IPC handlers for file ops
│   └── ssh/
│       └── sftp-service.ts              # EXTEND: Add file operation methods
├── preload/
│   └── preload.ts                       # EXTEND: Expose file operation APIs
└── shared/
    └── types.ts                         # EXTEND: Add file operation types
```

### Pattern 1: Reuse Cached SFTP Session
**What:** Use `getSFTPWrapper(serverId)` from existing sftp-service.ts for all operations
**When to use:** Every file operation (download, upload, delete, rename, move)
**Example:**
```typescript
// Source: Existing pattern in preview-handlers.ts
export async function downloadFile(
  serverId: string,
  remotePath: string,
  localPath: string,
  onProgress: (percent: number) => void
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }
  // Use sftp.createReadStream() for download
}
```

### Pattern 2: Stream-Based Transfers with Progress
**What:** Use createReadStream/createWriteStream with progress callbacks
**When to use:** Download and upload operations
**Example:**
```typescript
// Source: ssh2 SFTP.md documentation
// Download with progress tracking
const readStream = sftp.createReadStream(remotePath);
const writeStream = fs.createWriteStream(localPath);

let bytesTransferred = 0;
readStream.on('data', (chunk: Buffer) => {
  bytesTransferred += chunk.length;
  const percent = Math.round((bytesTransferred / fileSize) * 100);
  onProgress(percent);
});

readStream.pipe(writeStream);
```

### Pattern 3: Confirmation Before Destructive Operations
**What:** Show native confirmation dialog before delete
**When to use:** Delete operations (files and folders)
**Example:**
```typescript
// Source: Electron dialog documentation
import { dialog, BrowserWindow } from 'electron';

const result = await dialog.showMessageBox(mainWindow, {
  type: 'warning',
  message: `Delete "${fileName}"?`,
  detail: 'This action cannot be undone.',
  buttons: ['Cancel', 'Delete'],
  defaultId: 0,
  cancelId: 0,
});

if (result.response === 1) {
  // User confirmed, proceed with deletion
  await sftp.unlink(remotePath);
}
```

### Pattern 4: Native File Picker for Downloads
**What:** Use showSaveDialog to let user choose download location
**When to use:** Download operations
**Example:**
```typescript
// Source: Electron dialog documentation
const result = await dialog.showSaveDialog(mainWindow, {
  defaultPath: fileName,
  filters: [{ name: 'All Files', extensions: ['*'] }],
});

if (!result.canceled && result.filePath) {
  // Proceed with download to result.filePath
}
```

### Anti-Patterns to Avoid
- **Opening new SFTP channels per operation:** Reuse `getSFTPWrapper()` - channel creation is expensive
- **Using fastGet/fastPut for small files:** Stream-based is simpler; fastGet/fastPut are for large files with parallelism
- **Deleting without confirmation:** Always confirm destructive operations
- **Blocking UI during transfers:** Use progress callbacks and async patterns

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File picker dialog | Custom React modal | `dialog.showOpenDialog()` | Native OS look, handles edge cases |
| Save location dialog | Custom file path input | `dialog.showSaveDialog()` | Native OS look, overwrite warnings |
| Confirmation dialog | Custom React confirm | `dialog.showMessageBox()` | Native OS look, modal behavior |
| Taskbar progress | Custom progress indicator | `BrowserWindow.setProgressBar()` | Native OS integration |
| Path manipulation | String concatenation | `path.join()`, `path.basename()` | Cross-platform compatibility |

**Key insight:** Electron provides native dialogs that match OS conventions and handle edge cases (permissions, existing files, etc.) that custom UI would need to implement.

## Common Pitfalls

### Pitfall 1: Missing Filename in Destination Path
**What goes wrong:** SFTP operations fail with generic "Failure" error
**Why it happens:** Passing directory path instead of full file path for upload destination
**How to avoid:** Always construct full path: `path.posix.join(remoteDirPath, fileName)`
**Warning signs:** Error code 4 (SFTP failure) on upload

### Pitfall 2: Not Handling SFTP Session Errors
**What goes wrong:** Operations fail silently or crash
**Why it happens:** SFTP sessions can become invalid if SSH connection drops
**How to avoid:**
  - Check `getSFTPWrapper()` return value before use
  - Wrap operations in try/catch
  - Re-fetch SFTP wrapper on error
**Warning signs:** "Channel not open" errors, undefined sftp wrapper

### Pitfall 3: Blocking Main Process During Transfers
**What goes wrong:** UI freezes, window becomes unresponsive
**Why it happens:** Large file transfers block the event loop
**How to avoid:**
  - Use streams with event-based progress
  - Break into chunks
  - Send progress updates to renderer
**Warning signs:** Application not responding during transfers

### Pitfall 4: Race Conditions on Rename/Move
**What goes wrong:** File not found errors or overwriting existing files
**Why it happens:** Checking existence then operating is not atomic
**How to avoid:**
  - Let SFTP operation fail if target exists
  - Catch specific error codes
  - Offer user choice on conflict
**Warning signs:** Intermittent failures, lost files

### Pitfall 5: Symlink Confusion on Delete
**What goes wrong:** Following symlink and deleting target instead of link
**Why it happens:** `unlink` removes symlinks but user might expect different behavior
**How to avoid:**
  - Check `isSymlink` before delete
  - Show clear messaging about what will be deleted
**Warning signs:** Unexpected data loss via symlinks

### Pitfall 6: Using POSIX Paths for Local Files
**What goes wrong:** Download fails on Windows due to path format
**Why it happens:** Mixing remote (POSIX) and local (OS-specific) path formats
**How to avoid:**
  - Remote paths: Use `path.posix.join()`
  - Local paths: Use `path.join()` (OS-aware)
**Warning signs:** Path errors on Windows only

## Code Examples

Verified patterns from official sources:

### Download File with Progress
```typescript
// Source: ssh2 SFTP documentation + existing preview-handlers.ts pattern
import { createWriteStream } from 'fs';
import { getSFTPWrapper } from '../ssh/sftp-service';
import type { Stats } from 'ssh2';

export async function downloadFile(
  serverId: string,
  remotePath: string,
  localPath: string,
  onProgress: (percent: number) => void
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  // Get file stats for progress calculation
  const stats = await new Promise<Stats>((resolve, reject) => {
    sftp.stat(remotePath, (err, s) => (err ? reject(err) : resolve(s)));
  });

  return new Promise((resolve, reject) => {
    const readStream = sftp.createReadStream(remotePath);
    const writeStream = createWriteStream(localPath);

    let bytesTransferred = 0;

    readStream.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
      const percent = Math.round((bytesTransferred / stats.size) * 100);
      onProgress(percent);
    });

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);

    readStream.pipe(writeStream);
  });
}
```

### Upload File with Progress
```typescript
// Source: ssh2 SFTP documentation
import { createReadStream, statSync } from 'fs';
import path from 'path';
import { getSFTPWrapper } from '../ssh/sftp-service';

export async function uploadFile(
  serverId: string,
  localPath: string,
  remoteDirPath: string,
  onProgress: (percent: number) => void
): Promise<string> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  const fileName = path.basename(localPath);
  const remotePath = path.posix.join(remoteDirPath, fileName);
  const fileStats = statSync(localPath);

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);

    let bytesTransferred = 0;

    readStream.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
      const percent = Math.round((bytesTransferred / fileStats.size) * 100);
      onProgress(percent);
    });

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => resolve(remotePath));

    readStream.pipe(writeStream);
  });
}
```

### Delete File/Folder
```typescript
// Source: ssh2 SFTP documentation
export async function deleteRemoteFile(
  serverId: string,
  remotePath: string
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function deleteRemoteFolder(
  serverId: string,
  remotePath: string
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  // Note: rmdir only works on empty directories
  // For recursive delete, need to list and delete contents first
  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
```

### Rename/Move File
```typescript
// Source: ssh2 SFTP documentation
// Note: rename() works for both rename and move operations
export async function renameRemoteFile(
  serverId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  const sftp = await getSFTPWrapper(serverId);
  if (!sftp) {
    throw new Error('Not connected to server');
  }

  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
```

### Electron File Picker Integration
```typescript
// Source: Electron dialog documentation
import { dialog, BrowserWindow } from 'electron';

export async function showDownloadDialog(
  mainWindow: BrowserWindow,
  defaultFileName: string
): Promise<string | null> {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFileName,
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  });

  return result.canceled ? null : result.filePath;
}

export async function showUploadDialog(
  mainWindow: BrowserWindow
): Promise<string[] | null> {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
  });

  return result.canceled ? null : result.filePaths;
}

export async function showDeleteConfirmation(
  mainWindow: BrowserWindow,
  fileName: string,
  isDirectory: boolean
): Promise<boolean> {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    message: `Delete ${isDirectory ? 'folder' : 'file'} "${fileName}"?`,
    detail: 'This action cannot be undone.',
    buttons: ['Cancel', 'Delete'],
    defaultId: 0,
    cancelId: 0,
  });

  return result.response === 1;
}
```

### Progress Bar in Taskbar/Dock
```typescript
// Source: Electron progress bar tutorial
export function setTransferProgress(
  mainWindow: BrowserWindow,
  progress: number // 0-100
): void {
  if (progress < 0) {
    // Remove progress bar
    mainWindow.setProgressBar(-1);
  } else if (progress >= 100) {
    // Show complete briefly, then remove
    mainWindow.setProgressBar(1);
    setTimeout(() => mainWindow.setProgressBar(-1), 1000);
  } else {
    // Show progress (0-1 range)
    mainWindow.setProgressBar(progress / 100);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ssh2-streams package | Built into ssh2 | ssh2 v1.0.0 (2020) | Simplified API |
| Callback-only API | Promises + callbacks | Ongoing | Use Promise wrappers |
| Sync dialogs | Async dialogs preferred | Electron 10+ | Use async for macOS stability |

**Deprecated/outdated:**
- `dialog.showOpenDialogSync` on macOS: Can cause issues with sheet expansion; prefer async version
- ssh2-streams: Merged into ssh2 main package

## Open Questions

Things that couldn't be fully resolved:

1. **Recursive folder deletion**
   - What we know: `rmdir()` only works on empty directories
   - What's unclear: Best UX for recursive delete (confirm each? bulk confirm?)
   - Recommendation: For MVP, only allow delete of empty folders or single files. Recursive delete can be Phase 2.

2. **Upload conflict handling**
   - What we know: SFTP rename/write to existing file will overwrite
   - What's unclear: Best UX for upload to existing file (rename? overwrite? skip?)
   - Recommendation: Use `showOverwriteConfirmation` in save dialog for downloads; for uploads, check existence first and prompt.

3. **Large file handling (>50MB)**
   - What we know: Preview already has 50MB limit; transfers should handle larger
   - What's unclear: Should there be a size limit for transfers?
   - Recommendation: No hard limit, but show warning for files >100MB about potential timeout.

## Sources

### Primary (HIGH confidence)
- [ssh2 GitHub - SFTP.md](https://github.com/mscdex/ssh2) - Full SFTP API documentation
- [Electron Dialog API](https://www.electronjs.org/docs/latest/api/dialog) - showOpenDialog, showSaveDialog, showMessageBox
- [Electron Progress Bar](https://www.electronjs.org/docs/latest/tutorial/progress-bar) - setProgressBar API

### Secondary (MEDIUM confidence)
- [ssh2-sftp-client npm](https://www.npmjs.com/package/ssh2-sftp-client) - API patterns and best practices (verified against ssh2 docs)
- Existing project code: `sftp-service.ts`, `preview-handlers.ts`, `ssh-handlers.ts`

### Tertiary (LOW confidence)
- WebSearch results for SFTP pitfalls - patterns verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ssh2 already installed and working, Electron dialog is built-in
- Architecture: HIGH - Following established patterns in existing codebase
- Pitfalls: MEDIUM - Common patterns from multiple sources, some project-specific

**Research date:** 2026-01-27
**Valid until:** 60 days (ssh2 and Electron are stable APIs)
