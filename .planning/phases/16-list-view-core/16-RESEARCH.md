# Phase 16: List View Core - Research

**Researched:** 2026-02-10
**Domain:** React list view component, CSS Grid table layout, @tanstack/react-virtual, sorting, keyboard navigation
**Confidence:** HIGH

## Summary

Phase 16 builds a complete list view for browsing directories with columns (Name, Size, Date Modified, Kind), sorting by column header click, virtualized scrolling, keyboard navigation, and context menu / preview panel integration. All infrastructure exists: `@tanstack/react-virtual` v3.13.18 is already installed and proven in Column.tsx, shared formatters (`formatSize`, `formatDate`) and `getFileKind` were consolidated in Phase 15, and the `useFileContextMenu` hook was extracted for cross-view reuse.

The existing orphaned components (`DirectoryList.tsx`, `FileRow.tsx`) provide a solid reference for sorting logic and column layout but have significant gaps: no virtualization, no keyboard navigation, no context menu integration, no Kind column, and columns that include Permissions/Owner instead of Kind. They will serve as patterns to draw from but not as code to use directly.

The key architectural decision is how the ListView relates to the existing ColumnView. Looking at Phase 17 (View Mode Integration), the ListView needs to be a drop-in replacement that accepts the same data flow: `serverId`, `currentPath`, `showHidden`, `onFileSelect`, `onPathChange`, etc. It must fetch its own directory contents (like ColumnView does), manage sort state internally, and expose the same callbacks to App.tsx. The list view operates on a **single directory** (the current path), unlike the multi-column Miller view.

**Primary recommendation:** Build a self-contained `ListView` component that fetches directory contents for the current path, sorts them with folders-first guarantee, virtualizes the rows with `@tanstack/react-virtual`, handles keyboard navigation with a `useListNavigation` hook, and renders context menus via the existing `useFileContextMenu` hook. CSS Grid with `grid-template-columns` provides the aligned header-to-row column layout.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.4 | Component rendering, hooks, state management | Already in project |
| TypeScript | ^5.5.0 | Type-safe interfaces and components | Already in project |
| @tanstack/react-virtual | ^3.13.18 | Virtualized scrolling for 1000+ file rows | Already in project, proven in Column.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 | Toast notifications from context menu operations | Already in project, used by useFileContextMenu |
| react-dom | ^19.2.4 | createPortal for context menu rendering | Already in project |

### Shared Utilities (from Phase 15)
| Module | Function | Purpose |
|--------|----------|---------|
| `utils/formatters.ts` | `formatSize(bytes)` | Display "4.2 KB", "1.3 MB" in Size column |
| `utils/formatters.ts` | `formatDate(date)` | Display "Jan 15, 2026, 3:42 PM" in Date Modified column |
| `utils/fileKinds.ts` | `getFileKind(name, isDir)` | Display "PNG Image", "TypeScript", "Folder" in Kind column |
| `hooks/useFileContextMenu.ts` | `useFileContextMenu({...})` | Full context menu with all file operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid for columns | HTML `<table>` element | Grid is more flexible for variable widths and matches existing codebase patterns (BEM + CSS Grid already in .directory-header) |
| @tanstack/react-virtual | @tanstack/react-table | react-table is overkill; we only need virtualization, not a full table data model. The project already has react-virtual. |
| Custom sort logic | lodash orderBy | Unnecessary dependency; the sort comparator is 15 lines of code |

**Installation:**
No new dependencies needed. All work uses existing project dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/
  components/
    ListView/
      ListView.tsx          # Container: fetches data, manages sort state, wires keyboard
      ListView.css          # Full layout styles
      ListHeader.tsx        # Column headers with sort indicators
      ListRow.tsx           # Single virtualized row with formatted metadata
      index.ts              # Re-export
  hooks/
    useListNavigation.ts    # Keyboard navigation hook (adapted from useColumnNavigation)
  types/
    listView.ts             # SortColumn, SortDirection, SortState types
