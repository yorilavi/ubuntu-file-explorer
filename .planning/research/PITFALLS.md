# Pitfalls: File Metadata Display, List View, and Sorting

**Project:** Ubuntu File Explorer v1.3
**Context:** Adding file metadata display, list/detail view mode, and sorting to existing Electron SSH file explorer
**Researched:** 2026-02-10
**Overall Confidence:** HIGH

## Executive Summary

Adding metadata display, a list view, and sorting to this existing Electron SSH file explorer introduces specific integration challenges that are easy to misdiagnose. The primary risks are:

1. **Misunderstanding what metadata is already available** - ssh2's `readdir` already returns `attrs` (size, mtime, mode, uid, gid). The real gap is symlink target type resolution, not basic file stats.
2. **Dual-view state divergence** - Two view modes (Miller columns + list view) sharing the same data but maintaining independent selection, focus, and scroll state creates subtle synchronization bugs.
3. **Sorting breaking the existing "directories first" invariant** - Current code hardcodes folders-first sorting in three separate places. Custom sorting must either preserve this or explicitly let users break it.
4. **View/sort preference scoping** - Global vs per-directory vs per-server preferences create UX inconsistency if not decided upfront.
5. **Re-rendering performance regression** - Adding metadata columns to 28px-height rows with virtualization requires careful measurement to avoid layout thrashing.

---

## Critical Pitfalls

### Pitfall 1: Unnecessary N+1 SFTP Stat Calls (The Phantom Performance Problem)

**What goes wrong:**

The milestone description mentions "stat calls per file" as a performance concern. A developer unfamiliar with the existing code might add individual `sftp.stat()` calls for every file to get metadata, creating N+1 round-trips over SSH. For a 500-file directory on a 100ms latency connection, this adds 50 seconds of blocking time.

**Why it's actually a non-problem for basic metadata:**

The current `sftp-service.ts` (line 100-145) already extracts full metadata from `readdir` results:

```typescript
// ALREADY AVAILABLE from readdir attrs:
size: entry.attrs.size || 0,           // File size
modified: new Date((entry.attrs.mtime || 0) * 1000),  // Modification time
permissions: '0' + permBits.toString(8).padStart(3, '0'),  // Unix permissions
uid: entry.attrs.uid || 0,            // Owner UID
gid: entry.attrs.gid || 0,            // Owner GID
```

The `FileEntry` type in `shared/types.ts` already includes size, modified, permissions, uid, gid. The existing `FileRow` component (unused but present in codebase) already renders all these fields. **No extra SFTP calls are needed for basic metadata display.**

**Where stat calls ARE actually needed:**

The one legitimate case for extra stat calls is **resolving symlink targets to determine if they point to directories**. Currently, `isSymlink` files show a symlink badge but the code uses raw mode bits from readdir, which report the symlink type (0o120000), not the target type. To show the correct icon (folder vs file) for symlinks, you need `sftp.stat()` (which follows symlinks) rather than `sftp.lstat()`.

```typescript
// Current: knows it's a symlink, but not what type the target is
const isSymlink = (mode & 0o170000) === 0o120000;

// Needed for symlink icon accuracy:
if (isSymlink) {
  const targetStats = await new Promise((resolve, reject) => {
    sftp.stat(fullPath, (err, stats) => err ? resolve(null) : resolve(stats));
  });
  const targetIsDirectory = targetStats ? (targetStats.mode & 0o170000) === 0o040000 : false;
}
```

**Consequences of misdiagnosis:**

- Developer adds stat calls that duplicate already-available data, creating a 10-50x slowdown
- Or developer adds stat calls for all files "just in case" instead of only symlinks
- Large directories become unusable over high-latency connections
- The real issue (symlink target resolution) remains unaddressed

**Prevention:**

- Do NOT add per-file stat calls. The data is already in readdir results.
- For symlink target type resolution, batch stat calls only for symlinks, with concurrency limiting (max 10 concurrent) and graceful fallback.
- Add the symlink target stat as an optional enhancement, not a blocking requirement.

