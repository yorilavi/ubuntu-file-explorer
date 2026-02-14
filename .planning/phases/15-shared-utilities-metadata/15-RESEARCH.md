# Phase 15: Shared Utilities & Metadata - Research

**Researched:** 2026-02-10
**Domain:** React hook extraction, file metadata formatting, extension-to-kind mapping
**Confidence:** HIGH

## Summary

Phase 15 has two independent deliverables: (1) extracting the context menu and its file operations from FileItem.tsx into a reusable hook, and (2) creating shared format utilities for file size, dates, and kind labels. Both are pure refactoring and utility creation -- no new backend/IPC work is needed since SFTP readdir already returns `size`, `modified`, `permissions`, `uid`, `gid` on every `FileEntry`.

The codebase currently has **4 separate copies** of a `formatSize`/`formatBytes` function (FileItem.tsx, FileRow.tsx, PreviewPanel.tsx, ImagePreview.tsx, PDFPreview.tsx), **2 copies** of `formatDate`, and **1 copy** of `formatPermissions`. Extension-to-type/language mappings exist in at least 3 places (App.tsx constants, preview-handlers.ts `detectFileType`, FileRow.tsx implicitly). This duplication is exactly what needs consolidating.

FileItem.tsx is 763 lines long with the context menu logic, file operations (download, upload, delete, rename, move, folder upload, folder download, retry), state management (toasts, progress tracking, cancellation), and render logic all in a single component. Extracting the non-render logic into a `useContextMenu` and/or `useFileOperations` hook is the highest-risk refactor because every file operation must continue working identically after extraction.

**Primary recommendation:** Create `src/renderer/utils/formatters.ts` for pure formatting functions, `src/renderer/utils/fileKinds.ts` for extension-to-kind mapping, and `src/renderer/hooks/useFileContextMenu.ts` for the context menu hook. Test the hook extraction against all existing context menu behaviors before considering it done.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.4 | Custom hooks, useCallback, useRef, useState, useEffect | Already in project |
| TypeScript | ^5.5.0 | Type-safe utility functions and hook interfaces | Already in project |
| sonner | ^2.0.7 | Toast notifications in file operations | Already in project, used by context menu |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dom | ^19.2.4 | createPortal for context menu rendering | Already used in FileItem.tsx |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled formatters | date-fns / Intl.DateTimeFormat | Intl is built-in and sufficient; date-fns overkill for 1 format |
| Extension map object | mime-types npm package | Too heavy; we only need display labels, not MIME types |
| Single mega-hook | Multiple focused hooks | Multiple hooks are more composable and testable |

**Installation:**
No new dependencies needed. All work uses existing project dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── renderer/
│   ├── utils/                    # NEW directory
│   │   ├── formatters.ts         # formatSize, formatDate, formatPermissions
│   │   └── fileKinds.ts          # getFileKind(), extension-to-label map
│   ├── hooks/
│   │   ├── useFileContextMenu.ts # NEW: extracted from FileItem.tsx
│   │   ├── useColumnNavigation.ts
│   │   ├── usePreview.ts
│   │   └── useFavorites.ts
│   └── components/
│       ├── FileItem.tsx          # SLIMMED: uses hook, no inline operations
│       └── FileRow.tsx           # UPDATED: imports from utils/formatters
```

### Pattern 1: Pure Utility Functions (formatters.ts)
**What:** Stateless, side-effect-free functions that transform data.
**When to use:** Formatting values for display (sizes, dates, kind labels).
**Why this pattern:** Pure functions are trivially testable, easily shareable, and have zero coupling to React or component state.
**Example:**
```typescript
// src/renderer/utils/formatters.ts

/**
 * Format byte count to human-readable string.
 * Examples: "0 B", "4.2 KB", "1.3 MB", "2.1 GB"
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format SFTP mtime to human-readable date string.
 * Handles both Date objects and serialized date strings from IPC.
 * Output: "Jan 15, 2026, 3:42 PM"
 */
export function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Convert octal mode string to rwx permission string.
 * Example: '0755' -> 'rwxr-xr-x'
 */