```

### Pattern 1: CSS Grid Column Alignment
**What:** Both the header and each row use the same `grid-template-columns` value, ensuring columns align perfectly.
**When to use:** Any tabular layout where header cells must align with body cells.
**Example:**
```css
/* Shared grid template for header and rows */
.list-header,
.list-row {
  display: grid;
  grid-template-columns: 28px 1fr 80px 160px 140px;
  /* icon | name(flexible) | size | date modified | kind */
  align-items: center;
  padding: 0 12px;
}
```

The column widths:
- **Icon**: 28px fixed (matches file-item icon + padding)
- **Name**: `1fr` (takes remaining space, truncates with ellipsis)
- **Size**: 80px fixed (enough for "999.9 GB", right-aligned)
- **Date Modified**: 160px fixed (enough for "Jan 15, 2026, 3:42 PM")
- **Kind**: 140px fixed (enough for "TypeScript (TSX)")

### Pattern 2: Sorting with Folders-First Guarantee
**What:** Sort comparator always groups directories above files, then applies the user-chosen column and direction within each group.
**When to use:** SORT-03 requirement: "Folders always sort before files regardless of sort field."
**Example:**
```typescript
type SortColumn = 'name' | 'size' | 'modified' | 'kind';
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

function sortEntries(entries: FileEntry[], sort: SortState): FileEntry[] {
  return [...entries].sort((a, b) => {
    // SORT-03: Folders always first
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    let comparison = 0;
    switch (sort.column) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'modified': {
        const aTime = a.modified instanceof Date ? a.modified.getTime() : new Date(a.modified).getTime();
        const bTime = b.modified instanceof Date ? b.modified.getTime() : new Date(b.modified).getTime();
        comparison = aTime - bTime;
        break;
      }
      case 'kind': {
        const aKind = getFileKind(a.name, a.isDirectory);
        const bKind = getFileKind(b.name, b.isDirectory);
        comparison = aKind.localeCompare(bKind);
        break;
      }
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });
}
```

### Pattern 3: Virtualizer for List Rows
**What:** Use `useVirtualizer` with a fixed row height (32px for list rows, slightly taller than the 28px column items to accommodate metadata text).
**When to use:** LIST-02 requires support for 1000+ files.
**Example:**
```typescript
// In ListView.tsx
const virtualizer = useVirtualizer({
  count: sortedEntries.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 32, // Fixed row height for list view
  overscan: 15, // More overscan than columns since rows are wider/more visible
});
```

### Pattern 4: ListView Props Interface (Phase 17 Compatible)
**What:** The ListView must accept the same callback shape as ColumnView so App.tsx can swap between them.
**When to use:** This is the key integration surface.
**Example:**
```typescript
interface ListViewProps {
  serverId: string;
  initialPath?: string;
  navigateTo?: string | null;
  showHidden?: boolean;
  onFileSelect?: (file: FileEntry) => void;
  onPathChange?: (path: string) => void;
  onNavigationComplete?: () => void;
  onRefreshColumn?: (refreshFn: () => void) => void;
  onFavoritesChanged?: () => void;
  onMoveToClick?: (file: FileEntry) => void;
  onFilesLoaded?: (files: FileEntry[]) => void;
}
```

Note: `onFileSelect` drops the `columnIndex` parameter since list view has no columns. Phase 17 will handle this interface alignment.

### Pattern 5: Directory Navigation in List View
**What:** Unlike Miller columns (which show multiple directories simultaneously), the list view shows one directory at a time. Double-clicking a folder replaces the current view with that folder's contents. "Going back" means navigating to the parent directory.
**When to use:** All directory navigation in list view.
**Example:**
```typescript
const handleDirectoryOpen = useCallback((path: string) => {
  setCurrentPath(path);
  setSelectedIndex(-1);
  onPathChange?.(path);
}, [onPathChange]);

