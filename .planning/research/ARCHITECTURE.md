# Architecture: List View, Metadata Display, and Sorting Integration

**Milestone:** v1.3 List View & Metadata
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

This document defines how list view, file metadata display, and sorting integrate with the existing Electron SSH file explorer. The key finding is that **the codebase already contains unused list view components** (`DirectoryList.tsx`, `FileRow.tsx`) with full metadata display and sort logic, plus CSS for grid-based rows with columns for name, size, modified, permissions, and owner. These were created early in development, before the Miller column architecture was implemented, and are currently dead code.

The architecture work is therefore a **modernization and integration** problem, not a greenfield design. The SFTP layer (`sftp-service.ts`) already returns full `FileEntry` metadata (size, modified, permissions, uid, gid, symlink target) from `readdir` -- no additional SFTP stat calls are needed. The data already flows through IPC correctly.

**Key architectural decision:** Implement list view as a peer to ColumnView, sharing data sources via the existing IPC layer, rather than as a mode within ColumnView. The two views have fundamentally different layout needs (single scrollable table vs. multi-column horizontal scroll) that make mode-switching within ColumnView more complex than a sibling component.

---

## Current Architecture Recap

```
Main Process (Node.js + ssh2)
+-- SSH Connection Manager (ssh-service.ts)
+-- SFTP Service (sftp-service.ts) -- readdir already returns full FileEntry
+-- File Operations Service (file-operations-service.ts)
+-- Preview Cache (preview-cache.ts)
+-- IPC Handlers (ssh-handlers.ts, preview-handlers.ts, file-operations-handlers.ts)
+-- Storage (connection-store, credential-store, favorites-store, ui-preferences-store)

Preload Bridge (preload.ts)
+-- Typed contextBridge API (ElectronAPI)
+-- listDirectory, readFilePreview, file operations, UI preferences

Renderer Process (React 19)
+-- App.tsx -- orchestrator: state, routing, preview panel, lightbox
+-- ServerSidebar -- connection list + favorites
+-- ColumnView -- Miller columns container (useReducer for column state)
    +-- Column.tsx -- single column with @tanstack/react-virtual
    +-- FileItem.tsx -- compact file row (icon + name + chevron)
+-- PathBar -- breadcrumb navigation
+-- PreviewPanel -- file preview (image, code, PDF, folder, binary)
+-- Lightbox -- fullscreen preview (image, markdown, code, PDF)
+-- DirectoryList.tsx [UNUSED] -- list view with sort, metadata columns
+-- FileRow.tsx [UNUSED] -- row with icon, name, size, modified, permissions, owner
```

### Data Already Available

The `FileEntry` type already carries all metadata needed for list view display:

```typescript
interface FileEntry {
  name: string;        // File or directory name
  path: string;        // Full absolute path
  size: number;        // Size in bytes (already populated by readdir)
  modified: Date;      // Last modification time (from mtime)
  isDirectory: boolean;
  isSymlink: boolean;
  permissions: string; // Unix permissions as octal string (e.g., '0755')
  uid: number;         // Owner user ID
  gid: number;         // Owner group ID
  target?: string;     // Symlink target path
}
```

**Critical insight:** The SFTP `readdir` call in `sftp-service.ts` (line 100-145) already extracts `size`, `modified`, `permissions`, `uid`, `gid` from `entry.attrs`. No additional `stat` calls are needed. The data flows through IPC via `ssh:list-directory` and arrives in the renderer as a complete `DirectoryListing`.

The existing `FileItem.tsx` in Miller columns simply ignores most metadata (only uses `name`, `isDirectory`, `isSymlink`) -- but the data is there in `ColumnState.entries`.

---

## Recommended Architecture

### View Mode Toggle Architecture

```
App.tsx
+-- viewMode state: 'columns' | 'list'
+-- ViewModeToggle (in browser-toolbar)
+-- browser-main
    +-- [if columns] ColumnView (existing, unchanged)
    +-- [if list] ListView (new, reuses data patterns)
    +-- PreviewPanel (shared, works with both views)
```

#### Why Sibling Components, Not Modes Within ColumnView