export function formatPermissions(mode: string): string {
  const modeNum = parseInt(mode, 8);
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  return (
    perms[(modeNum >> 6) & 7] + perms[(modeNum >> 3) & 7] + perms[modeNum & 7]
  );
}
```

### Pattern 2: Extension-to-Kind Label Map (fileKinds.ts)
**What:** A lookup table mapping file extensions to human-readable "kind" labels (like macOS Finder's "Kind" column).
**When to use:** Displaying a file's type/kind in the list view.
**Example:**
```typescript
// src/renderer/utils/fileKinds.ts

const FILE_KIND_MAP: Record<string, string> = {
  // Images
  jpg: 'JPEG Image', jpeg: 'JPEG Image', png: 'PNG Image',
  gif: 'GIF Image', webp: 'WebP Image', svg: 'SVG Image',
  bmp: 'BMP Image', ico: 'Icon', avif: 'AVIF Image',
  // Documents
  pdf: 'PDF Document', doc: 'Word Document', docx: 'Word Document',
  xls: 'Excel Spreadsheet', xlsx: 'Excel Spreadsheet',
  ppt: 'PowerPoint', pptx: 'PowerPoint',
  // Code
  js: 'JavaScript', jsx: 'JavaScript (JSX)',
  ts: 'TypeScript', tsx: 'TypeScript (TSX)',
  py: 'Python Script', rb: 'Ruby Script',
  go: 'Go Source', rs: 'Rust Source',
  c: 'C Source', cpp: 'C++ Source', h: 'C Header',
  java: 'Java Source', kt: 'Kotlin Source',
  swift: 'Swift Source', cs: 'C# Source',
  php: 'PHP Script',
  // Web
  html: 'HTML Document', htm: 'HTML Document',
  css: 'CSS Stylesheet', scss: 'SCSS Stylesheet',
  // Data/Config
  json: 'JSON', yaml: 'YAML', yml: 'YAML',
  xml: 'XML Document', toml: 'TOML',
  csv: 'CSV Document',
  // Text
  md: 'Markdown', mdx: 'MDX Document',
  txt: 'Plain Text', log: 'Log File',
  // Shell
  sh: 'Shell Script', bash: 'Bash Script', zsh: 'Zsh Script',
  // Archives
  zip: 'ZIP Archive', tar: 'TAR Archive', gz: 'GZip Archive',
  '7z': '7-Zip Archive', rar: 'RAR Archive',
  // Media
  mp3: 'MP3 Audio', wav: 'WAV Audio', flac: 'FLAC Audio',
  mp4: 'MP4 Video', mkv: 'MKV Video', avi: 'AVI Video',
  // Config
  ini: 'Configuration', conf: 'Configuration', cfg: 'Configuration',
  env: 'Environment File',
  // Docker/DevOps
  dockerfile: 'Dockerfile',
  // SQL
  sql: 'SQL Script',
};

/**
 * Get human-readable kind label for a file.
 * Returns "Folder" for directories, extension-based label for files,
 * "Document" as fallback for unknown extensions.
 */
export function getFileKind(fileName: string, isDirectory: boolean): string {
  if (isDirectory) return 'Folder';
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return FILE_KIND_MAP[ext] || 'Document';
}
```

### Pattern 3: Hook Extraction for Context Menu (useFileContextMenu.ts)
**What:** Extract all context menu state, event handlers, file operation handlers, and progress tracking from FileItem.tsx into a reusable hook.
**When to use:** When the context menu logic needs to be shared between FileItem (column view) and a future list view row component.
**Key challenge:** FileItem.tsx has ~700 lines, with roughly 600 lines being context menu and file operation logic. The hook must preserve every behavior: rename, delete, download (with progress/cancel), upload (with progress/cancel), move, add to favorites, folder upload (with progress/cancel/retry), folder download (with progress/cancel/retry).

**Hook interface design:**
```typescript
// src/renderer/hooks/useFileContextMenu.ts