const handleNavigateUp = useCallback(() => {
  if (currentPath === '/') return;
  const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
  handleDirectoryOpen(parentPath);
}, [currentPath, handleDirectoryOpen]);
```

### Anti-Patterns to Avoid
- **Sharing the ColumnView reducer:** The column view's state model (multiple columns, active column index, column-specific selection) is fundamentally different from list view (single directory, single selection, sort state). Do not try to reuse `columnReducer` or `ColumnState`.
- **Re-fetching on every sort change:** Sort should be done client-side on the already-fetched entries. Only re-fetch when `currentPath` or `showHidden` changes. The existing `DirectoryList.tsx` does this correctly with `useMemo`.
- **Inline sort in render:** Always `useMemo` the sorted entries to avoid re-sorting on every render cycle.
- **Forgetting to convert IPC dates:** `modified` arrives as a string from IPC. The fetch function must convert with `new Date(entry.modified)`, just like ColumnView does on line 352-355.
- **Hard-coding row height without CSS variable:** If the row height in the virtualizer (estimateSize) doesn't match the CSS height, items will overlap or have gaps. Use a constant shared between JS and CSS, or at minimum a well-documented constant.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtualized scrolling | Custom windowing with scroll math | `@tanstack/react-virtual` `useVirtualizer` | Already proven in Column.tsx; handles edge cases (scroll-to-index, overscan, variable sizing) |
| File metadata formatting | Per-component formatters | `utils/formatters.ts` (formatSize, formatDate) | Phase 15 consolidated 4 copies into 1 |
| File kind labels | Extension matching in component | `utils/fileKinds.ts` (getFileKind) | Phase 15 created comprehensive map with 100+ extensions |
| Context menu + file ops | Duplicated operation handlers | `hooks/useFileContextMenu` | Phase 15 extracted 700 lines of tested logic |
| Column header sort toggle | Complex state machine | Simple `if same column, flip direction; else set column, reset to asc` | The 10-line pattern in DirectoryList.tsx is battle-tested |

**Key insight:** Phase 15 was specifically designed to prevent duplication in Phase 16. Every formatting, kind-labeling, and context menu need is already solved. The list view is primarily a layout and interaction challenge, not a data/logic challenge.

## Common Pitfalls

### Pitfall 1: Grid Column Misalignment Between Header and Rows
**What goes wrong:** Header columns don't line up with row columns, creating a misaligned table.
**Why it happens:** The header has different padding, a scrollbar gutter, or a different `grid-template-columns` value than the rows.
**How to avoid:** (1) Use the exact same `grid-template-columns` string for both `.list-header` and `.list-row`. (2) Account for the vertical scrollbar: the scroll container adds ~17px for the scrollbar, which shifts row content left relative to the header. Fix by adding `overflow-y: scroll` (always show scrollbar) or adding padding-right to the header equal to scrollbar width.
**Warning signs:** Columns look aligned until the list gets long enough for a scrollbar to appear, then they shift.

### Pitfall 2: Sort State Resetting on Directory Change
**What goes wrong:** User sorts by Size descending, navigates to a subdirectory, and sort resets to Name ascending.
**Why it happens:** Sort state is initialized in a `useState` that resets when the component remounts, or the sort state is coupled to the directory path.
**How to avoid:** SORT-04 requires sort preference to persist within a session. Keep `sortState` in the ListView component's state, independent of `currentPath`. When `currentPath` changes, re-fetch entries but keep the same sort. The sort state lives as long as the ListView component lives.
**Warning signs:** Sort indicator disappearing after navigation.

### Pitfall 3: Keyboard Navigation Conflicting with useFileContextMenu
**What goes wrong:** Arrow keys navigate the list AND trigger other behaviors, or keyboard shortcuts from the context menu hook interfere with list navigation.
**Why it happens:** `useFileContextMenu` has an Escape key handler (for canceling operations). If both the list navigation and context menu hooks listen for the same keys, events may be handled twice.
**How to avoid:** The list navigation `handleKeyDown` should be attached to the scroll container's `onKeyDown`. The context menu's Escape handler is on `window` (global). These don't conflict because the list handler uses `e.preventDefault()` and `e.stopPropagation()` for navigation keys. Just ensure Enter key in list view opens folders (not triggers context menu confirm).
**Warning signs:** Pressing Escape closes context menu AND deselects the current item simultaneously.

### Pitfall 4: Double-Click on Folder Not Working with Virtualization
**What goes wrong:** Double-clicking a folder row doesn't navigate into it.
**Why it happens:** With virtualized rows, the `onDoubleClick` handler may fire on a stale entry reference if the virtualizer reuses DOM elements. Or the click handler selects the file, triggering a re-render that changes the row under the cursor before the second click lands.
**How to avoid:** Pass the entry's path directly to the double-click handler (not an index that could become stale). Use `useCallback` with the entry as a dependency. The existing Column.tsx pattern works: `onDoubleClick={() => handleItemDoubleClick(virtualRow.index)}` where the handler reads from `entries[index]`.
**Warning signs:** Double-click works on non-virtualized short lists but fails intermittently on long lists.

### Pitfall 5: Context Menu Not Working Because useFileContextMenu Needs Per-Row Props
**What goes wrong:** The context menu hook is called once with the first file's data and never updates, or it's called conditionally (violating rules of hooks).
**Why it happens:** `useFileContextMenu` takes a `file` prop. In a list view, the selected file changes as the user clicks different rows. The hook must be called with the currently-selected file.
**How to avoid:** Two approaches:
  1. **Per-row component approach (recommended):** Create a `ListRow` component that receives a single `FileEntry` and calls `useFileContextMenu` inside it. This is the same pattern as `FileItem.tsx`. Each row gets its own hook instance.
  2. **Single hook approach:** Call `useFileContextMenu` in `ListView` with the currently-selected file. This works but means only the selected file has context menu support, and the hook re-initializes on every selection change.

  The per-row approach matches how FileItem.tsx works and is proven in the codebase.
**Warning signs:** Context menu opens but shows wrong file's name, or right-click on unselected file does nothing.

### Pitfall 6: Forgetting onFilesLoaded Callback for Lightbox Navigation
**What goes wrong:** Lightbox arrow key navigation through previewable files doesn't work in list view.
**Why it happens:** App.tsx uses `onFilesLoaded` to build the `previewableFiles` array for lightbox navigation. If ListView doesn't call this callback, the lightbox has no file list to navigate through.
**How to avoid:** Call `onFilesLoaded?.(entries)` when directory contents are loaded, just like ColumnView does (ColumnView.tsx lines 441-446).
**Warning signs:** Spacebar opens lightbox, but arrow keys don't navigate to next/previous previewable file.

## Code Examples

Verified patterns from the existing codebase:

### Virtualizer Setup (from Column.tsx, proven pattern)
```typescript
// Source: src/renderer/components/ColumnView/Column.tsx lines 50-55
const virtualizer = useVirtualizer({
  count: entries.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 28, // Fixed row height
  overscan: 10,
});
```

### Sort Toggle Handler (from DirectoryList.tsx, proven pattern)
```typescript
// Source: src/renderer/components/DirectoryList.tsx lines 110-119
const handleSort = (column: SortColumn) => {
  if (sortColumn === column) {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  } else {
    setSortColumn(column);
    setSortDirection('asc');
  }
};
```

### Directory Fetch with Date Conversion (from ColumnView.tsx, proven pattern)
```typescript
// Source: src/renderer/components/ColumnView/ColumnView.tsx lines 350-365
const result = await window.electronAPI.listDirectory(serverId, path);
let entries = result.entries.map((entry) => ({
  ...entry,
  modified: new Date(entry.modified),
}));
if (!showHidden) {
  entries = entries.filter((e) => !e.name.startsWith('.'));
}
```

### Keyboard Navigation (from useColumnNavigation.ts, adaptable pattern)
```typescript
// Source: src/renderer/hooks/useColumnNavigation.ts lines 33-118
// Key differences for list view:
// - No ArrowLeft/ArrowRight for column navigation
// - Enter opens folder (navigates) or selects file
// - ArrowUp/ArrowDown with same select-and-focus pattern
// - Type-ahead search reusable as-is
```

### Context Menu Integration (from FileItem.tsx, proven pattern)
```typescript
// Source: src/renderer/components/FileItem.tsx lines 43-53
const {
  contextMenu, handleContextMenu,
  isRenaming, renameValue, setRenameValue,
  handleRenameStart, handleRenameConfirm, cancelRename,
  handleDownload, handleUpload, handleDelete,
  handleMoveTo, handleAddToFavorites,
  handleUploadFolder, handleDownloadFolder,
} = useFileContextMenu({
  file, serverId, showHiddenFiles,
  onRefresh, onRefreshChild, onFavoritesChanged, onMoveToClick,
});
```

### Virtual Row Rendering (from Column.tsx, proven pattern)
```typescript
// Source: src/renderer/components/ColumnView/Column.tsx lines 170-205
{virtualizer.getVirtualItems().map((virtualRow) => {
  const entry = entries[virtualRow.index];
  return (
    <div
      key={virtualRow.key}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {/* Row content */}
    </div>
  );
})}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DirectoryList.tsx with no virtualization | ListView with @tanstack/react-virtual | Phase 16 | Supports 1000+ files per LIST-02 |
| Inline formatters per component | Shared formatters from Phase 15 | Phase 15 (2026-02-10) | Zero duplication for Size, Date, Kind |
| Monolithic FileItem with context menu | useFileContextMenu hook + thin component | Phase 15 (2026-02-10) | Context menu reusable across views |
| No Kind column | getFileKind with 100+ extension map | Phase 15 (2026-02-10) | LIST-01 Kind column ready |
| 6-column layout (icon, name, size, modified, permissions, owner) | 5-column layout (icon, name, size, modified, kind) | Phase 16 | Matches requirements LIST-01 |