| Approach | Pros | Cons |
|----------|------|------|
| **Mode within ColumnView** | Reuses reducer | ColumnView reducer is multi-column-centric; list view is single-directory. Reducer actions (NAVIGATE_INTO, NAVIGATE_BACK, FOCUS_COLUMN) make no sense for list view. |
| **Sibling component (recommended)** | Clean separation, simpler code | Needs some shared logic (data fetching, selection callbacks) |

The ColumnView reducer manages an array of columns with independent state. A list view shows one directory at a time with sorting. These are architecturally different -- forcing them into one reducer creates awkward abstractions. Keep them as sibling components that share the same IPC calls and selection callbacks.

### Component Boundaries

| Component | Responsibility | New/Modified | Communicates With |
|-----------|---------------|--------------|-------------------|
| `App.tsx` | View mode state, toggles between ColumnView and ListView | **Modified** | ListView, ColumnView, PreviewPanel |
| `ViewModeToggle` | UI control to switch view modes | **New** | App.tsx (via callback) |
| `ListView` | Single-directory list with sort, metadata columns | **New** (based on existing DirectoryList) | App.tsx, ListRow, IPC |
| `ListRow` | Row with icon, name, size, date, permissions, owner | **New** (based on existing FileRow) | ListView |
| `ListHeader` | Sortable column headers | **New** (extracted from DirectoryList pattern) | ListView |
| `ColumnView` | Miller columns (existing, unchanged) | **Unchanged** | App.tsx |
| `PreviewPanel` | File preview sidebar | **Unchanged** | App.tsx (receives selectedFile) |
| `ui-preferences-store` | Persists view mode preference | **Modified** | IPC |
| `preload.ts` | View mode get/set | **Modified** | IPC |

### Data Flow: List View

```
User clicks ViewModeToggle -> 'list'
         |
         v
App.tsx sets viewMode = 'list', persists via IPC
         |
         v
App.tsx renders ListView instead of ColumnView
         |
         v
ListView calls window.electronAPI.listDirectory(serverId, currentPath)
(Same IPC call as ColumnView -- no backend changes)
         |
         v
Receives DirectoryListing { path, entries: FileEntry[] }
(entries already have size, modified, permissions, uid, gid)
         |
         v
ListView applies local sort + hidden filter
         |
         v
Renders virtualized rows via @tanstack/react-virtual
         |
         v
User clicks row -> onFileSelect(file) -> App.tsx -> PreviewPanel
(Same callback pattern as ColumnView)
         |
         v
User double-clicks directory -> navigate into -> re-fetch
User clicks ".." or PathBar -> navigate up/to -> re-fetch
```

### Data Flow: Sorting

Sorting is **renderer-only**. No IPC changes needed.

```
User clicks column header (e.g., "Size")
         |
         v
ListView updates sortColumn + sortDirection state
         |
         v
useMemo recomputes sorted entries from raw entries
         |
         v
Re-render with new sort order
         |
         v
Persist sort preference via ui-preferences IPC (optional, low priority)
```

The existing `DirectoryList.tsx` already has this exact sort pattern with `sortColumn`, `sortDirection`, and a `useMemo` that sorts while keeping directories first. This pattern should be reused directly.

---

## Component Design Details

### ListView Component

Based on modernizing the existing `DirectoryList.tsx` to work with the current architecture:

```typescript
// src/renderer/components/ListView/ListView.tsx

interface ListViewProps {
  serverId: string;
  initialPath?: string;           // Starting directory
  navigateTo?: string | null;     // External navigation (PathBar)
  showHidden?: boolean;           // From App.tsx state
  onFileSelect?: (file: FileEntry) => void;
  onPathChange?: (path: string) => void;
  onNavigationComplete?: () => void;
  onRefreshColumn?: (refreshFn: () => void) => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
  onFilesLoaded?: (files: FileEntry[]) => void;
}
```

**Key design constraint:** ListView must accept the same props as ColumnView so App.tsx can swap them transparently. The `onRefreshColumn`, `onFileSelect`, `onPathChange`, `onNavigationComplete`, `onFavoritesChanged`, `onMoveToClick`, and `onFilesLoaded` callbacks must work identically.

### ListView Internal State