interface UseFileContextMenuProps {
  file: FileEntry;
  serverId: string;
  showHiddenFiles: boolean;
  onRefresh: () => void;
  onRefreshChild?: () => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
}

interface UseFileContextMenuResult {
  // Context menu state
  contextMenu: { x: number; y: number } | null;
  handleContextMenu: (e: React.MouseEvent) => void;

  // Rename state
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (value: string) => void;
  handleRenameStart: () => void;
  handleRenameConfirm: () => Promise<void>;
  cancelRename: () => void;

  // File operation handlers
  handleDownload: () => Promise<void>;
  handleUpload: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleMoveTo: () => void;
  handleAddToFavorites: () => Promise<void>;
  handleUploadFolder: () => Promise<void>;
  handleDownloadFolder: () => Promise<void>;
}
```

### Anti-Patterns to Avoid
- **Extracting too little into the hook:** If only the context menu position state is extracted but file operations stay in the component, the hook provides minimal value. The entire file operation lifecycle (initiate, track progress, handle cancellation, show toast, cleanup) must move together.
- **Breaking the toast reference chain:** The current code uses `activeToastRef` to update in-progress toasts. If the hook returns a new ref on each render, toast updates will target stale toast IDs. Use `useRef` inside the hook, not in the component.
- **Losing the folder progress cleanup:** Folder upload/download use refs (`folderProgressCleanupRef`, `folderDownloadProgressCleanupRef`) to store cleanup functions for IPC listeners. These MUST be cleaned up in the hook's effect cleanup to prevent memory leaks.
- **Creating circular dependencies:** The retry handlers reference each other (e.g., `handleRetryFailedFiles` calls `handleUploadFolder`). When extracting to a hook, use `useCallback` with proper dependency arrays to avoid stale closures.
- **Renaming the formatSize variants differently:** The existing code uses both `formatSize` and `formatBytes` for the same operation. Consolidate on one name (`formatSize`) to avoid confusion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting | Custom string concatenation | `Date.toLocaleDateString('en-US', options)` | Handles localization edge cases, already used in FileRow.tsx |
| File size formatting | Recursive/loop-based solutions | Simple threshold-based `formatSize` | The existing pattern is proven; no edge cases worth a library |
| Extension detection | Regex-based file type detection | Simple `.split('.').pop()` lookup | Extensions are unambiguous for display labels; MIME detection not needed |
| Context menu positioning | Manual boundary detection | CSS `position: fixed` with portal | Already works via `createPortal` in the current code |

**Key insight:** All the formatting logic in this phase is simple enough that no external library is justified. The value is in consolidation (4 copies to 1), not in choosing a library.

## Common Pitfalls

### Pitfall 1: Behavioral Regression in Context Menu Extraction
**What goes wrong:** After extracting context menu logic to a hook, one or more operations (rename, delete, upload, download, move, favorites, folder upload, folder download) silently break or behave differently.
**Why it happens:** The operations depend on a complex web of refs, state, callbacks, and IPC listeners. Missing a dependency or breaking a closure chain causes subtle bugs.
**How to avoid:** Test every single context menu action after extraction: (1) right-click file -> Download, (2) right-click file -> Rename, (3) right-click file -> Delete, (4) right-click file -> Move to..., (5) right-click folder -> Upload file, (6) right-click folder -> Upload folder, (7) right-click folder -> Download folder, (8) right-click folder -> Add to Favorites, (9) right-click folder -> Rename, (10) right-click folder -> Delete. Also test: Escape to cancel active operations, progress toast updates, and cancel button on toast.
**Warning signs:** Toast not updating during transfer, Cancel button not working, Rename input not appearing, context menu not closing after action.

### Pitfall 2: IPC Date Serialization
**What goes wrong:** `formatDate` receives a string instead of a Date object because IPC serializes Date objects to ISO strings.
**Why it happens:** Electron IPC uses structured clone, which converts Date to string. The existing code in FileRow.tsx already handles this with `date instanceof Date ? date : new Date(date)`.
**How to avoid:** The shared `formatDate` must accept `Date | string` and handle both cases. This is already done in the FileRow.tsx implementation.
**Warning signs:** "Invalid Date" displayed in the UI, or dates showing as epoch (Jan 1, 1970).

### Pitfall 3: Inconsistent formatSize Implementations
**What goes wrong:** Different formatting behavior depending on which copy is used. FileItem.tsx's `formatBytes` uses `Math.log` and `parseFloat`, while FileRow.tsx and PreviewPanel.tsx use threshold-based `if/else` chains.
**Why it happens:** Functions were written independently at different times.
**How to avoid:** Choose one canonical implementation (the threshold-based one is clearer and more predictable) and replace all copies. Verify output matches expectations: `0 B`, `512 B`, `1.0 KB`, `1.5 MB`, `2.1 GB`.
**Warning signs:** Size values changing format after consolidation (e.g., "1 KB" becoming "1.0 KB" or vice versa).

### Pitfall 4: Forgetting to Update All Import Sites
**What goes wrong:** After creating shared utilities, some files still use their local copies, creating a mix of old and new.
**Why it happens:** Grep misses a variant name (`formatBytes` vs `formatSize`).
**How to avoid:** Search for ALL variant names: `formatBytes`, `formatSize`, `formatDate`, `formatPermissions`. There are exactly these locations to update:
  - `FileItem.tsx`: `formatBytes` (lines 33-39) -- remove, import from utils
  - `FileRow.tsx`: `formatSize`, `formatDate`, `formatPermissions` (lines 14-45) -- remove, import from utils
  - `PreviewPanel.tsx`: `formatSize` (line 34) -- remove, import from utils
  - `ImagePreview.tsx`: `formatSize`, `formatDate` (lines 17, 26) -- remove, import from utils
  - `PDFPreview.tsx`: `formatSize` (line 28) -- remove, import from utils

### Pitfall 5: Extension Map Missing Extensionless Files
**What goes wrong:** Files like `Makefile`, `Dockerfile`, `LICENSE`, `.gitignore` have no extension but should still show a meaningful kind.
**Why it happens:** `fileName.split('.').pop()` returns the filename itself for extensionless files, or the part after the dot for dotfiles.
**How to avoid:** Check for known full filenames (case-insensitive) before falling back to extension lookup. Example: `Makefile` -> "Makefile", `Dockerfile` -> "Dockerfile", `LICENSE` -> "Plain Text".

## Code Examples

Verified patterns from the existing codebase:

### Existing Hook Pattern (useFavorites.ts)
The project's established pattern for hooks that wrap IPC calls:
```typescript
// Pattern: hook manages state + provides action callbacks
// Returns an interface with state and bound action methods
export function useFavorites(serverId: string | null): UseFavoritesResult {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => { /* IPC call */ }, [serverId]);
  useEffect(() => { refresh(); }, [refresh]);

  return { favorites, isLoading, addFavorite, removeFavorite, reorderFavorites, refresh };
}
```

### Existing Context Menu Portal Pattern (FileItem.tsx)
```typescript
// Context menu rendered via portal to escape overflow:hidden containers
{contextMenu && createPortal(
  <div
    className="file-item__context-menu"
    style={{ top: contextMenu.y, left: contextMenu.x }}
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
  >
    {/* menu items */}
  </div>,
  document.body
)}
```

### IPC Progress Tracking Pattern (FileItem.tsx)
```typescript
// Subscribe to progress BEFORE starting operation
const cleanup = window.electronAPI.onFileOperationProgress((progress) => {
  if (activeToastRef.current === toastId) {
    toast.loading(`Downloading... ${progress.percent}%`, { id: toastId });
  }
});