**Detection:**

- Network tab / SFTP logging shows stat calls matching readdir count
- Directory load time scales linearly with file count
- Comparison: readdir is one call regardless of file count

**Phase to Address:** Phase 1 (Metadata Display) - Must verify readdir attrs are sufficient before writing any stat code

**Confidence:** HIGH - Verified by reading actual sftp-service.ts source and ssh2 library behavior

---

### Pitfall 2: Dual View State Divergence (Miller Columns vs List View)

**What goes wrong:**

The existing ColumnView has complex state management via a `useReducer` with 10 action types (NAVIGATE_INTO, NAVIGATE_BACK, SELECT_ITEM, FOCUS_ITEM, etc). It maintains multi-column state, selection sets, focused indices, and scroll offsets. Building a separate list view with its own state creates two sources of truth. Switching views loses selection, scroll position, or current path.

**Why it happens:**

The ColumnView's state (`ColumnViewState` in `types/columnView.ts`) is deeply specific to Miller columns:

```typescript
interface ColumnViewState {
  columns: ColumnState[];          // Multiple columns - meaningless in list view
  activeColumnIndex: number;       // Which column has focus
}

interface ColumnState {
  path: string;
  entries: FileEntry[];
  selectedIndices: Set<number>;    // Per-column selection
  focusedIndex: number;            // Per-column focus
  scrollOffset: number;
  loading: boolean;
  error: string | null;
}
```

A list view needs completely different state: single directory with sortable entries, single selection set, column header sort indicators, and scroll position. Developers either: (a) try to shoehorn list view into ColumnViewState (wrong abstraction), or (b) build a completely independent state that doesn't share the current path/server context.

**Consequences:**

- Switch from column view to list view: selection lost, navigated back to root
- Switch from list view to column view: column hierarchy not rebuilt
- File operations (rename, delete) in one view don't refresh the other
- `selectedFile` in App.tsx becomes ambiguous - which view set it?
- Preview panel breaks because it depends on `onFileSelect` callback from ColumnView

**Prevention:**

Lift shared state to App.tsx (or a shared hook), keep view-specific state in each view component:

```typescript
// SHARED state (in App.tsx or useFileExplorer hook):
interface SharedBrowserState {
  currentPath: string;
  entries: FileEntry[];          // Single source of truth for directory contents
  selectedFile: FileEntry | null;
  loading: boolean;
  error: string | null;
}

// VIEW-SPECIFIC state:
// ColumnView keeps: columns[], activeColumnIndex, per-column scroll
// ListView keeps: sortColumn, sortDirection, scrollTop, columnWidths

// The ColumnView already fetches entries via its own mechanism.
// Key: both views must call the same fetchDirectory and share the result.
```

The existing `DirectoryList` component (currently unused but in the codebase) provides a starting template for list view - it already has sorting, hidden file toggle, and `FileRow` rendering. But it fetches its own directory contents independently, which would diverge from ColumnView.

**Detection:**

- Switching view modes resets current path or selection
- File operation refresh only updates one view
- Two different `listDirectory` IPC calls for the same path
- Preview panel shows stale file after view switch

**Phase to Address:** Phase 2 (List View) - Must design shared state layer BEFORE building the list view component

**Confidence:** HIGH - Directly observed in codebase: ColumnView and DirectoryList each have independent fetch logic

---

### Pitfall 3: Sorting Duplicated in Three Places

**What goes wrong:**

The current codebase has the same "directories first, then alphabetical" sort logic in three separate locations:

1. **`sftp-service.ts` line 148-153**: Server-side sort after readdir
2. **`ColumnView.tsx` line 363-367**: Client-side sort in fetchDirectory
3. **`DirectoryList.tsx` line 84-104**: Client-side sort with configurable columns

Adding user-configurable sorting means modifying all three locations, and they'll drift out of sync. A user sorts by "size descending" in list view, switches to column view, and sees alphabetical order because ColumnView has its own hardcoded sort.

**Why it happens:**