```typescript
// State (simpler than ColumnView -- single directory, no column array)
const [entries, setEntries] = useState<FileEntry[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [currentPath, setCurrentPath] = useState(initialPath);
const [sortColumn, setSortColumn] = useState<SortColumn>('name');
const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
const [selectedIndex, setSelectedIndex] = useState(-1);
const [focusedIndex, setFocusedIndex] = useState(0);
```

### ListRow Component

Based on modernizing existing `FileRow.tsx` with:
- Context menu (matching FileItem.tsx -- download, rename, delete, move, favorites)
- Selection state (focused, selected, multi-select)
- Keyboard navigation support
- Virtualized rendering via @tanstack/react-virtual

```typescript
// src/renderer/components/ListView/ListRow.tsx

interface ListRowProps {
  file: FileEntry;
  isSelected: boolean;
  isFocused: boolean;
  isHidden?: boolean;
  serverId: string;
  showHiddenFiles: boolean;
  onRefresh: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
}
```

### ListHeader Component

Sortable column headers with indicators:

```typescript
// src/renderer/components/ListView/ListHeader.tsx

type SortColumn = 'name' | 'size' | 'modified' | 'permissions';
type SortDirection = 'asc' | 'desc';

interface ListHeaderProps {
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}
```

### ViewModeToggle Component

Minimal toggle in the browser toolbar:

```typescript
// src/renderer/components/ViewModeToggle.tsx

type ViewMode = 'columns' | 'list';

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}
```

---

## Integration Points: What Changes Where

### Modified Files

| File | Change | Why |
|------|--------|-----|
| `App.tsx` | Add `viewMode` state, render ListView or ColumnView based on mode, add ViewModeToggle to toolbar | Orchestrator needs to switch views |
| `ui-preferences-store.ts` | Add `viewMode` field to schema with default `'columns'` | Persist view mode preference |
| `ui-preferences-handlers.ts` | Add `getViewMode` / `setViewMode` IPC handlers | Expose persistence to renderer |
| `preload.ts` | Add `getViewMode` / `setViewMode` to API, add `ViewMode` type | Bridge for persistence |
| `index.css` | Add list view grid styles (already partially there: `.file-row`, `.directory-header`) | List view layout |

### New Files

| File | Purpose | Based On |
|------|---------|----------|
| `src/renderer/components/ListView/ListView.tsx` | List view container with fetch, sort, virtualization | `DirectoryList.tsx` (modernized) |
| `src/renderer/components/ListView/ListRow.tsx` | Metadata row with context menu | `FileRow.tsx` + `FileItem.tsx` context menu |
| `src/renderer/components/ListView/ListHeader.tsx` | Sortable column headers | `DirectoryList.tsx` header section |
| `src/renderer/components/ListView/ListView.css` | List view styles | Existing `.file-row` / `.directory-header` CSS |
| `src/renderer/components/ListView/index.ts` | Barrel export | Pattern from ColumnView |
| `src/renderer/components/ViewModeToggle.tsx` | View mode switch control | New |
| `src/renderer/components/ViewModeToggle.css` | Toggle styles | New |

### Unchanged Files

| File | Why Unchanged |
|------|---------------|
| `sftp-service.ts` | Already returns full metadata in `readdir` |
| `ssh-handlers.ts` | `ssh:list-directory` handler already returns complete `DirectoryListing` |
| `Column.tsx` | Miller column view remains as-is |
| `ColumnView.tsx` | Column view remains as-is |
| `FileItem.tsx` | Miller column item remains as-is |
| `PreviewPanel.tsx` | Receives `selectedFile` from App.tsx -- view-agnostic |
| `shared/types.ts` | `FileEntry` already has all needed fields |
| `main/ssh/types.ts` | Already complete |

### Files to Remove (Clean Up)

| File | Reason |
|------|--------|
| `DirectoryList.tsx` | Replaced by `ListView.tsx` (modernized version) |
| `FileRow.tsx` | Replaced by `ListRow.tsx` (modernized version with context menu) |

---

## Keyboard Navigation in List View

List view reuses the `useColumnNavigation` hook pattern but with list-specific behavior:

| Key | Miller Columns (existing) | List View (new) |
|-----|--------------------------|-----------------|
| Arrow Up/Down | Move focus within column | Move focus within list |
| Arrow Right | Navigate into folder (new column) | Navigate into folder (replace list) |
| Arrow Left | Focus parent column | Navigate to parent directory |
| Enter | Navigate into folder | Navigate into folder |
| Space | Lightbox toggle | Lightbox toggle |
| Type-ahead | Jump to matching filename | Jump to matching filename |
| Cmd+Click | Multi-select in column | Multi-select in list |
| Shift+Click | Range select in column | Range select in list |

The existing `useColumnNavigation` hook can be reused for list view with minor parameter changes (no `onNavigateLeft` to parent column, instead navigate to parent path).

---

## Sorting Architecture

### Sort Fields

| Column | Field | Type | Sort Logic |
|--------|-------|------|------------|
| Name | `file.name` | string | `localeCompare` |
| Size | `file.size` | number | Numeric comparison |
| Modified | `file.modified` | Date | `getTime()` comparison |
| Permissions | `file.permissions` | string | String comparison (octal) |

### Sort Invariant: Directories Always First

Both views always sort directories before files. This is the Finder convention and is already implemented in both `ColumnView.fetchDirectory` and `DirectoryList.sortedEntries`. Within each group (dirs, files), the selected sort applies.

```typescript
const sortedEntries = useMemo(() => {
  const filtered = showHidden
    ? entries
    : entries.filter(e => !e.name.startsWith('.'));

  return [...filtered].sort((a, b) => {
    // Directories always first
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    // Then by selected column
    let cmp = 0;
    switch (sortColumn) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'size': cmp = a.size - b.size; break;
      case 'modified': cmp = a.modified.getTime() - b.modified.getTime(); break;
      case 'permissions': cmp = a.permissions.localeCompare(b.permissions); break;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });
}, [entries, sortColumn, sortDirection, showHidden]);
```

### Virtualization for Large Directories

List view uses `@tanstack/react-virtual` (already a dependency at v3.13.18) just like Miller columns do in `Column.tsx`. The row height is taller than Miller columns to accommodate metadata:

- Miller column row: 28px (compact, icon + name only)
- List view row: 32px (icon + name + size + date + permissions + owner)

```typescript
const virtualizer = useVirtualizer({
  count: sortedEntries.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 32,
  overscan: 15,
});
```

---

## Metadata Display Formatting

These utility functions already exist in `FileRow.tsx` and should be extracted to a shared module:

### File Size

```typescript
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
```

### Modification Date

```typescript
function formatDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}
```

### Permissions

```typescript
function formatPermissions(mode: string): string {
  const modeNum = parseInt(mode, 8);
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  return perms[(modeNum >> 6) & 7] + perms[(modeNum >> 3) & 7] + perms[modeNum & 7];
}
```

These should go in a shared `src/renderer/utils/formatters.ts` file, since `PreviewPanel.tsx` also has a `formatSize` function.

---

## Patterns to Follow

### Pattern 1: View-Agnostic App.tsx Orchestration

App.tsx should not care which view is active. Both views provide the same callback interface:

```typescript
// App.tsx render
<div className="browser-columns">
  {viewMode === 'columns' ? (
    <ColumnView
      key={selectedServer}
      serverId={selectedServer}
      initialPath="/"
      navigateTo={navigateToPath}
      showHidden={showHidden ?? false}
      onFileSelect={handleFileSelect}
      onPathChange={handlePathChange}
      onNavigationComplete={handleNavigationComplete}
      onFavoritesChanged={handleFavoritesChanged}
      onMoveToClick={handleMoveToClick}
      onRefreshColumn={handleRefreshColumnCallback}
      onFilesLoaded={handleFilesLoaded}
    />
  ) : (
    <ListView
      key={selectedServer}
      serverId={selectedServer}
      initialPath="/"
      navigateTo={navigateToPath}
      showHidden={showHidden ?? false}
      onFileSelect={handleFileSelect}
      onPathChange={handlePathChange}
      onNavigationComplete={handleNavigationComplete}
      onFavoritesChanged={handleFavoritesChanged}
      onMoveToClick={handleMoveToClick}
      onRefreshColumn={handleRefreshColumnCallback}
      onFilesLoaded={handleFilesLoaded}
    />
  )}
</div>
```