try {
  const result = await window.electronAPI.downloadFile(serverId, file.path, file.name);
  // handle result...
} finally {
  cleanup();  // MUST clean up listener
  activeToastRef.current = null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline formatters in each component | Shared utils module | This phase | Eliminates 4x duplication |
| 763-line monolithic FileItem | FileItem + useFileContextMenu hook | This phase | Enables list view reuse in Phase 16/17 |
| No "Kind" column concept | Extension-to-label mapping | This phase | Enables META-03 requirement |

**No deprecated APIs involved:** All patterns use standard React hooks (useState, useCallback, useRef, useEffect) and standard TypeScript module exports.

## Open Questions

1. **Should `getFileKind` return the same labels as macOS Finder?**
   - What we know: Finder uses system-level UTI (Uniform Type Identifiers) to determine kind labels. Our app runs on a remote SFTP server where UTI is not available.
   - What's unclear: Whether users expect exact Finder parity (e.g., "JPEG image" vs "JPEG Image" vs "Image") or if reasonable labels are sufficient.
   - Recommendation: Use Finder-inspired but not Finder-identical labels. "PNG Image" is clearer than Finder's "Portable Network Graphics image" for a developer-focused tool.

2. **Should the context menu hook also include the JSX for the menu itself?**
   - What we know: The hook pattern returns state and handlers. The component renders the menu using those.
   - What's unclear: Whether the menu JSX should also be returned from the hook (as a render function) or stay in the component.
   - Recommendation: Keep JSX rendering in the component. The hook returns state (`contextMenu`, `isRenaming`) and handlers. This follows the established React pattern where hooks don't return JSX, and allows different views (column vs. list) to render the menu differently if needed.

3. **What happens to `formatBytes` in FileItem.tsx when the hook is extracted?**
   - What we know: `formatBytes` is used inside `handleDownloadFolder` for progress display. Once that handler moves to the hook, the hook will import from utils.
   - Recommendation: The hook imports `formatSize` from `utils/formatters.ts`. FileItem.tsx no longer needs any format function.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/renderer/components/FileItem.tsx` (763 lines, full context menu implementation)
- Codebase analysis: `src/renderer/components/FileRow.tsx` (orphaned list view reference with formatSize, formatDate, formatPermissions)
- Codebase analysis: `src/renderer/components/PreviewPanel/PreviewPanel.tsx` (duplicate formatSize)
- Codebase analysis: `src/renderer/components/PreviewPanel/ImagePreview.tsx` (duplicate formatSize, formatDate)
- Codebase analysis: `src/renderer/components/PreviewPanel/PDFPreview.tsx` (duplicate formatSize)
- Codebase analysis: `src/main/ipc/preview-handlers.ts` (extension-to-type mapping, lines 23-96)
- Codebase analysis: `src/renderer/App.tsx` (IMAGE_EXTS, CODE_EXTS, MARKDOWN_EXTS, PDF_EXTS constants)
- Codebase analysis: `src/shared/types.ts` (FileEntry interface with size, modified, permissions)
- Codebase analysis: `src/main/ssh/sftp-service.ts` (confirms readdir returns size, mtime, permissions)
- Codebase analysis: `src/renderer/hooks/useFavorites.ts` (established hook pattern in project)

### Secondary (MEDIUM confidence)
- [React Custom Hooks Documentation](https://react.dev/learn/reusing-logic-with-custom-hooks) - Official React docs on hook extraction patterns
- [Extract React Hook Refactoring](https://blog.rstankov.com/extract-react-hook-refactoring/) - Practical hook extraction patterns
- [Hooks Pattern](https://www.patterns.dev/react/hooks-pattern/) - Patterns.dev on hook design

### Tertiary (LOW confidence)
- macOS Finder "Kind" labels - Based on general knowledge of Finder behavior; exact label strings may differ from what Finder actually uses. Our labels are "inspired by" rather than matching Finder.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, pure refactoring of existing code
- Architecture: HIGH - Pattern follows established project conventions (useFavorites, usePreview, useColumnNavigation)
- Pitfalls: HIGH - All pitfalls identified from direct codebase analysis of the actual code being refactored
- Format utilities: HIGH - Requirements are simple and well-defined (size, date, kind)
- Hook extraction: HIGH for design, MEDIUM for implementation risk - The FileItem.tsx complexity is high (763 lines, 8+ operations, refs, IPC listeners, toast chains)

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, no external dependencies changing)