The sort in sftp-service.ts was added for consistent API responses. The sort in ColumnView was added because IPC serialization and hidden-file filtering happen after the server sort. The sort in DirectoryList was built independently with its own sort state. Nobody coordinated because these were built in different phases.

**Consequences:**

- Sorting in list view doesn't carry over to column view
- Adding a new sort option requires changes in 3+ files
- Server-side sort is wasted work if client re-sorts anyway
- "Sort by modified" in one view, alphabetical in another - confusing UX

**Prevention:**

1. **Remove the sort from `sftp-service.ts`** - Return entries in readdir order. Let the client sort.
2. **Create a single `sortEntries()` utility** used by both views:

```typescript
// src/shared/sorting.ts
type SortField = 'name' | 'size' | 'modified' | 'permissions';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
  directoriesFirst: boolean;  // Make the invariant explicit
}

function sortEntries(entries: FileEntry[], config: SortConfig): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (config.directoriesFirst && a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    // ... sort by field and direction
  });
}
```

3. **Store sort config at the App level** so both views read from the same source.

**Detection:**

- Different sort order in column view vs list view for same directory
- Changing sort preference only affects one view
- Adding new sort field requires touching 3+ files

**Phase to Address:** Phase 1 (Metadata Display) - Consolidate sorting BEFORE adding configurable sort UI

**Confidence:** HIGH - Three sort locations directly verified in codebase

---

### Pitfall 4: Losing Column View Navigation Context on View Switch

**What goes wrong:**

Miller columns maintain a navigation stack: `/` -> `/home` -> `/home/user` -> `/home/user/docs`, with each level as a separate column. When the user switches to list view showing `/home/user/docs`, does work there, then switches back to column view, the column hierarchy should be reconstructed. Without explicit handling, the user gets dumped into a single column showing `/home/user/docs` without parent columns.

**Why it happens:**

The ColumnView's `NAVIGATE_TO` action (line 62-76 in ColumnView.tsx) can rebuild columns from a path:

```typescript
case 'NAVIGATE_TO': {
  const segments = action.path.split('/').filter(Boolean);
  const newColumns: typeof state.columns = [createColumnState('/')];
  let currentPath = '';
  for (const segment of segments) {
    currentPath = `${currentPath}/${segment}`;
    newColumns.push(createColumnState(currentPath));
  }
  return { columns: newColumns, activeColumnIndex: newColumns.length - 1 };
}
```

But this creates empty columns that need to be fetched. If the user has already navigated deep, switching back triggers N directory fetches (one per path segment). For `/home/user/projects/app/src/components`, that's 7 fetches just to restore the view.

**Consequences:**

- Visible loading state in every column after switching back
- Columns flash empty then populate left-to-right (jarring UX)
- Each fetch is an IPC round-trip to main process -> SFTP
- If any intermediate directory fetch fails, column hierarchy is broken
- Previously selected files in parent columns are not restored

**Prevention:**

Cache directory listings when navigating, so switching back to column view can restore from cache without network calls:

```typescript
// Directory cache - shared between views
const directoryCache = new Map<string, { entries: FileEntry[]; fetchedAt: number }>();

// When fetching any directory (from either view), cache the result
function fetchDirectory(serverId: string, path: string): Promise<FileEntry[]> {
  const cached = directoryCache.get(`${serverId}:${path}`);
  if (cached && Date.now() - cached.fetchedAt < 30_000) {  // 30s cache
    return Promise.resolve(cached.entries);
  }
  // ... actual fetch, then cache
}
```

Alternatively, keep the ColumnView mounted but hidden (`display: none`) when in list view mode, so its state is preserved in React state. This is simpler but uses more memory.

**Detection:**

- Switching from list view to column view shows loading spinners in all columns
- Parent columns are empty or show stale data
- Performance profiler shows burst of IPC calls on view switch
- Selection in parent columns is lost

**Phase to Address:** Phase 2 (List View) - Design caching strategy alongside view switching

**Confidence:** HIGH - NAVIGATE_TO action behavior verified in codebase

---

## Moderate Pitfalls