### Pattern 2: Context Menu Reuse

`ListRow` needs the same context menu as `FileItem` (download, rename, delete, move, favorites, upload folder, download folder). Rather than duplicating the 600+ lines of `FileItem.tsx` context menu handlers, extract context menu logic into a shared hook:

```typescript
// src/renderer/hooks/useFileContextMenu.ts

function useFileContextMenu(params: {
  file: FileEntry;
  serverId: string;
  showHiddenFiles: boolean;
  onRefresh: () => void;
  onRefreshChild?: () => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
}) {
  // Returns: contextMenu state, handlers, portal element
  return { contextMenu, handleContextMenu, contextMenuPortal };
}
```

This hook extracts the download, upload, delete, rename, move, favorites, folder upload, and folder download handlers from `FileItem.tsx`. Both `FileItem` and `ListRow` consume this hook.

### Pattern 3: Shared Formatting Utilities

Extract formatting functions used across components:

```typescript
// src/renderer/utils/formatters.ts
export function formatSize(bytes: number): string { ... }
export function formatDate(date: Date): string { ... }
export function formatPermissions(mode: string): string { ... }
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Metadata in Preview Panel Only

**What:** Showing file metadata (size, date, permissions) only in the preview panel sidebar.
**Why bad:** Users need to compare metadata across files at a glance. Preview panel shows one file at a time. List view with inline metadata is the standard pattern for this (Finder, VS Code, WinSCP).
**Instead:** Show metadata inline in list view rows. Preview panel can show additional detail for the selected file.

### Anti-Pattern 2: Separate SFTP Stat Calls for Metadata

**What:** Making individual `sftp.stat()` calls for each file to get metadata.
**Why bad:** `readdir` already returns `attrs` with size, mtime, mode, uid, gid. Stat calls add N extra round trips per directory.
**Instead:** Use the data already returned by `readdir` (which the codebase already does).

### Anti-Pattern 3: Shared State Between Views

**What:** Having ColumnView and ListView share a single state store so switching views preserves scroll position, selection, etc.
**Why bad:** Premature optimization. Adds complexity for a feature that rarely switches. State shapes differ (array of columns vs. single list).
**Instead:** Each view manages its own state. When switching, the new view loads the current path fresh. Preserve `currentPath` at the App level so the user returns to the same directory.

### Anti-Pattern 4: Real-Time Metadata Refresh

**What:** Polling or watching for file metadata changes.
**Why bad:** Over SSH/SFTP, there is no filesystem watch mechanism. Polling would be expensive (N stat calls per interval). Remote files rarely change while browsing.
**Instead:** Metadata is fetched once per directory listing. User can manually refresh (existing refresh patterns).

---

## Suggested Build Order

### Phase 1: Shared Utilities Extraction (Foundation)

**Goal:** Extract reusable code from existing components before building new ones.

| Step | Deliverable | Files |
|------|-------------|-------|
| 1.1 | Create `formatters.ts` with formatSize, formatDate, formatPermissions | New: `src/renderer/utils/formatters.ts` |
| 1.2 | Extract context menu hook from FileItem.tsx | New: `src/renderer/hooks/useFileContextMenu.ts` |
| 1.3 | Refactor FileItem.tsx to use extracted hook | Modified: `FileItem.tsx` |

**Rationale:** This foundation step prevents code duplication between FileItem (Miller columns) and ListRow (list view). It also de-bloats FileItem.tsx which is currently 763 lines. Must happen first because Phase 2 and 3 depend on these shared pieces.

### Phase 2: ListView Core (Data + Rendering)

**Goal:** Build the list view with sorting, metadata columns, and virtualization.

| Step | Deliverable | Files |
|------|-------------|-------|
| 2.1 | ListHeader with sortable columns and indicators | New: `ListView/ListHeader.tsx` |
| 2.2 | ListRow with metadata display, context menu (via hook), selection states | New: `ListView/ListRow.tsx`, `ListView/ListView.css` |
| 2.3 | ListView container: fetch, sort, virtualization, keyboard nav | New: `ListView/ListView.tsx`, `ListView/index.ts` |

**Rationale:** Build bottom-up (header, row, container). The container orchestrates fetching and sorting. Virtualization is mandatory since the same large directories that need it in Miller columns need it here. Existing `DirectoryList.tsx` and `FileRow.tsx` serve as reference but are rewritten to match current architecture patterns.

### Phase 3: View Mode Integration (App Orchestration)

**Goal:** Wire ListView into the app with mode switching and persistence.

| Step | Deliverable | Files |
|------|-------------|-------|
| 3.1 | ViewModeToggle component | New: `ViewModeToggle.tsx`, `ViewModeToggle.css` |
| 3.2 | View mode persistence (ui-preferences-store + handlers + preload) | Modified: `ui-preferences-store.ts`, `ui-preferences-handlers.ts`, `preload.ts` |
| 3.3 | App.tsx integration: viewMode state, conditional rendering, toolbar toggle | Modified: `App.tsx` |
| 3.4 | Path synchronization: switching views preserves current directory | Modified: `App.tsx` |
| 3.5 | Clean up: remove unused `DirectoryList.tsx` and `FileRow.tsx` | Removed: 2 files |

**Rationale:** Integration must happen after ListView is working standalone. Path synchronization is important UX -- switching from column view at `/home/user/docs` should show the same directory in list view. The old unused components can be safely removed once the new ones are verified.

### Phase 4: Polish (Keyboard, a11y, Edge Cases)

**Goal:** Match the quality level of existing Miller column implementation.

| Step | Deliverable | Files |
|------|-------------|-------|
| 4.1 | List view keyboard navigation (arrows, enter, type-ahead, escape) | Modified: `ListView.tsx` |
| 4.2 | Keyboard shortcut to toggle view mode (e.g., Cmd+2 for list, Cmd+1 for columns) | Modified: `App.tsx` |
| 4.3 | Lightbox integration in list view (spacebar, arrow keys when open) | Modified: `ListView.tsx`, `App.tsx` |
| 4.4 | Accessibility: ARIA roles, labels, live regions for sort changes | Modified: `ListView.tsx`, `ListHeader.tsx`, `ListRow.tsx` |

**Rationale:** Polish after core functionality works. Keyboard nav and lightbox integration are important because they are well-established patterns in the column view that users will expect to work in list view too.

### Dependency Graph

```
Phase 1: Shared Utilities (no deps)
+-- formatters.ts (no deps)
+-- useFileContextMenu.ts (depends on: FileItem.tsx pattern understanding)
+-- FileItem.tsx refactor (depends on: useFileContextMenu.ts)