**Orphaned components to retire after Phase 16:**
- `DirectoryList.tsx` - replaced by `ListView/ListView.tsx`
- `FileRow.tsx` - replaced by `ListView/ListRow.tsx`

These orphaned components were written early in the project before virtualization, shared utilities, or context menu extraction existed. They should be deleted once the new ListView is working.

## Open Questions

1. **Should the list view's row height be 28px (same as FileItem) or taller?**
   - What we know: FileItem is 28px and displays only icon + name. List rows display icon + name + size + date + kind, which is more information but all on one line.
   - What's unclear: Whether 28px provides enough vertical space for readability of 5 columns at 13px font.
   - Recommendation: Use 32px. The extra 4px provides breathing room for the metadata columns without wasting vertical space. macOS Finder list view uses approximately 24px rows, but we have more columns and a dark theme that benefits from slightly more spacing.

2. **Should sort state persist to IPC (across app restarts) or only in-session?**
   - What we know: SORT-04 says "Sort preference persists across directory navigation within a session." This implies session-only, not cross-restart.
   - What's unclear: Whether "within a session" is an intentional scoping or just the minimum requirement.
   - Recommendation: Session-only (React state in ListView). Phase 17 could add IPC persistence if users request it, but the requirement only asks for session persistence. Keep it simple.