### Pitfall 5: Metadata Columns Breaking Virtualized Row Height

**What goes wrong:**

The existing Column component uses `@tanstack/react-virtual` with a fixed `estimateSize: () => 28` (28px per row). The current `FileItem` renders just icon + name + chevron, fitting reliably in 28px. Adding metadata columns (size, date, permissions) to the row either: (a) doesn't fit in 28px and causes text overflow/clipping, or (b) requires increasing row height, which breaks the virtualizer's measurement and causes scroll jumping.

**Why it happens:**

`@tanstack/react-virtual` requires accurate size estimation. If you change `estimateSize` from 28 to 36 and some rows are still 28px (e.g., truncated text vs multi-line), the virtualizer miscalculates total scroll height. Scroll position jumps when items above the viewport change measured size.

More critically, the Column view is space-constrained (columns are 150-220px wide). Adding metadata to column view rows doesn't make sense - that's a list view concern. But if you try to create a "detailed column view" you'll fight the column width constraint.

**Consequences:**

- Scroll jumping when virtualizer recalculates sizes
- Text overflow causing horizontal scroll within individual cells
- Row height inconsistency between different views
- Layout thrashing on window resize when metadata columns resize

**Prevention:**

- Keep column view compact (icon + name + chevron) - do NOT add metadata to column view rows
- List view gets its own virtualizer with appropriate row height (32-36px)
- Use fixed row heights in both views (no dynamic sizing)
- Metadata in column view should be shown only in the preview panel (already exists)

```typescript
// Column view: compact FileItem (existing 28px)
// List view: FileRow with metadata (new, 32-36px fixed)
const LIST_ROW_HEIGHT = 34;  // Fixed, not estimated

const virtualizer = useVirtualizer({
  count: entries.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => LIST_ROW_HEIGHT,
  overscan: 15,  // More overscan for taller rows
});
```

**Detection:**

- Scroll position jumps when scrolling fast
- Content flickers when items enter/leave viewport
- Performance profiler shows repeated `getBoundingClientRect` calls
- Visible gap between last visible item and scroll track position

**Phase to Address:** Phase 2 (List View) - Use fixed row heights from the start

**Confidence:** HIGH - @tanstack/react-virtual behavior with mismatched sizes is well-documented

---

### Pitfall 6: Date Sorting Edge Cases with SFTP Timestamps

**What goes wrong:**

SFTP returns `mtime` as a Unix timestamp (seconds since epoch). Some SFTP servers return 0 for `mtime` when the timestamp is unavailable (e.g., virtual filesystems, some NFS mounts, FUSE filesystems). Sorting by "modified date" puts these files at January 1, 1970, far from the user's other files. Worse, some servers return timestamps in the future (incorrect timezone handling) which sorts them to the top.

The current code already handles this: `modified: new Date((entry.attrs.mtime || 0) * 1000)` -- but `0` becomes `new Date(0)` which is "Thu Jan 01 1970" and silently corrupts sort order.

**Why it happens:**

- SFTP protocol doesn't mandate timestamp accuracy
- Virtual filesystems (procfs, sysfs, FUSE) often return 0
- NFS servers may have clock skew
- The app explores remote Linux servers which commonly have these filesystem types

**Consequences:**

- Files with `mtime=0` sort to the very top (ascending) or very bottom (descending)
- Mixed real/zero timestamps make date-sorted lists unusable
- Users think the sort is broken when it's actually data quality
- Future timestamps push files above recently-modified files

**Prevention:**

```typescript
function compareDates(a: Date, b: Date): number {
  const aTime = a.getTime();
  const bTime = b.getTime();

  // Treat epoch-zero timestamps as "unknown" - sort them to the end
  const EPOCH_ZERO = 0;
  const aIsUnknown = aTime === EPOCH_ZERO;
  const bIsUnknown = bTime === EPOCH_ZERO;

  if (aIsUnknown && bIsUnknown) return 0;
  if (aIsUnknown) return 1;  // Unknown sorts last
  if (bIsUnknown) return 1;

  return aTime - bTime;
}

// Display: show "Unknown" instead of "Jan 1, 1970"
function formatDate(date: Date): string {
  if (date.getTime() === 0) return '--';
  // ... existing formatting
}
```