Phase 2: ListView Core (depends on: Phase 1)
+-- ListHeader.tsx (no deps beyond types)
+-- ListRow.tsx (depends on: formatters.ts, useFileContextMenu.ts)
+-- ListView.tsx (depends on: ListHeader, ListRow, @tanstack/react-virtual)

Phase 3: View Mode Integration (depends on: Phase 2)
+-- ViewModeToggle.tsx (no deps)
+-- Persistence (depends on: existing ui-preferences pattern)
+-- App.tsx integration (depends on: ListView.tsx, ViewModeToggle.tsx, persistence)
+-- Cleanup (depends on: App.tsx integration verified working)

Phase 4: Polish (depends on: Phase 3)
+-- Keyboard nav (depends on: ListView mounted in App)
+-- Lightbox (depends on: keyboard nav + App.tsx lightbox wiring)
+-- Accessibility (depends on: all components finalized)
```

**Critical path:** Phase 1 -> Phase 2 -> Phase 3 (sequential, each depends on prior)

**Parallel opportunities within phases:**
- Phase 1: formatters.ts and useFileContextMenu.ts can be built in parallel
- Phase 2: ListHeader and ListRow can be built in parallel before ListView
- Phase 4: Keyboard, lightbox, and a11y are somewhat parallel

---

## Metadata in Preview Panel (Bonus)

The PreviewPanel currently shows the filename in a header but no file metadata. As a low-effort enhancement, the preview panel header could show metadata for any selected file:

```
+--------------------------------+
| document.pdf                   |  <- existing filename
| 2.4 MB | Jan 15, 2026 3:42 PM |  <- new metadata line
| rwxr-xr-x | 1000:1000         |  <- new metadata line
+--------------------------------+
| [preview content]              |
+--------------------------------+
```

This works in both view modes and complements the list view metadata. It is a simple modification to `PreviewPanel.tsx` -- adding `selectedFile.size`, `selectedFile.modified`, `selectedFile.permissions` display using the shared formatters. However, this is optional polish and should not block the core list view work.

---

## Scalability Considerations

| Concern | At 100 files | At 1K files | At 10K files |
|---------|-------------|-------------|--------------|
| Sort performance | Instant | Instant (useMemo) | ~10-50ms (acceptable, useMemo caches) |
| Virtualization | Not needed but works | Benefits start | Essential (same as Miller columns) |
| Memory | Negligible | ~2-3MB for FileEntry array | ~20-30MB (same as current readdir result) |
| IPC transfer | Instant | ~50ms | ~200-500ms (same as current) |

The sort runs in the renderer. `Array.sort` on 10K items with `localeCompare` is ~10-50ms -- imperceptible and cached by `useMemo`.

---

## No Backend Changes Required

This is worth emphasizing: **zero changes to the main process, SFTP service, or IPC protocol are needed** for the core list view and metadata features. The entire implementation is renderer-side component work plus minor IPC additions for view mode persistence.

| Layer | Changes |
|-------|---------|
| Main process SSH/SFTP | None |
| Main process IPC handlers | +2 handlers (getViewMode, setViewMode) |
| Main process storage | +1 field in ui-preferences schema |
| Preload bridge | +2 methods |
| Shared types | None (FileEntry already complete) |
| Renderer components | New ListView family + modified App.tsx |

---

## References and Sources

### Existing Codebase (Authoritative)

- `src/main/ssh/sftp-service.ts` -- readdir already extracts full attrs (size, mtime, mode, uid, gid)
- `src/main/ssh/types.ts` -- FileEntry type with all metadata fields
- `src/renderer/components/DirectoryList.tsx` -- existing unused list view with sort
- `src/renderer/components/FileRow.tsx` -- existing unused row with metadata display
- `src/renderer/components/ColumnView/Column.tsx` -- virtualization pattern to reuse
- `src/renderer/components/FileItem.tsx` -- context menu pattern to extract
- `src/main/storage/ui-preferences-store.ts` -- preference persistence pattern

### Architecture Patterns (From Training Data, MEDIUM confidence)

- @tanstack/react-virtual v3 virtualizer works with any container, not just vertical lists -- can handle the fixed-header + scrollable-body pattern needed for list view
- ssh2 `readdir` returns `SFTPFileEntry.attrs` which includes `mode`, `uid`, `gid`, `size`, `atime`, `mtime` -- no separate stat call needed (verified in codebase)
- Electron contextBridge pattern for view mode persistence follows exact pattern of existing `showHiddenFiles` preference

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Data availability | HIGH | Verified: sftp-service.ts already extracts all metadata from readdir |
| Component architecture | HIGH | Based on existing codebase patterns (ColumnView, DirectoryList, FileRow) |
| Sorting implementation | HIGH | Existing DirectoryList.tsx has working sort code to reference |
| Virtualization | HIGH | @tanstack/react-virtual already used in Column.tsx |
| Context menu extraction | MEDIUM | FileItem.tsx handlers have complex state (toast refs, operation tracking) -- extraction may surface edge cases |
| View mode persistence | HIGH | Follows exact pattern of showHiddenFiles preference |
| Keyboard navigation reuse | MEDIUM | useColumnNavigation hook is column-specific; list view may need a separate hook or a generalized version |

---

## Open Questions

1. **Should sort preference persist per-server?** Current ui-preferences-store is global. If user sorts by size on server A, should server B also show size sort? Recommendation: keep it global (simpler), revisit if users request per-server.

2. **Should the view mode toggle be a toolbar button or keyboard shortcut only?** Recommendation: both. Button in toolbar for discoverability, Cmd+1/Cmd+2 for power users.

3. **Column widths in list view -- fixed or resizable?** The Miller column view has resizable columns. List view columns could be fixed (simpler) or resizable (matches Finder). Recommendation: start with fixed reasonable widths, add resize in a polish phase if needed.