3. **Should the list view show the current path / breadcrumbs, or rely on App.tsx's PathBar?**
   - What we know: The existing PathBar in App.tsx shows the current path and handles navigation. ColumnView doesn't render its own path display.
   - Recommendation: Do NOT add path display to ListView. App.tsx's PathBar handles this. ListView reports path changes via `onPathChange` callback, exactly like ColumnView. Phase 17 will ensure PathBar works with both views.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/renderer/components/ColumnView/Column.tsx` - Proven @tanstack/react-virtual usage pattern with 28px rows, overscan: 10, keyboard navigation
- Codebase analysis: `src/renderer/components/ColumnView/ColumnView.tsx` - Props interface, directory fetch pattern, date conversion, external navigation
- Codebase analysis: `src/renderer/components/DirectoryList.tsx` - Orphaned reference: sort logic, sort toggle, folders-first comparator
- Codebase analysis: `src/renderer/components/FileRow.tsx` - Orphaned reference: CSS Grid row layout, column structure, formatter usage
- Codebase analysis: `src/renderer/components/FileItem.tsx` - Context menu integration pattern, useFileContextMenu usage
- Codebase analysis: `src/renderer/hooks/useColumnNavigation.ts` - Keyboard navigation pattern with type-ahead search
- Codebase analysis: `src/renderer/hooks/useFileContextMenu.ts` - Full hook interface for context menu reuse
- Codebase analysis: `src/renderer/utils/formatters.ts` - formatSize, formatDate, formatPermissions (Phase 15 output)
- Codebase analysis: `src/renderer/utils/fileKinds.ts` - getFileKind with 100+ extensions (Phase 15 output)
- Codebase analysis: `src/renderer/App.tsx` - Integration surface: ColumnView props, PreviewPanel wiring, onFilesLoaded
- Codebase analysis: `src/renderer/index.css` - Existing .directory-header/.file-row CSS Grid pattern (grid-template-columns: 40px 1fr 80px 150px 100px 80px)
- Codebase analysis: `src/shared/types.ts` - FileEntry interface (name, path, size, modified, isDirectory, isSymlink, permissions, uid, gid)
- Codebase analysis: `src/renderer/types/columnView.ts` - ColumnState interface (pattern reference, not to reuse)
- Codebase analysis: `.planning/phases/15-shared-utilities-metadata/15-RESEARCH.md` - Phase 15 research confirming shared utility readiness
- Codebase analysis: `.planning/ROADMAP.md` - Phase 16/17 relationship, v1.3 milestone structure

### Secondary (MEDIUM confidence)
- [@tanstack/react-virtual v3 docs](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual) - useVirtualizer API confirmation
- [MDN CSS Grid grid-template-columns](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/grid-template-columns) - CSS Grid column template syntax

### Tertiary (LOW confidence)
- macOS Finder list view - Used as UX reference for column ordering and sort behavior. Exact implementation details are approximations based on general knowledge.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, everything is already in the project and proven
- Architecture: HIGH - All patterns directly derived from existing codebase (Column.tsx, DirectoryList.tsx, useColumnNavigation.ts)
- Pitfalls: HIGH - All pitfalls identified from concrete codebase analysis (scrollbar alignment, IPC dates, hook-per-row pattern)
- Integration surface: HIGH - Props interface derived directly from ColumnView.tsx and App.tsx analysis

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, no external dependencies changing)