**Detection:**

- "Jan 1, 1970" appears in date column for some files
- Sort by date produces unexpected order
- Files from /proc, /sys, or FUSE mounts cluster at extreme ends

**Phase to Address:** Phase 3 (Sorting) - Handle in the sort comparison function

**Confidence:** HIGH - mtime=0 behavior verified in sftp-service.ts, common on Linux servers

---

### Pitfall 7: View/Sort Preferences Scoping Ambiguity

**What goes wrong:**

The app needs to persist view mode and sort preferences (already has `ui-preferences-store.ts` using `electron-conf`). The question is: does "sort by size" apply globally, per-server, or per-directory? Users expect different scoping in different scenarios:

- "I always want list view" -> global preference
- "I want columns for this server, list for that server" -> per-server
- "Sort by date in Downloads, by name elsewhere" -> per-directory

Building global-only preferences and then discovering users want per-directory scoping requires a storage schema migration.

**Why it happens:**

The existing `ui-preferences-store.ts` uses flat key-value storage:

```typescript
interface UIPreferencesSchema {
  columnWidths: number[];
  previewPanelWidth: number;
  showHiddenFiles: boolean;
}
```

Adding `viewMode: 'columns' | 'list'` and `sortConfig: { field, direction }` as flat keys creates global preferences. Per-server or per-directory scoping requires nested keys like `viewPreferences.{serverId}.{path}`, which is a different storage pattern.

**Consequences:**

- Global preference: user switches to list view for one server, ALL servers switch
- Per-directory preference: massive storage requirements, complex lookup
- Wrong scoping leads to user frustration ("I didn't change this!")
- Schema migration needed if you start global and want per-server later

**Prevention:**

Start with **global default + per-server override**:

```typescript
interface UIPreferencesSchema {
  // Existing
  columnWidths: number[];
  previewPanelWidth: number;
  showHiddenFiles: boolean;

  // New: global defaults
  defaultViewMode: 'columns' | 'list';
  defaultSortField: 'name' | 'size' | 'modified';
  defaultSortDirection: 'asc' | 'desc';

  // New: per-server overrides (only store if different from default)
  serverPreferences: Record<string, {
    viewMode?: 'columns' | 'list';
    sortField?: 'name' | 'size' | 'modified';
    sortDirection?: 'asc' | 'desc';
  }>;
}
```

This pattern is:
- Simple to implement (electron-conf supports nested objects)
- No per-directory complexity
- Supports the most common use case (different preferences for different servers)
- Easy to extend to per-directory later if needed (add `directoryPreferences` nested under server)
- Storage is bounded (one entry per server, not per directory)

Do NOT build per-directory preferences in v1.3. Wait for user feedback.

**Detection:**

- User changes view mode, all servers affected
- Preference resets when connecting to different server
- Storage file grows unboundedly (if per-directory implemented)

**Phase to Address:** Phase 1 (Metadata Display) - Design schema before any persistence code

**Confidence:** HIGH - electron-conf schema directly verified in ui-preferences-store.ts

---

### Pitfall 8: Keyboard Navigation Divergence Between Views

**What goes wrong:**

The existing ColumnView has sophisticated keyboard navigation via `useColumnNavigation` hook: Up/Down moves focus, Left goes to parent column, Right enters folder, type-ahead search by filename, Cmd+click multi-select, Shift+click range select. A list view needs different keyboard behavior: Up/Down in a single list, no Left/Right column navigation, but needs keyboard-triggered sorting (e.g., clicking column headers). If keyboard shortcuts conflict or behave differently, users muscle memory breaks.

**Why it happens:**

The `useColumnNavigation` hook handles key events at the column level. In list view, there are no columns, so Left/Right should do nothing (or navigate breadcrumbs). But spacebar currently opens lightbox (handled in `App.tsx` line 452-486). If list view captures spacebar for row expansion or selection, it conflicts.

