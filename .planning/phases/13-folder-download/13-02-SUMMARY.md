# Phase 13 Plan 02: IPC Layer for Folder Download

IPC handlers and preload API wiring for folder download with progress events and cancellation support.

## What Was Built

### IPC Handlers (file-operations-handlers.ts)

Three new IPC handlers registered in `registerFileOperationsHandlers`:

1. **`file-ops:download-folder`** - Main download handler
   - Shows native folder picker dialog (`openDirectory`, `createDirectory` properties)
   - Invokes `downloadFolder` service with progress callback
   - Sends progress updates via `file-ops:folder-download-progress` channel
   - Updates dock progress bar during download
   - Returns `FolderDownloadResult` with localPath, downloadedCount, failedFiles

2. **`file-ops:cancel-folder-download`** - Cancellation handler
   - Invokes `cancelFolderDownload` service
   - Clears dock progress bar
   - Returns success boolean

3. **`file-ops:retry-failed-downloads`** - Retry handler
   - Invokes `retryFailedDownloads` service
   - Sends progress updates via same channel
   - Returns result with retry success/failure details

### Preload API (preload.ts)

Four new methods exposed on `window.electronAPI`:

1. **`downloadFolder(serverId, remotePath, conflictStrategy)`** - Initiates folder download
2. **`onFolderDownloadProgress(callback)`** - Subscribes to progress updates, returns unsubscribe function
3. **`cancelFolderDownload(operationId)`** - Cancels active download
4. **`retryFailedDownloads(serverId, remoteFolderPath, localBasePath, failedFiles, conflictStrategy)`** - Retries specific failed files

### Shared Types (shared/types.ts)

Three new types exported:

- **`ConflictStrategy`** - Union type: 'rename' | 'overwrite' | 'skip'
- **`FolderDownloadProgress`** - Progress with totalFiles, completedFiles, currentFile, percent, totalBytes, downloadedBytes, failedFiles
- **`FolderDownloadResult`** - Result with success, downloadedCount, failedFiles, operationId, cancelled, error, localPath

## Key Implementation Details

### Progress Flow

```
downloadFolder call
    -> dialog.showOpenDialog (folder picker)
    -> downloadFolder service (folder-download-service.ts)
        -> onProgress callback
            -> webContents.send('file-ops:folder-download-progress')
            -> mainWindow.setProgressBar(progress)
    -> return FolderDownloadResult
```

### Type Duplication

Types are duplicated in preload.ts for isolation from main process types, following the established pattern from folder upload implementation.

### Dock Progress Bar

Progress bar uses ratio: `completedFiles / totalFiles`. Cleared to -1 on completion, error, or cancellation.

## Files Changed

| File | Changes |
|------|---------|
| src/main/ipc/file-operations-handlers.ts | +134 lines: folder download/cancel/retry handlers |
| src/preload/preload.ts | +71 lines: API methods and types |
| src/shared/types.ts | +52 lines: download types for renderer |

## Commits

| Hash | Message |
|------|---------|
| d68e6b9 | feat(13-02): add folder download IPC handlers |
| e0ff88c | feat(13-02): expose folder download API in preload |

## Verification

- [x] TypeScript compiles without errors
- [x] IPC handlers registered for all three channels
- [x] Preload exposes downloadFolder, onFolderDownloadProgress, cancelFolderDownload, retryFailedDownloads
- [x] Shared types include ConflictStrategy, FolderDownloadProgress, FolderDownloadResult
- [x] Progress events include operationId for multi-operation tracking

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use same progress channel pattern as folder upload | Consistency across upload/download features |
| Include operationId in progress events | Enables UI to track multiple concurrent operations |
| Dock progress based on file count not bytes | Simpler, matches folder upload pattern |

## Next Phase Readiness

Plan 03 can now integrate the UI:
- Context menu can invoke `window.electronAPI.downloadFolder()`
- Progress component can subscribe via `onFolderDownloadProgress()`
- Cancel button can call `cancelFolderDownload()`
- Retry button can call `retryFailedDownloads()`

---
*Completed: 2026-01-30 | Duration: ~2 minutes*