**Consequences:**

- Left arrow does nothing in list view (confusing after column view)
- Type-ahead search works in one view but not the other
- Spacebar conflict between lightbox and list view selection
- Tab navigation order differs between views
- Screen reader behavior inconsistent (ARIA roles differ)

**Prevention:**

- Share keyboard navigation primitives via a `useFileNavigation` hook:
  - Up/Down: move focus (both views)
  - Enter: open directory or file (both views)
  - Spacebar: toggle lightbox (both views - keep existing behavior)
  - Type-ahead: filter by name (both views)
- View-specific keys:
  - Column view: Left/Right for column navigation
  - List view: Left/Right do nothing (or navigate path bar)
- ARIA: Both views use `role="listbox"` with `aria-activedescendant`

**Detection:**

- User reports "arrow keys work differently in list view"
- Type-ahead search missing in one view
- ARIA audit shows different roles for same semantic purpose
- Spacebar opens lightbox in one view, does something else in the other

**Phase to Address:** Phase 2 (List View) - Extract shared navigation logic before building list view

**Confidence:** MEDIUM - Based on useColumnNavigation hook analysis, some keyboard behavior is view-specific by design

---

### Pitfall 9: Sort Indicator State Not Visible in Column View

**What goes wrong:**

In list view, sort state is shown via column header indicators (up/down arrows). In column view, there are no column headers - it's just a list of files. If the user sorts by "size" and switches to column view, the sort order changes (column view applies the sort) but there's no visual indicator of what the sort is. The user sees files in a non-alphabetical order with no explanation.

**Why it happens:**

Column view's compact design intentionally omits headers. Adding sort indicators to column view requires either: adding a header row (which takes space and changes the visual design), or adding a sort indicator elsewhere (toolbar, which is far from the content).

**Consequences:**

- Files appear in "random" order in column view (actually sorted by size, but no indicator)
- User confusion: "Why aren't my files alphabetical anymore?"
- No discoverability of current sort in column view
- Sort state becomes invisible when it matters most

**Prevention:**

Two approaches (pick one):

**Option A: Column view always uses name sort.** Configurable sort only affects list view. This is how macOS Finder works - column view is always alphabetical, list view has sortable headers.

**Option B: Add a subtle sort indicator.** Small text or icon at the top of each column showing current sort. Clicking it cycles sort options. This deviates from Finder but provides consistency.

Recommend Option A because:
- Matches Finder precedent (this app mimics Finder)
- Simpler implementation
- Column view with non-alphabetical sort is confusing regardless of indicators
- Column widths (150-220px) don't leave room for sort headers

**Detection:**

- Files in column view appear unsorted after changing sort in list view
- User complaints about "random" file ordering
- Sort preference silently ignored in one view mode

**Phase to Address:** Phase 3 (Sorting) - Decide sort scope per view mode upfront

**Confidence:** MEDIUM - Based on Finder behavior analysis and column width constraints

---

## Minor Pitfalls

### Pitfall 10: FileRow Component Already Exists But Is Stale

**What goes wrong:**

The codebase contains `FileRow.tsx` and `DirectoryList.tsx` - components that render metadata columns and sortable headers. A developer might assume these are ready to use. But they are from an earlier prototype: `DirectoryList` fetches its own directory data independently, has its own hidden-file toggle, its own sort state, and is NOT wired into the current App.tsx architecture (which uses ColumnView + PreviewPanel).

**Prevention:**

- Use `FileRow.tsx` as a design reference, not as production code
- `DirectoryList.tsx`'s sorting logic can be extracted, but the component itself needs rewriting to integrate with the shared state layer
- Delete or explicitly mark these as deprecated to prevent confusion
- The `formatSize`, `formatDate`, `formatPermissions` utility functions in `FileRow.tsx` are reusable - extract them to a shared utility

**Phase to Address:** Phase 1 (Metadata Display) - Audit existing components before building new ones

**Confidence:** HIGH - Verified: DirectoryList is not imported in App.tsx

---

### Pitfall 11: IPC Date Serialization Breaking Sort Stability

**What goes wrong:**

The existing code has a workaround for IPC date serialization: `modified: new Date(entry.modified)` in ColumnView.tsx (line 354). Dates pass through Electron IPC as ISO strings, not Date objects. If sorting happens before this conversion, `localeCompare` on date strings gives wrong order ("2024-01-15" < "2024-02-01" works, but "Dec 15" < "Feb 01" doesn't). If sorting happens after conversion but the conversion is inconsistent between views, sorts diverge.

**Prevention:**

- Ensure date conversion happens in a single place (the shared fetch layer), before any sorting
- Sort by `date.getTime()` (numeric), never by date string
- Add a type guard or assertion to verify dates are Date objects before sorting

```typescript
// In shared fetch utility:
function normalizeEntries(raw: FileEntry[]): FileEntry[] {
  return raw.map(entry => ({
    ...entry,
    modified: entry.modified instanceof Date
      ? entry.modified
      : new Date(entry.modified),
  }));
}
```

**Phase to Address:** Phase 1 (Metadata Display) - Normalize in shared fetch layer

**Confidence:** HIGH - IPC date serialization workaround verified in ColumnView.tsx line 354

---

### Pitfall 12: Resizable Metadata Columns Conflicting with Resizable Miller Columns

**What goes wrong:**

The existing ColumnView has custom column resize handles (mousedown -> mousemove -> mouseup pattern in ColumnView.tsx lines 272-335). If the list view also has resizable metadata columns (Name, Size, Modified, etc.), two independent resize systems exist. A single mousemove handler can't disambiguate between "resizing column view column" and "resizing list view metadata column." The preview panel also has its own resize handle (App.tsx lines 116-158).

**Prevention:**

- List view metadata columns should use CSS-based resizing (e.g., `resize: horizontal` on th elements, or a library like `@tanstack/react-table` with built-in column resizing)
- Do NOT duplicate the custom mousedown/mousemove resize pattern from ColumnView
- Only one resize system should be active at a time (column view OR list view, never both)
- Persist list view column widths separately from Miller column widths in `ui-preferences-store.ts`

**Phase to Address:** Phase 2 (List View) - Choose resize approach before implementation

**Confidence:** MEDIUM - Custom resize handlers verified in codebase, but conflict depends on implementation

---

## Integration Risks with Existing System

### Risk 1: Preview Panel Coupling

**Current system:** App.tsx receives `onFileSelect` from ColumnView, passes `selectedFile` to PreviewPanel.
**New risk:** List view must provide the same `onFileSelect` callback with the same FileEntry shape. If list view's FileEntry has different field values (e.g., different date parsing), preview panel breaks.

**Mitigation:** Both views share the same `FileEntry[]` data from a single fetch source. The `onFileSelect` contract is already well-defined.

### Risk 2: Lightbox Navigation Assumptions

**Current system:** Lightbox navigation (up/down arrows when lightbox is open) dispatches `lightbox-navigate` custom events that ColumnView listens to. List view needs to handle these same events.
**New risk:** Both views listening to the same custom event. When switching views, stale listeners from the hidden view may fire.

**Mitigation:** Only mount the active view's event listeners. Use cleanup in useEffect to remove listeners when view unmounts or becomes inactive.

### Risk 3: Context Menu Feature Parity

**Current system:** FileItem has extensive context menu (download, upload, rename, delete, move, favorites). This component is used in ColumnView.
**New risk:** List view uses FileRow which has NO context menu. Users lose all file operations in list view.

**Mitigation:** Either share the FileItem component across both views (extract context menu into a reusable hook/component) or ensure FileRow gets context menu before shipping list view.

### Risk 4: Toolbar Controls Scope

**Current system:** HiddenFilesToggle in toolbar affects ColumnView. PathBar shows ColumnView's path.
**New risk:** View mode switcher needs to go in toolbar. Sort controls need to go somewhere. Toolbar grows complex.

**Mitigation:** Group controls logically: [PathBar] [View Toggle] [Sort | Hidden Files]. Keep toolbar single-row.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Metadata display in existing views | Adding stat calls that duplicate readdir data (Pitfall 1) | Verify readdir attrs first; stat only for symlink resolution |
| List view component | State divergence from ColumnView (Pitfall 2) | Shared data layer, separate view state |
| Sorting implementation | Three duplicate sort locations (Pitfall 3) | Consolidate into shared utility before adding new sort options |
| View switching UX | Column hierarchy lost on switch (Pitfall 4) | Directory cache or keep ColumnView mounted but hidden |
| Sort in column view | No visible sort indicator (Pitfall 9) | Column view always name-sorted (Finder pattern) |
| Preference persistence | Wrong scoping (Pitfall 7) | Global default + per-server override schema |
| Keyboard navigation | Different behavior per view (Pitfall 8) | Shared useFileNavigation hook |
| Existing components | Using stale DirectoryList/FileRow (Pitfall 10) | Audit and extract utilities, don't reuse as-is |

---

## Testing Checklist

**Metadata Display:**
- [ ] Directory with 500+ files loads in under 2 seconds (no extra stat calls)
- [ ] Symlink files show correct target type icon
- [ ] Files with mtime=0 show "--" not "Jan 1, 1970"
- [ ] Size shows "--" for directories, formatted bytes for files
- [ ] Permissions render correctly for all common modes

**List View:**
- [ ] Switching from column view to list view preserves current path
- [ ] Switching back to column view restores column hierarchy
- [ ] File selection in list view updates preview panel
- [ ] Context menu works identically in both views
- [ ] Keyboard navigation (up/down/enter/space/type-ahead) works in list view
- [ ] Lightbox opens and navigates correctly from list view
- [ ] Virtualized scrolling smooth with metadata columns at 500+ rows

**Sorting:**
- [ ] Sort by name, size, modified all work correctly
- [ ] Directories remain first regardless of sort (unless explicitly changed)
- [ ] Sort direction toggles on repeated header click
- [ ] Sort persists across navigation within same server
- [ ] Files with zero-timestamp sort to end, not beginning
- [ ] Column view uses name sort regardless of list view sort preference
- [ ] Sort preferences persist across app restart

**Preferences:**
- [ ] View mode preference persists across app restart
- [ ] Per-server view preference overrides global default
- [ ] Sort preference persists across app restart
- [ ] Changing preference for one server doesn't affect others

---

## Sources

**Codebase Analysis (primary source):**
- `src/main/ssh/sftp-service.ts` - readdir already extracts full attrs (size, mtime, mode, uid, gid)
- `src/shared/types.ts` - FileEntry already includes all metadata fields
- `src/renderer/components/ColumnView/ColumnView.tsx` - Reducer with 10 action types, custom resize
- `src/renderer/components/ColumnView/Column.tsx` - @tanstack/react-virtual with 28px fixed height
- `src/renderer/components/FileRow.tsx` - Existing unused metadata row component
- `src/renderer/components/DirectoryList.tsx` - Existing unused list view with sorting
- `src/renderer/components/FileItem.tsx` - Active column view item with context menu
- `src/main/storage/ui-preferences-store.ts` - electron-conf flat schema
- `src/renderer/App.tsx` - Top-level state management, preview panel integration

**ssh2 Library:**
- ssh2 SFTP readdir returns `attrs` object with mode, size, mtime, uid, gid per entry (single round-trip)
- ssh2 SFTP stat/lstat requires individual calls per file (N round-trips)
- Symlink mode bits (0o120000) in readdir do not indicate target type

**@tanstack/react-virtual:**
- Fixed size estimation critical for scroll stability
- Overscan parameter controls pre-rendering buffer
- Dynamic sizes require `measureElement` callback which introduces layout thrashing

**macOS Finder Precedent:**
- Column view: always name-sorted, no sort headers
- List view: sortable column headers with indicators
- Icon view: separate arrangement options
- View preferences are per-window (closest to per-server in our case)
